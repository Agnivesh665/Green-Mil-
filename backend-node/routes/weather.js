const express = require("express");
const axios = require("axios");
const Route = require("../models/Route");
const router = express.Router();

router.get("/:id", async (req, res) => {
    const { id } = req.params;

    const route = await Route.findById(id);

    const { lat, lng } = route.startCoord;

    // Open-Meteo API
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=visibility,windspeed_10m,temperature_2m,precipitation_probability`;

    const { data } = await axios.get(url);

    const weather = {
        temperature: data.current_weather.temperature,  // °C
        windspeed: data.current_weather.windspeed,      // mph
        windDirection: data.current_weather.winddirection,
        visibility: data.hourly.visibility[0] / 1000,   // m → km
        rainChance: data.hourly.precipitation_probability[0], // %
        weatherCode: data.current_weather.weathercode
    };

    res.render("weather.ejs", { route, weather });
});

module.exports = router;
