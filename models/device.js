const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deviceId: String,
  deviceName: String,
});

module.exports = mongoose.model("Device", DeviceSchema);
