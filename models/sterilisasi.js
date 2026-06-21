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
  batch_id: { type: String }, // ID unik untuk membedakan proses
  createdAt:{ type: Date, default: Date.now },
});

// ── Koleksi: data dari topik sterilisasi/running ──────────
// Menyimpan status proses yang dikirim alat ke backend
const runningSchema = new mongoose.Schema({
  action:    { type: String },
  suhu:      { type: Number },
  tekanan:   { type: Number },
  waktu:     { type: mongoose.Schema.Types.Mixed },
  timer:     { type: String }, // Timer dari alat (format: "00:00:00")
  device:    { type: String },
  sesi:      { type: String },
  status:    { type: String },
  percobaan: { type: Number }, // Jumlah percobaan ignition (untuk ignition_failed)
  batch_id:  { type: String }, // ID unik untuk membedakan proses
  createdAt: { type: Date, default: Date.now },
});

// ── Koleksi: data dari topik sterilisasi/finish ───────────
// Menyimpan data saat proses selesai atau dihentikan
const finishSchema = new mongoose.Schema({
  action:    { type: String, default: "finish" }, // "finish" atau "stop"
  suhu:      { type: Number },
  tekanan:   { type: Number },
  waktu:     { type: mongoose.Schema.Types.Mixed },
  device:    { type: String },
  notes:     { type: String, default: "" }, // Catatan user untuk riwayat
  batch_id:  { type: String }, // ID unik untuk membedakan proses
  createdAt: { type: Date, default: Date.now },
});

// ── Koleksi: data dari topik sterilisasi/manual ───────────
// Menyimpan perintah manual control (valve, gas, starter) dan data real-time (suhu, tekanan)
const manualSchema = new mongoose.Schema({
  valve:       { type: String }, // "OPEN" atau "CLOSE"
  gas:         { type: String }, // "TUTUP", "KECIL", "SEDANG", "BESAR"
  starter:     { type: String }, // "ON" atau "OFF"
  suhureal:    { type: Number }, // Suhu real-time dari alat
  tekananreal: { type: Number }, // Tekanan real-time dari alat
  device:      { type: String },
  source:      { type: String, default: "device" }, // "device" atau "backend" (anti-loop)
  createdAt:   { type: Date, default: Date.now },
});

// ── Koleksi BARU: histories ────────────────────────────────
// Menyimpan semua data proses dalam satu document berdasarkan batch_id
const historySchema = new mongoose.Schema({
  batch_id: { type: String, required: true, unique: true, index: true }, // Primary key
  device:   { type: String, required: true },
  namaAlat: { type: String, default: "" },
  
  // Data dari SET (awal proses)
  set: {
    suhu:       { type: Number },
    tekanan:    { type: Number },
    waktu:      { type: String },
    startedAt:  { type: Date },
  },
  
  // Data RUNNING (array untuk grafik)
  runningData: [{
    suhu:      { type: Number },
    tekanan:   { type: Number },
    timer:     { type: String },
    timestamp: { type: Date, default: Date.now },
    _id: false // Disable _id untuk subdocument
  }],
  
  // Data FINISH
  finish: {
    action:     { type: String }, // "finish" atau "stop"
    suhu:       { type: Number },
    tekanan:    { type: Number },
    finishedAt: { type: Date },
  },
  
  status: { 
    type: String, 
    enum: ['running', 'completed', 'stopped'],
    default: 'running'
  },
  notes: { type: String, default: "" },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Set     = mongoose.model("Set",     setSchema);
const Running = mongoose.model("Running", runningSchema);
const Finish  = mongoose.model("Finish",  finishSchema);
const Manual  = mongoose.model("Manual",  manualSchema);
const History = mongoose.model("History", historySchema);

module.exports = { Set, Running, Finish, Manual, History };
