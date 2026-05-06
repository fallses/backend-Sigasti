const mongoose = require("mongoose");

const dataSchema = new mongoose.Schema({
  suhu: Number,
  tekanan: Number,
  action: String,
  waktu: String,
  device: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Data", dataSchema);