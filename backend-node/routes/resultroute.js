const express = require("express");
const axios = require("axios");
const Route = require("../models/Route");
const router = express.Router();

/* --------------------------------------------------------
   CONSTANT API URLs
-------------------------------------------------------- */
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const OPENTOPO = "https://api.opentopodata.org/v1/test-dataset";
const OPENMETEO = "https://api.open-meteo.com/v1/forecast";
const OPENCHARGEMAP = "https://api.openchargemap.io/v3/poi/";
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8000/predict";


/* --------------------------------------------------------
   1) GEO LOCATION API HELPER
-------------------------------------------------------- */
const geo = async (place) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    place
  )}`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "route-battery-opt/1.0" },
  });

  if (!data || data.length === 0)
    throw new Error("Geocode failed for " + place);

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
};


/* --------------------------------------------------------
   2) FETCH MULTIPLE ROUTES FROM OSRM
-------------------------------------------------------- */
const getRoutesOSRM = async (startCoord, endCoord) => {
  const url = `${OSRM}${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?overview=full&geometries=geojson&alternatives=true`;
  const { data } = await axios.get(url);

  const routes = (data.routes || []).map((r, i) => ({
    id: i + 1,
    distance_km: parseFloat((r.distance / 1000).toFixed(2)),
    duration_min: Math.round(r.duration / 60),
    geometry: r.geometry,
  }));

  // fallback
  if (routes.length === 0) {
    routes.push({
      id: 1,
      distance_km:
        Math.hypot(
          endCoord.lat - startCoord.lat,
          endCoord.lng - startCoord.lng
        ) * 111,
      duration_min: 60,
      geometry: {
        type: "LineString",
        coordinates: [
          [startCoord.lng, startCoord.lat],
          [endCoord.lng, endCoord.lat],
        ],
      },
    });
  }

  return routes;
};


/* --------------------------------------------------------
   3) SAMPLED COORDS FROM GEOJSON
-------------------------------------------------------- */
const sampleCoordsFromGeojson = (geometry, n = 10) => {
  if (!geometry || geometry.type !== "LineString") return [];
  const coords = geometry.coordinates;
  const step = Math.max(1, Math.floor(coords.length / n));

  return coords
    .filter((_, i) => i % step === 0)
    .map((c) => ({ lat: c[1], lng: c[0] }));
};


/* --------------------------------------------------------
   4) ELEVATION DATA API (OpenTopo)
-------------------------------------------------------- */
const getElevation = async (coords) => {
  try {
    if (!coords || coords.length === 0) return 0;

    const locStr = coords.map((c) => `${c.lat},${c.lng}`).join("|");
    const url = `${OPENTOPO}?locations=${locStr}`;

    const { data } = await axios.get(url);
    const vals = (data.results || []).map((r) => r.elevation || 0);

    let gain = 0;
    for (let i = 1; i < vals.length; i++) {
      const diff = vals[i] - vals[i - 1];
      if (diff > 0) gain += diff;
    }

    return gain;
  } catch (e) {
    return 0;
  }
};


/* --------------------------------------------------------
   5) WEATHER API (Open-Meteo)
-------------------------------------------------------- */
const getWeather = async (lat, lon) => {
  try {
    const url = `${OPENMETEO}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m&current_weather=true`;

    const { data } = await axios.get(url);

    const temp = data.current_weather
      ? data.current_weather.temperature
      : data.hourly.temperature_2m?.[0] || 25;

    const wind = data.current_weather
      ? data.current_weather.windspeed
      : data.hourly.wind_speed_10m?.[0] || 0;

    const precip =
      data.hourly && data.hourly.precipitation
        ? data.hourly.precipitation[0]
        : 0;

    return {
      temp_c: temp,
      wind_speed_m_s: wind,
      precipitation_mm: precip,
    };
  } catch (err) {
    return { temp_c: 25, wind_speed_m_s: 0, precipitation_mm: 0 };
  }
};


/* --------------------------------------------------------
   6) EV CHARGING STATIONS API
-------------------------------------------------------- */
const getChargingStations = async (lat, lon) => {
  try {
    const url = `${OPENCHARGEMAP}?output=json&latitude=${lat}&longitude=${lon}&distance=40&maxresults=5`;

    const { data } = await axios.get(url, {
      headers: {
        "X-API-Key": process.env.OCM_KEY || "30117f1a-a648-4866-acac-44aabdcd1aef",
        "Content-Type": "application/json"
      }
    });

    return (data || []).map((s) => ({
      name: s.AddressInfo ? s.AddressInfo.Title : "Unknown",
      distance_km: s.AddressInfo?.Distance ?? null,
      lat: s.AddressInfo?.Latitude,
      lng: s.AddressInfo?.Longitude,
      address: s.AddressInfo?.AddressLine1 || "",
    }));

  } catch (e) {
    console.error("OpenChargeMap API Error:", e.message);
    return [];
  }
};



/* --------------------------------------------------------
   7) MAIN GET ROUTE BY ID (🔥 FINAL LOGIC)
-------------------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const routeId = req.params.id;

    const saved = await Route.findById(routeId);
    if (!saved) return res.status(404).send("Route not found");

    /* DB se directly lena hai */
    const start = saved.startAddress;
    const end = saved.endAddress;
    const vehicle = saved.vehicle || { battery_kWh: 40, range_km: 320 };

    let startCoord = saved.startCoord;
    let endCoord = saved.endCoord;

    // Fallback: agar DB me coord missing ho toh geocode
    if (!startCoord) startCoord = await geo(start);
    if (!endCoord) endCoord = await geo(end);

    /* -------------------------
       OSRM ROUTES
    ------------------------- */
    const osrmRoutes = await getRoutesOSRM(startCoord, endCoord);

    let enriched = [];

    for (const r of osrmRoutes) {
      const sample = sampleCoordsFromGeojson(r.geometry, 15);
      const elevGain = await getElevation(sample);

      const mid =
        sample[Math.floor(sample.length / 2)] || {
          lat: (startCoord.lat + endCoord.lat) / 2,
          lng: (startCoord.lng + endCoord.lng) / 2,
        };

      const weather = await getWeather(mid.lat, mid.lng);
      const chargers = await getChargingStations(mid.lat, mid.lng);

      enriched.push({
        id: r.id,
        distance_km: r.distance_km,
        duration_min: r.duration_min,
        elevation_gain_m: elevGain,
        temp_c: weather.temp_c,
        wind_speed_m_s: weather.wind_speed_m_s,
        precipitation_mm: weather.precipitation_mm,
        charging_stations: chargers,
        num_chargers: chargers.length,
        geometry: r.geometry,
      });
    }

    /* -------------------------
       ML PAYLOAD
    ------------------------- */
    const mlPayload = enriched.map((r) => ({
      id: r.id,
      features: [
        r.distance_km,
        r.duration_min,
        r.elevation_gain_m,
        r.temp_c,
        r.wind_speed_m_s,
        r.precipitation_mm,
        r.num_chargers,
        vehicle.battery_kWh,
        vehicle.range_km,
      ],
    }));

    /* -------------------------
       ML PREDICTION
    ------------------------- */
    const mlRes = await axios.post(ML_SERVICE, { routes: mlPayload });

    const preds = mlRes.data?.predictions || [];

    /* -------------------------
       MERGE ML WITH ROUTES
    ------------------------- */
    const finalRoutes = enriched.map((r) => {
      const p = preds.find((item) => item.id === r.id);
      return {
        ...r,
        battery_usage_percent: p?.battery_usage_percent || null,
        traffic: p?.traffic || "Unknown",
      };
    });

    // BEST ROUTE
    const sorted = finalRoutes.sort(
      (a, b) => a.battery_usage_percent - b.battery_usage_percent
    );
    const best = sorted[0];

    const output = {
      best_route: best,
      all_routes: finalRoutes,
      recommended: `Route ${best.id}`,
    };
    // console.log(start,end,vehicle , output , finalRoutes);
  
    
    /* -------------------------
       FINAL RENDER
    ------------------------- */
    res.render("result.ejs", {
      input: { start, end, vehicle },
      output,
      routes: finalRoutes,
    });
  } catch (err) {
    console.log("ERROR:", err);
    res.status(500).send("Internal error: " + err.message);
  }
});

module.exports = router;
