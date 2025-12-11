const express = require("express");
const axios = require("axios");
const Route = require("../models/Route");
const router = express.Router();

router.post("/route", async (req, res) => {
  const { start, end, vehicle } = req.body;

  // 1️⃣ Geocoding (Nominatim)
  const geo = async (place) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${place}`;
    const { data } = await axios.get(url);

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  };

  const startCoord = await geo(start);
  const endCoord = await geo(end);

  // 2️⃣ OSRM → Real ROAD route
  const osrmURL = `https://router.project-osrm.org/route/v1/driving/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?overview=full&geometries=geojson`;

  const osrmRes = await axios.get(osrmURL);
  const routeData = osrmRes.data.routes[0];

  const roadDistance = (routeData.distance / 1000).toFixed(2); 
  const roadGeometry = routeData.geometry;

  // 🚀 3️⃣ Save route in DB WITH VEHICLE
  const newRoute = await Route.create({
    startAddress: start,
    endAddress: end,
    startCoord,
    endCoord,
    roadDistance,
    roadGeometry,

    vehicle: {
      model: vehicle.model,
      battery_KWh: vehicle.battery_KWh,
      range_km: vehicle.range_km
    }
  });
   console.log("New Route Saved:", newRoute);

  // 4️⃣ Render EJS with saved data
  res.redirect(`/route/${newRoute._id}`);
});

router.get("/route/:id", async (req, res) => {
  const route = await Route.findById(req.params.id);
  res.render("index.ejs", { route:route });
});

module.exports = router;
