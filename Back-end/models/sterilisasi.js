const mongoose = require("mongoose");

// ── Koleksi: data dari topik sterilisasi/set ──────────────
// Menyimpan perintah yang dikirim dari aplikasi ke alat
const setSchema = new mongoose.Schema({
  action:   { type: String },
  suhu:     { type: Number },
  tekanan:  { type: Number },
  waktu:    { type: mongoose.Schema.Types.Mixed },
  device:   { type: String },
  namaAlat: { type: String, default: "" },
  status:   { type: String, default: "unknown" },
  createdAt:{ type: Date, default: Date.now },
});

// ── Koleksi: data dari topik sterilisasi/running ──────────
// Menyimpan status proses yang dikirim alat ke backend
const runningSchema = new mongoose.Schema({
  action:   { type: String },
  suhu:     { type: Number },
  tekanan:  { type: Number },
  waktu:    { type: mongoose.Schema.Types.Mixed },
  timer:    { type: String }, // Timer dari alat (format: "00:00:00")
  device:   { type: String },
  sesi:     { type: String },
  status:   { type: String },
  createdAt:{ type: Date, default: Date.now },
});

// ── Koleksi: data dari topik sterilisasi/finish ───────────
// Menyimpan data saat proses selesai
const finishSchema = new mongoose.Schema({
  suhu:     { type: Number },
  tekanan:  { type: Number },
  waktu:    { type: mongoose.Schema.Types.Mixed },
  device:   { type: String },
  createdAt:{ type: Date, default: Date.now },
});

const Set     = mongoose.model("Set",     setSchema);
const Running = mongoose.model("Running", runningSchema);
const Finish  = mongoose.model("Finish",  finishSchema);

module.exports = { Set, Running, Finish };
