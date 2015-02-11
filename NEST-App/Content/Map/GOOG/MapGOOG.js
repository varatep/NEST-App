﻿var map;
var mapListeners = map; //use this to add listeners to the map
var counter = 0;
//var vehicleHub = $.connection.vehicleHub;
var pointText;
var results;
var parse;
var uavs = {};
var overlays = []; //Array for the polygon shapes as overlays
var flightLines = []
var drawingManager;
var selectedShape;
var uavMarker;
var dropMarkerListener;
var trailArray = [];
var waypointMarker = null;
var selectedUAV; //the uav that's been selected
var selectedTrail; //the trail that the selected uav has
var selectedDrones = []; //store drones selected from any method here
var storedGroups = []; //keep track of different stored groupings of UAVs
var ctrlDown = false;
var infobox;
var infoboxAlert;
var selected = false;
var homeBase = new google.maps.LatLng(34.2417, -118.529);
var colors = ['#1E90FF', '#FF1493', '#32CD32', '#FF8C00', '#4B0082'];
var selectedColor;
var colorButtons = {};

function uavMarkers(data, textStatus, jqXHR) {
    console.log("Pulling Flightstates...", textStatus);
    for (var i = 0; i < data.length; i++) {
        uavs[data[i].Id] = {};
        uavs[data[i].Id].Id = data[i].Id;

        uavs[data[i].Id].FlightState = data[i].FlightState;
        uavs[data[i].Id].Schedule = data[i].Schedule;
        uavs[data[i].Id].Missions = data[i].Schedule.Missions;
        pointText = uavs[data[i].Id].FlightState.Position.Geography.WellKnownText;
        results = pointText.match(/-?\d+(\.\d+)?/g);
        uavs[data[i].Id].Lat = results[1];
        uavs[data[i].Id].Lon = results[0];
        uavs[data[i].Id].Alt = results[2];
        uavs[data[i].Id].Callsign = data[i].Callsign;
        uavs[data[i].Id].Battery = data[i].FlightState.BatteryLevel;
        uavs[data[i].Id].Position = new google.maps.LatLng(results[1], results[0]);
        uavs[data[i].Id].Mission = data[i].Mission;

        destText = uavs[data[i].Id].Mission.DestinationCoordinates.Geography.WellKnownText;
        res = destText.match(/-?\d+(\.\d+)?/g);
        var destLat = res[1];
        var destLon = res[0];
        var destAlt = res[2];
        uavs[data[i].Id].Destination = new google.maps.LatLng(res[1], res[0]);

        //Creates the flightpath line from uav position to destination
        var flightPlanCoords = [
            uavs[data[i].Id].Position,
            uavs[data[i].Id].Destination
        ];

        flightLines[data[i].Id] = new google.maps.Polyline({
            path: flightPlanCoords,
            geodesic: true,
            strokeColor: 'blue',
            strokeOpacity: 1.0,
            strokeWeight: 2
        });

        var markerCircle = new google.maps.Marker({
            position: uavs[data[i].Id].Position,
            icon: uavCircleBlack
        });

        var marker = new MarkerWithLabel({
            position: uavs[data[i].Id].Position,
            icon: uavSymbolBlack,
            labelContent: uavs[data[i].Id].Callsign + '<div style="text-align: center;"><b>Alt: </b>' + uavs[data[i].Id].Alt + '<br/><b>Bat: </b>' + uavs[data[i].Id].Battery + '</div>',
            labelAnchor: new google.maps.Point(95, 20),
            labelClass: "labels",
            labelStyle: { opacity: 0.75 },
            zIndex: 999999,
            uav: uavs[data[i].Id]
        });


        var key = data[i].Id.toString();
        uavs[data[i].Id].marker = marker;
        uavs[data[i].Id].markerCircle = markerCircle;
        uavs[data[i].Id].flightPath = flightLines[data[i].Id];
        uavs[data[i].Id].markerCircle.setMap(map);
        uavs[data[i].Id].marker.setMap(map);
        marker.set('flightPath', flightLines[data[i].Id]);
        marker.set('flightToggle', false);
        var flightToggle = false;
        google.maps.event.addListener(marker, 'click', (function () {
            CtrlSelect(this, selectedDrones, selectedUAV)
        }));
    }
}


//store uav trails
//still working on it
function storeTrail(uavID, location) {
    var notCreated;
    //if (!notCreated) {
    // //update trail
    // for (var j = 0; j < uavTrails[uavID].trail.length; j++) {
    // o -= 0.04;
    // s -= 0.04;
    // uavTrail = {
    // url: '../Content/img/blue.jpg',
    // fillOpacity: o,
    // scale: s,
    // anchor: new google.maps.Point(46 * s, 44 * s)
    // };
    // console.log(uavTrail);
    // }
    //}
    var trailMarker = new google.maps.Marker({
        position: location,
        icon: uavTrail
    });

    for (var i = 0; i < uavTrails.length; i++) {
        if (uavTrails[i].id === uavID) {
            //set trail
            if (uavTrails[i].trail.length <= 30) {
                uavTrails[i].trail.push(trailMarker);
            }
            else {
                uavTrails[i].trail[0].setMap(null);
                uavTrails[i].trail.shift();
                uavTrails[i].trail.push(trailMarker);
            }
            notCreated = false;
            break;
        }
        else {
            notCreated = true;
        }
    }

    if (notCreated) {
        //push new uavTrails
        uavTrails.push({
            id: uavID,
            trail: []
        });
        storeTrail(uavID, location);
    }
}

// click on map to set a waypoint
// todo: make a cancel button
// still working on it
function clickToGo() {
    if (selectedUAV != null) {
        goTo_hide();

        //setting dropMarkerListener
        dropMarkerListener = google.maps.event.addListener(mapListeners, 'click', dropWaypoint(event));

        //actually adding the listener to the map
        google.maps.event.addListener(mapListeners, 'click', dropWaypoint(event));
    }
}
//still working on it -David
function dropWaypoint(event) {
    if (dropMarkerListener != null) {
        //call function to create marker
        if (waypointMarker) {
            waypointMarker.setMap(null);
            waypointMarker = null;
        }
        waypointMarker = createMarker(event.latLng, "name", "<b>Location</b><br>" + event.latLng);

        // make uav fly to the dropped pin
        goWaypoint(event.latLng.lat(), event.latLng.lng());

        // remove listener so the marker can only be placed once
        google.maps.event.removeListener(dropMarkerListener);
        dropMarkerListener = null;
    }

        // reset selected uav if there's no waypoint
    else if (waypointMarker) {
        uavInfoWindow.close();
        otherInfoWindow.close();
    }
    else {
        for (i = 0; i < trailArray.length; i++) {
            trailArray[i].setMap(null);
        }
        selectedUAV = null;
        //uavInfoWindow.close();
    }
    $("#UAVId").html("Select an UAV first");
    $("#goBtn").addClass("disabled");
    $("#clickToGoBtn").addClass("disabled");
}
//still working on it -David
function goWaypoint(lat, long) {
    //vehicleHub.server.sendCommand({
    //    Id: 123,
    //    Latitude: lat,
    //    Longitude: long,
    //    Altitude: 400,
    //    UAVId: selectedUAV
    //});
}


function goTo_show() {
    document.getElementById("CommPopPlaceHolder").style.display = "block";
}

function goTo_hide() {
    document.getElementById("CommPopPlaceHolder").style.display = "none";
}

function clear() {
    document.getElementById("go_lat").value = "";
    document.getElementById("go_long").value = "";
}

$(document).ready(function () {
    var mapOptions = {
        zoom: 18,
        center: new google.maps.LatLng(34.2417, -118.529),
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDoubleClickZoom: true,
    }
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    var distanceCircle = new google.maps.Circle({
        map: map,
        radius: 8046.72, //distance in meters (5 miles)
        fillColor: '#3399FF',
        center: homeBase,
        strokeWeight: 0,
        fillOpacity: 0.1,
        zIndex: -1
    })
    //setting trail style
    uavTrail = {
        url: '../Content/img/blue.jpg',
        fillOpacity: 0.7,
        size: new google.maps.Size(46, 44),
        scaledSize: new google.maps.Size(5, 5),
        anchor: new google.maps.Point(5, 5)
    };
    var homeControlDiv = document.createElement('div');
    var homeControl = new BaseControl(homeControlDiv, map);

    var marker = new google.maps.Marker({
        position: homeBase,
        icon: goldStarBase,
        map: map
    });

    homeControlDiv.index = 1;
    map.controls[google.maps.ControlPosition.RIGHT].push(homeControlDiv);

    // add event listener
    if (document.getElementById("go_lat") != isNaN && document.getElementById("go_long") != isNaN) {
        document.getElementById("goWaypoint").addEventListener("click", goWaypoint(document.getElementById("go_lat"), document.getElementById("go_long")));
    }

    $.ajax({
        url: '/api/uavs/getuavinfo',
        success: function (data, textStatus, jqXHR) {
            uavMarkers(data, textStatus, jqXHR);
        }
    });

    /**** Currently in progress 
    google.maps.event.addListener(map, 'click', function () {
        if (infobox) {
            infobox.close();
        }
    });
   */
    //Right click for infowindow coordinates on map
    google.maps.event.addListener(map, "rightclick", function (event) {
        var lat = event.latLng.lat();
        var lng = event.latLng.lng();
        var point = new google.maps.LatLng(lat, lng);
        var infowindow = new google.maps.InfoWindow({
            content: '<div style="line-height: 1.35; overflow: hidden; white-space: nowrap;"><b>Lat: </b>' + lat + '<br/><b>Lng: </b>' + lng + '</div>',
            position: point
        });
        infowindow.open(map);
    });

    //Drawing manager top left, allows user to draw shapes and lines on the map
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        markerOptions: {
            draggable: true
        },
        polylineOptions: {
            editable: true
        },
        rectangleOptions: polyOptions,
        circleOptions: polyOptions,
        polygonOptions: polyOptions,
        map: map
    });

    drawingManager.setMap(map);
    drawingManager.setDrawingMode(null);

    google.maps.event.addListener(drawingManager, 'overlaycomplete', function (e) {
        overlays.push(e);
        if (e.type != google.maps.drawing.OverlayType.MARKER) {
            //Switch to non-drawing after a shape is drawn
            drawingManager.setDrawingMode(null);
            //Select the shape when user clicks on it
            var newShape = e.overlay;
            newShape.type = e.type;
            google.maps.event.addListener(newShape, 'click', function () {
                setSelection(newShape);
            });
            setSelection(newShape);
        }
    });

    //Delete shapes and clear selection
    google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);
    google.maps.event.addListener(map, 'click', clearSelection);
    google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', deleteSelectedShape);
    google.maps.event.addDomListener(document.getElementById('delete-all-button'), 'click', deleteAllShape);
    buildColorPalette();

    /* Vehicle movement */
    var emitHub = $.connection.eventLogHub;
    $.connection.hub.start().done(function () {
        console.log("connection started for evt log");
    });
    var warningMessageCounter = 0;
    var vehicleHub = $.connection.vehicleHub;
    vehicleHub.client.flightStateUpdate = function (vehicle) {
        //console.log(vehicle); //move it down so it updates with the trail at a slower rate
        var LatLng = new google.maps.LatLng(vehicle.Latitude, vehicle.Longitude);
        //seperate trail dots a little bit
        if (counter == 0 || counter == 20) {
            console.log(vehicle);
            storeTrail(vehicle.Id, LatLng);
            if (counter == 20) {
                counter = 0;
            }
        }counter++;
        // draw trail
        if (selectedUAV && selectedTrail != undefined) {
            if (selectedTrail.length < 2)
                selectedTrail[selectedTrail.length - 1].setMap(map);
            else
                selectedTrail[selectedTrail.length - 2].setMap(map);
        }
        uavs[vehicle.Id].marker.setPosition(LatLng);
        uavs[vehicle.Id].markerCircle.setPosition(LatLng);
        parse = parseFloat(Math.round(vehicle.BatteryLevel * 100) / 100).toFixed(2);
        uavSymbolBlack.rotation = vehicle.Yaw;
        uavSymbolGreen.rotation = vehicle.Yaw;
        if (selectedUAV) {
            uavs[vehicle.Id].marker.setIcon(uavSymbolGreen);
            uavs[vehicle.Id].marker.setIcon(uavSymbolGreen);
        }
        else
            uavs[vehicle.Id].marker.setIcon(uavSymbolBlack);
        uavs[vehicle.Id].marker.setOptions({
            labelContent: uavs[vehicle.Id].Callsign + '<div style="text-align: center;"><b>Alt: </b>' + vehicle.Altitude + '<br/><b>Bat: </b>' + parse + '</div>',
            icon: uavs[vehicle.Id].marker.icon
        });
        //console.log(parse);
        if (parse < .2) {
         
            //console.log(eventLog);
            //emitHub.server.emit(eventLog);
            if (warningMessageCounter == 0) {
                warningMessageCounter++;
                infobox.open(map, uavs[vehicle.Id].marker);
                infoboxAlert.open(map, uavs[vehicle.Id].marker);

                var eventLog = {
                    uav_id: uavs[vehicle.Id].Id,
                    message: message,
                    criticality: "critical",
                    uav_callsign: uavs[vehicle.Id].Callsign,
                    operator_screen_name: "Test Operator",
                    UAVId: uavs[vehicle.Id].Id
                };
                emitHub.server.emit(eventLog);
                $.ajax({
                    type: "POST",
                    url: "/api/uavs/postuavevent",
                    success: function () { },
                    data: eventLog

                });
            }
        }
    }

    /*Click-drag-select*/
    var shiftPressed = false;
    $(window).keydown(function (evt) {
        if (evt.which === 16) {
            shiftPressed = true;
            //console.log("Shift key down");
        }
        if (evt.ctrlKey) {
            ctrlDown = true;
        }
        //if shift + (0 through 9) is pressed, all selected drones will be bound to that number
        if (evt.shiftKey && ((evt.which >= 48) && (evt.which <= 57))) {
            storedGroups[evt.which] = selectedDrones;
            //console.log("Number of selected drones: " + selectedDrones.length);
        }
        //if 0 through 9 is pressed, it restores that list of selected drones and turns them green
        if ((evt.which >= 48) && (evt.which <= 57)) {
            while (selectedDrones.length > 0) {//clear the selected drone list
                selectedDrones.pop();
            }
            if (storedGroups[evt.which] != null) {
                selectedDrones.push(storedGroups[evt.which]);
                if (selectedDrones.length != 0) {
                    var i;
                    for (i = 0; i < selectedDrones.length; i++) {
                        //selectedDrones[i].marker.setIcon(uavIconGreen);
                    }
                }
            }
            console.log("Number of selected drones: " + selectedDrones.length);
        }
    }).keyup(function (evt) {
        if (evt.which === 16) {
            shiftPressed = false;
            //console.log("Shift key up");
        }
    });

    var mouseDownPos, gridBoundingBox = null, mouseIsDown = 0;
    var mapListeners = map;
    //hide the trail, might be redundent may need to conbine with other functions -David
    google.maps.event.addListener(mapListeners, 'click', function (e) {
        if (selectedTrail != undefined) {
            for (var i = 0; i < (selectedTrail.length - 1) ; i++) {
                selectedTrail[i].setMap(null);
            }
            selectedUAV = null;
        }
    });
    google.maps.event.addListener(mapListeners, 'mousemove', function (e) {
        //console.log("move mouse down, shift down", mouseIsDown, shiftPressed);
        if (mouseIsDown && (shiftPressed || gridBoundingBox != null)) {
            if (gridBoundingBox !== null) {
                var newbounds = new google.maps.LatLngBounds(mouseDownPos, null);
                newbounds.extend(e.latLng);
                gridBoundingBox.setBounds(newbounds);

            } else {
                //console.log("first mouse move");
                gridBoundingBox = new google.maps.Rectangle({
                    map: mapListeners,
                    bounds: null,
                    fillOpacity: 0.15,
                    strokeWeight: 0.9,
                    clickable: false
                });
            }
        }
    });

    google.maps.event.addListener(mapListeners, 'mousedown', function (e) {
        if (shiftPressed) {
            mouseIsDown = 1;
            mouseDownPos = e.latLng;
            mapListeners.setOptions({
                draggable: false
            });
        }
    });

    google.maps.event.addListener(mapListeners, 'mouseup', function (e) {
        if (mouseIsDown && (shiftPressed || gridBoundingBox != null)) {
            mouseIsDown = 0;
            if (gridBoundingBox !== null) {
                while (selectedDrones.length > 0) {//clear the selected drone list
                    selectedDrones.pop();
                }
                var boundsSelectionArea = new google.maps.LatLngBounds(gridBoundingBox.getBounds().getSouthWest(), gridBoundingBox.getBounds().getNorthEast());
                for (var key in uavs) {
                    if (gridBoundingBox.getBounds().contains(uavs[key].marker.getPosition())) {
                        selected = true;
                        uavs[key].marker.setIcon(uavSymbolGreen);
                        selectedDrones.push(uavs[key]);//push the selected markers to an array
                        console.log("Number of selected drones: " + selectedDrones.length);
                    } else {
                        selected = false;
                        uavs[key].marker.setIcon(uavSymbolBlack);
                        console.log("Number of selected drones: " + selectedDrones.length);
                    }
                }
                gridBoundingBox.setMap(null);
            }
            gridBoundingBox = null;
        }
        mapListeners.setOptions({
            draggable: true
        });
    });
});