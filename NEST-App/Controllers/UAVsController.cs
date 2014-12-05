﻿using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;
using System.Web.Mvc;
using System.Web;
using NEST_App.DAL;
using NEST_App.Models;

namespace NEST_App.Controllers
{
    public class UAVsController : Controller
    {
        private NestDbContext db = new NestDbContext();

        // GET: UAVs/Index
        public ActionResult Index()
        {
            dynamic uavDetailList = new System.Dynamic.ExpandoObject();
            uavDetailList.UAVs = db.UAVs.ToList();
            uavDetailList.FlightStates = db.FlightStates.ToList();
            return View(uavDetailList);
        }
    }
}

namespace NEST_App.Controllers.Api
{
    public class UAVsController : ApiController
    {
        private NestDbContext db = new NestDbContext();

        // GET: api/UAVs
        public IQueryable<UAV> GetUAVs()
        {
            return db.UAVs;
        }

        // GET: api/UAVs/5
        [ResponseType(typeof(UAV))]
        public async Task<IHttpActionResult> GetUAV(int id)
        {
            UAV uAV = await db.UAVs.FindAsync(id);
            if (uAV == null)
            {
                return NotFound();
            }

            return Ok(uAV);
        }

        // PUT: api/UAVs/5
        [ResponseType(typeof(void))]
        public async Task<IHttpActionResult> PutUAV(int id, UAV uAV)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (id != uAV.Id)
            {
                return BadRequest();
            }

            db.Entry(uAV).State = System.Data.Entity.EntityState.Modified;

            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UAVExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return StatusCode(HttpStatusCode.NoContent);
        }

        // POST: api/UAVs
        [ResponseType(typeof(UAV))]
        public async Task<IHttpActionResult> PostUAV(UAV uAV)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            db.UAVs.Add(uAV);
            await db.SaveChangesAsync();

            return CreatedAtRoute("DefaultApi", new { id = uAV.Id }, uAV);
        }

        // DELETE: api/UAVs/5
        [ResponseType(typeof(UAV))]
        public async Task<IHttpActionResult> DeleteUAV(int id)
        {
            UAV uAV = await db.UAVs.FindAsync(id);
            if (uAV == null)
            {
                return NotFound();
            }

            db.UAVs.Remove(uAV);
            await db.SaveChangesAsync();

            return Ok(uAV);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                db.Dispose();
            }
            base.Dispose(disposing);
        }

        private bool UAVExists(int id)
        {
            return db.UAVs.Count(e => e.Id == id) > 0;
        }
    }
}