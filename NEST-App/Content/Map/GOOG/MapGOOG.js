﻿var map;
var homeBase = new google.maps.LatLng(34.2417, -118.529);
var uavs = {};
var vehicleHub;
var warningUavId;

//DroneSelection
var selectedDrones = []; //store drones selected from any method here
var storedGroups = []; //keep track of different stored groupings of UAVs
var ctrlDown = false;
var flightLines = [];
var selectedUAV; //the uav that's been selected

//Drone Trails
var selectedTrail; //the trail that the selected uav has

//TODO: Do we need this? Are we changing this to "var theMap = map;" ?
var mapListeners = map; //use this to add listeners to the map
var wpm;

function uavMarkers(data, textStatus, jqXHR) {
    console.log("Pulling Flightstates...", textStatus);
    
    for (var i = 0; i < data.length; i++) {
        //Set UAV properties
        uavs[data[i].Id] = mapFunctions.SetUAV(data[i]);

        //Creates the flightpath line from uav position to destination
        flightLines[data[i].Id] = new google.maps.Polyline(mapStyles.flightPathOptions);
        flightLines[data[i].Id].setPath([uavs[data[i].Id].Position, uavs[data[i].Id].Destination]);

        //Create the map's visual aspects of the uav
        var markerCircle = new google.maps.Marker({
            position: uavs[data[i].Id].Position,
            icon: mapStyles.uavCircleBlack
        });
        var marker = mapFunctions.SetUAVMarker(uavs[data[i].Id]);


        //Apply the UAV's visual aspects and make them appear on the map
        marker.set('selected', false);
        wpm.addMarker(marker);
        uavs[data[i].Id].marker = marker;
        uavs[data[i].Id].markerCircle = markerCircle;
        uavs[data[i].Id].flightPath = flightLines[data[i].Id];
        uavs[data[i].Id].markerCircle.setMap(map);
        uavs[data[i].Id].marker.setMap(map);

        ///////UAV Marker listeners/////////
        //When fired, the UAV is marked as 'selected'
        google.maps.event.addListener(marker, 'click', (function () {droneSelection.CtrlSelect(this, selectedDrones)}));
        //Events to ccur when a UAV's marker icon has changed (ie the marker's been clicked)
        google.maps.event.addListener(marker, 'selection_changed', function () { droneSelection.SelectionStateChanged(this, selectedDrones, flightLines, droneTrails.uavTrails, selectedTrail) });
        //UAV Context Menu
        var UAVContext = mapFunctions.UAVContext(map);
        google.maps.event.addListener(marker, 'rightclick', function (event) {
            UAVContext.show(event.latLng);
        });
        //Context Menu Selection
        google.maps.event.addListener(UAVContext, 'menu_item_selected', function (latLng, eventName) {
            mapFunctions.UAVContextSelection(map, marker, latLng, eventName);
        });

    }
}

$(document).ready(function () {
    function init() {
        wpm = new WaypointManager(map);
        map = new google.maps.Map(document.getElementById('map-canvas'), mapStyles.mapOptions);
        /*map = new GMaps({
            div:'#map-canvas',
        });
        map.setOptions(mapStyles.mapOptions);*/
        var counter = 0, parse;
        var distanceCircle = new google.maps.Circle(mapStyles.distanceCircleOptions);
        distanceCircle.setCenter(homeBase);
        distanceCircle.setMap(map);

        var homeControlDiv = document.createElement('div');
        var homeControl = new mapStyles.BaseControl(homeControlDiv, map, homeBase);
        var marker = new google.maps.Marker({
            position: homeBase,
            icon: mapStyles.goldStarBase,
            map: map
        });
        homeControlDiv.index = 1;
        map.controls[google.maps.ControlPosition.TOP_RIGHT].push(homeControlDiv);
        
        var uavFilterDiv = document.createElement('div');
        var uavFilter = new mapStyles.uavFilter(uavFilterDiv, map);
        uavFilterDiv.index = 1;
        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(uavFilterDiv);



        // add event listener
        document.getElementById("goBtn").addEventListener("click", function () {
            if (isNaN(document.getElementById("go_lat").value) || isNaN(document.getElementById("go_long").value) || document.getElementById("go_lat").value == "" || document.getElementById("go_long").value == "") {
                console.log("Need lat lng!");
            }
            else {
                droneTrails.goWaypoint(document.getElementById("go_lat").value, document.getElementById("go_long").value);
            }
            
        });

        $.ajax({
            url: '/api/uavs/getuavinfo',
            success: function (data, textStatus, jqXHR) {
                uavMarkers(data, textStatus, jqXHR);
            }
        });
        
        //SignalR callbacks must be set before the call to connect!
        /* Vehicle Movement */
        vehicleHub = $.connection.vehicleHub;

        vehicleHub.client.WaypointInserted = function (id) {
            console.log("Waypoint Successfully Inserted\nMission Id: " + id);
            if (selectedUAV != null) {
                wpm.updateFlightPath(id);
            }
            
        }

        vehicleHub.client.flightStateUpdate = function (vehicle) {
            uavs[vehicle.Id] = mapFunctions.UpdateVehicle(uavs[vehicle.Id], vehicle);

            // draw trail
            if (selectedUAV && selectedTrail != undefined) {
                if (selectedTrail.length < 2)
                    selectedTrail[selectedTrail.length - 1].setMap(map);
                else
                    selectedTrail[selectedTrail.length - 2].setMap(map);
            }

            if (uavs[vehicle.Id].BatteryCheck < .2) {
                if (warningMessageCounter == 0) {
                    warningMessageCounter++;

                    var eventLog = {
                        uav_id: uavs[vehicle.Id].Id,
                        message: "Low Battery",
                        criticality: "critical",
                        uav_callsign: uavs[vehicle.Id].Callsign,
                        operator_screen_name: assignment.getUsername(),
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

                warningUavId = uavs[vehicle.Id].Id;
            }
        }

        vehicleHub.client.vehicleHasNewMission = function (uavid, schedid, missionid) {
            wpm.vehicleHasNewMission(uavid, schedid, missionid);
        }

        mapDraw.InitDrawingManager();
        mapDraw.drawingManager.setMap(map);
        mapDraw.drawingManager.setDrawingMode(null);
        google.maps.event.addListener(mapDraw.drawingManager, 'overlaycomplete', function (e) { mapDraw.OverlayComplete(e) });

        //Delete shapes and clear selection
        google.maps.event.addListener(mapDraw.drawingManager, 'drawingmode_changed', mapDraw.clearSelection);
        google.maps.event.addListener(map, 'click', mapDraw.clearSelection);
        google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', mapDraw.deleteSelectedShape);
        google.maps.event.addDomListener(document.getElementById('delete-all-button'), 'click', mapDraw.deleteAllShape());
        mapDraw.buildColorPalette(mapDraw.drawingManager);

        /////////////////////////////


        new RestrictedAreasContainer(map, mapDraw.drawingManager)
        /* Event Log */
        var emitHub = $.connection.eventLogHub;

        //show the notification for every one
        emitHub.client.showNote = function (lat, lng, notifier, message) {
            mapFunctions.ConsNotifier(map, lat, lng, notifier, message);

        }

        emitHub.client.newEvent = function (evt) {

            console.log(evt);

            var checkMessage = evt.message.split(" ");
            if (checkMessage[0] != "Acknowledged:") {

                var i = uavs[evt.UAVId].Events;
                i++;
                uavs[evt.UAVId].Events = i;

                var boxText = document.createElement("div");
                boxText.style.cssText = "border: 1px solid black;margin-top: 8px;background: #333;color: #FFF;font-size: 10px;padding: .5em 2em;-webkit-border-radius: 2px;-moz-border-radius: 2px;border-radius: 1px;";
                boxText.innerHTML = "<span style='color: red;'>Warning: </span>" + evt.message;

                var alertText = document.createElement("div");
                alertText.style.cssText = "border: 1px solid red;height: 40px;background: #333;color: #FFF;padding: 0px 0px 15px 4px;-webkit-border-radius: 2px;-moz-border-radius: 2px;border-radius: 1px;"
                alertText.innerHTML = "<span style='color: red; font-size: 30px;'>!</span>";

                var multipleText = document.createElement("div");
                multipleText.style.cssText = "border: 1px solid black;margin-top: 8px;background: #333;color: #FFF;font-size: 10px;padding: .5em 2em;-webkit-border-radius: 2px;-moz-border-radius: 2px;border-radius: 1px;";
                multipleText.innerHTML = "<span style='color: red;'>Warning: </span>" + "multiple errors, check logs!";
                console.log(uavs[evt.UAVId].Events);
                
                if (uavs[evt.UAVId].Events > 1) {
                    var infobox = new InfoBox({
                        content: multipleText,
                        disableAutoPan: false,
                        maxWidth: 100,
                        pixelOffset: new google.maps.Size(-75, 30),
                        zIndex: null,
                        enableEventPropagation: true,
                        pane: "floatPane",
                        boxStyle: {
                            opacity: 0.75,
                            width: "150px"
                        },
                        closeBoxMargin: "9px 1px 2px 2px"
                    })
                    if (uavs[evt.UAVId].infobox != null) {
                        var ibox = new InfoBox();
                        ibox = uavs[evt.UAVId].infobox;
                        ibox.close();
                    }
                    uavs[evt.UAVId].infobox = infobox;
                    infobox.open(map, uavs[evt.UAVId].marker);

                    google.maps.event.addDomListener(multipleText, 'click', function () {
                        if (infobox.open) {
                            infobox.close();

                            var eventACK = {
                                uav_id: uavs[evt.UAVId].Id,
                                message: "Acknowledged: " + evt.message,
                                criticality: "normal",
                                uav_callsign: uavs[evt.UAVId].Callsign,
                                operator_screen_name: evt.operator_screen_name,
                                UAVId: uavs[evt.UAVId].Id
                            };
                            var i = uavs[evt.UAVId].Events;
                            i--;
                            uavs[evt.UAVId].Events = i;
                            emitHub.server.emit(eventACK);
                            $.ajax({
                                type: "POST",
                                url: "/api/uavs/postuavevent",
                                success: function () { },
                                data: eventACK
                            });

                        }
                    });
                }
                else {
                    var infobox = new InfoBox({
                        content: boxText,
                        disableAutoPan: false,
                        maxWidth: 100,
                        pixelOffset: new google.maps.Size(-75, 30),
                        zIndex: null,
                        enableEventPropagation: true,
                        pane: "floatPane",
                        boxStyle: {
                            opacity: 0.75,
                            width: "150px"
                        },
                        closeBoxMargin: "9px 1px 2px 2px"
                    })
                    uavs[evt.UAVId].infobox = infobox;
                    infobox.open(map, uavs[evt.UAVId].marker);

                    google.maps.event.addDomListener(boxText, 'click', function () {
                        if (infobox.open) {
                            infobox.close();

                            var eventACK = {
                                uav_id: uavs[evt.UAVId].Id,
                                message: "Acknowledged: " + evt.message,
                                criticality: "normal",
                                uav_callsign: uavs[evt.UAVId].Callsign,
                                operator_screen_name: evt.operator_screen_name,
                                UAVId: uavs[evt.UAVId].Id
                            };
                            var i = uavs[evt.UAVId].Events;
                            i--;
                            uavs[evt.UAVId].Events = i;
                            emitHub.server.emit(eventACK);
                            $.ajax({
                                type: "POST",
                                url: "/api/uavs/postuavevent",
                                success: function () { },
                                data: eventACK
                            });

                        }
                    });
                }
                if (uavs[evt.UAVId].alertOnce != 1) {
                    var infoboxAlert = new InfoBox({
                        content: alertText,
                        disableAutoPan: false,
                        maxWidth: 20,
                        pixelOffset: new google.maps.Size(-10, -80),
                        zIndex: null,
                        boxStyle: {
                            opacity: 0.75,
                            width: "20px",
                        },
                    })

                    infoboxAlert.open(map, uavs[evt.UAVId].marker);
                    var i = uavs[evt.UAVId].alertOnce;
                    i++;
                    uavs[evt.UAVId].alertOnce = i;
                }
               
                
                //warning popup showing
                mapFunctions.goTo_RR_show();
                document.getElementById('warningUavId').innerHTML = "UAV ID: " + uavs[evt.UAVId].Id + "<br />";
                document.getElementById('warningUavCallsign').innerHTML = "Callsign: " + uavs[evt.UAVId].Callsign + "<br />";
                document.getElementById('warningReason').innerHTML = "Reason: " + evt.message;
            }
        }

        var warningMessageCounter = 0;

        
        //Make sure to set all SignalR callbacks BEFORE the call to connect
        $.connection.hub.start().done(function () {
            console.log("connection started for evt log");
        });

        vehicleHub.connection.start();

        $(window).keydown(function (evt) {
            if (evt.which === 16) {
                mapFunctions.shiftPressed = true;
            if (evt.ctrlKey) {
                ctrlDown = true;
            }
            if (evt.which === 69) {
                console.log("User is: "+ assignment.getUsername());
            }
                //console.log("Shift key down");
            }
            storedGroups = droneSelection.KeyBinding(selectedDrones, storedGroups, evt);
            // console.log("length in goog is: " + selectedDrones.length);
        }).keyup(function (evt) {
            if (evt.which === 16) {
                mapFunctions.shiftPressed = false;
                //console.log("Shift key up");
            }
        });

        google.maps.event.trigger(map, 'resize');
        var mapListeners = map;/// <-----------------------------TODO: Redundant?

        //MAP CONTEXT MENU - Right-click to activate
        var mapContext = mapFunctions.MapContext(map);
        google.maps.event.addListener(map, 'rightclick', function (event) {
            mapContext.show(event.latLng);
        });
        google.maps.event.addListener(mapContext, 'menu_item_selected', function (latLng, eventName) {
            mapFunctions.MapContextSelection(map, latLng, eventName, emitHub);
        });



        google.maps.event.addListener(mapListeners, 'mousemove', function (e) { mapFunctions.DrawBoundingBox(this, e) });
        google.maps.event.addListener(mapListeners, 'mousedown', function (e) { mapFunctions.StopMapDrag(this, e); });
        google.maps.event.addListener(mapListeners, 'mouseup', function (e) { droneSelection.AreaSelect(this, e, mapFunctions.mouseIsDown, mapFunctions.shiftPressed, mapFunctions.gridBoundingBox, selectedDrones, uavs) });
        google.maps.event.addListener(mapListeners, 'dblclick', function (e) {
            console.log("double clicked");
            for (var key in uavs) {
                uavs[key].marker.setIcon(uavs[key].marker.uavSymbolBlack);
            }


        })
    };
    google.maps.event.addDomListener(window, 'load', init);
});


