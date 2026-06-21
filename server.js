require("dotenv").config(); // Load env vars PERTAMA KALI

const express    = require("express");
const cors       = require("cors");
const connectDB  = require("./config/database");

// Inisialisasi MQTT client (subscribe otomatis saat require)
require("./mqtt/mqttClient");

const sterilisasiRouter = require("./routes/sterilisasi");

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// ── Routes ────────────────────────────────────────────────
app.use("/sterilisasi", sterilisasiRouter);

app.get("/", (_req, res) => res.send("Backend MQTT Aktif 🚀"));

// ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di http://localhost:${PORT}`));
