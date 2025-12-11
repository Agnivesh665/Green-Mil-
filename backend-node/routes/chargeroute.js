const express = require("express");
const axios = require("axios");
const Route = require("../models/Route");
const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const routeId = req.params.id;

    // 1️⃣ DB se route dhoondo
    const savedRoute = await Route.findById(routeId);
    if (!savedRoute) {
      return res.status(404).send("Route not found!");
    }

    const startCoord = savedRoute.startCoord;
    const endCoord = savedRoute.endCoord;

    if (!startCoord || !endCoord) {
      return res.status(400).send("Coordinates missing in DB. Cannot fetch chargers.");
    }

    // 2️⃣ Midpoint for charging-stations
    const mid = {
      lat: (startCoord.lat + endCoord.lat) / 2,
      lng: (startCoord.lng + endCoord.lng) / 2
    };

    // 3️⃣ Charging Stations Fetch (API KEY REQUIRED)
    const url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${mid.lat}&longitude=${mid.lng}&distance=50&maxresults=10`;

    const { data } = await axios.get(url, {
      headers: {
        "X-API-Key": process.env.OCM_KEY || "30117f1a-a648-4866-acac-44aabdcd1aef",   // 👈 API key added here
        "Content-Type": "application/json"
      }
    });

    // shape array
    const stations = (data || []).map((s) => ({
      name: s.AddressInfo?.Title || "Unknown Station",
      address: s.AddressInfo?.AddressLine1 || "No address",
      distance_km: s.AddressInfo?.Distance || null,
      lat: s.AddressInfo?.Latitude,
      lng: s.AddressInfo?.Longitude
    }));

    // 4️⃣ render view
    res.render("charging.ejs", {
      routeId,
      start: savedRoute.startAddress,
      end: savedRoute.endAddress,
      stations
    });

  } catch (err) {
    console.error("CHARGING ROUTE ERROR:", err.message);
    res.status(500).send("Internal Server Error: " + err.message);
  }
});

module.exports = router;
