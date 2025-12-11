const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  startAddress: String,
  endAddress: String,
  startCoord: { lat: Number, lng: Number },
  endCoord: { lat: Number, lng: Number },
  roadDistance: Number,
  roadGeometry: Object,
  vehicle: {
    model: {
      type: String,
      required: false,
    },

    battery_KWh: {
      type: Number,
      required: true,
      min: 1,
    },

    range_km: {
      type: Number,
      required: true,
    },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Route', RouteSchema);
