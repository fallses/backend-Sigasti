const express    = require("express");
const router     = express.Router();
const { Set, Running, Finish, Manual } = require("../models/sterilisasi");
const mqttClient = require("../mqtt/mqttClient");

// ── POST /sterilisasi/set ─────────────────────────────────────
// Frontend kirim parameter start → publish ke MQTT sterilisasi/set
router.post("/set", async (req, res) => {
  try {
    const { action, suhu, tekanan, waktu, device } = req.body;

    if (!device) {
      return res.status(400).json({ status: "error", message: "Field device wajib diisi" });
    }

    const mqttPayload = {
      action:  action || "start",
      suhu:    suhu    != null ? Number(suhu)    : null,
      tekanan: tekanan != null ? Number(tekanan) : null,
      waktu,
      Device:  device,
    };

    await mqttClient.publishSet(mqttPayload);

    res.json({ status: "success", message: `Perintah ${action || "start"} berhasil dikirim` });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/set ──────────────────────────────────────
router.get("/set", async (_req, res) => {
  try {
    const data = await Set.find().sort({ createdAt: -1 }).limit(50);
    res.json({ status: "success", data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/set/last ─────────────────────────────────
router.get("/set/last", async (_req, res) => {
  try {
    const last = await Set.findOne().sort({ createdAt: -1 });
    res.json({ status: "success", data: last });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/running ──────────────────────────────────
router.get("/running", async (_req, res) => {
  try {
    const data = await Running.find().sort({ createdAt: -1 }).limit(50);
    res.json({ status: "success", data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── POST /sterilisasi/running ─────────────────────────────────
// Frontend kirim perintah stop → publish ke topik sterilisasi/running
router.post("/running", async (req, res) => {
  try {
    const { action, device, suhu, tekanan } = req.body;

    if (!device) {
      return res.status(400).json({ status: "error", message: "Field device wajib diisi" });
    }

    // Jika action adalah stop, kirim ke topic sterilisasi/finish
    if (action === "stop" || !action) {
      const mqttPayload = {
        action: "stop",
        suhu:   suhu    != null ? Number(suhu)    : 0,
        tekanan: tekanan != null ? Number(tekanan) : 0,
        device: device,
      };

      await mqttClient.publishStop(mqttPayload);

      // Update lastData langsung agar frontend bisa detect stop
      mqttClient.updateLastDataWithStop(device);

      return res.json({ 
        status: "success", 
        message: `Perintah stop berhasil dikirim ke topik sterilisasi/finish` 
      });
    }

    // Untuk action lain, kirim ke topic sterilisasi/running
    const mqttPayload = {
      action: action,
      Device: device,
    };

    await mqttClient.publishRunning(mqttPayload);

    res.json({ status: "success", message: `Perintah ${action} berhasil dikirim ke topik running` });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/running/last ─────────────────────────────
router.get("/running/last", async (_req, res) => {
  try {
    const last = await Running.findOne().sort({ createdAt: -1 });
    res.json({ status: "success", data: last });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/finish ───────────────────────────────────
router.get("/finish", async (_req, res) => {
  try {
    const data = await Finish.find().sort({ createdAt: -1 }).limit(100);
    res.json({ status: "success", data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/history ──────────────────────────────────
// Menggabungkan data finish dengan set untuk history lengkap
router.get("/history", async (_req, res) => {
  try {
    const finishData = await Finish.find().sort({ createdAt: -1 }).limit(100);
    
    // Untuk setiap finish, cari set yang sesuai (device sama, waktu berdekatan)
    const history = await Promise.all(
      finishData.map(async (finish) => {
        // Cari set dengan device yang sama dan waktu dalam rentang 2 jam sebelum finish
        const timeWindow = new Date(finish.createdAt.getTime() - 2 * 60 * 60 * 1000);
        const matchingSet = await Set.findOne({
          device: finish.device,
          action: "start",
          createdAt: { $gte: timeWindow, $lte: finish.createdAt }
        }).sort({ createdAt: -1 });

        return {
          _id: finish._id,
          action: finish.action || "finish", // Include action dari finish ("finish" atau "stop")
          device: finish.device,
          suhu: matchingSet?.suhu ?? finish.suhu ?? 0,
          tekanan: matchingSet?.tekanan ?? finish.tekanan ?? 0,
          waktu: matchingSet?.waktu ?? finish.waktu ?? "00:00",
          finishSuhu: finish.suhu,
          finishTekanan: finish.tekanan,
          createdAt: finish.createdAt,
          notes: finish.notes || "",
        };
      })
    );

    res.json({ status: "success", data: history });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/finish/last ──────────────────────────────
// Ambil data finish dari memory dan CONSUME setelah dibaca
router.get("/finish/last", async (_req, res) => {
  try {
    const lastFinish = mqttClient.getLastFinishData();

    if (!lastFinish) {
      return res.json({ status: "success", data: null });
    }

    // Copy dulu sebelum di-consume agar tidak hilang karena race condition
    const dataToSend = { ...lastFinish };
    mqttClient.consumeFinish();

    console.log("[GET /sterilisasi/finish/last] Data finish di-consume:", JSON.stringify(dataToSend));

    res.json({ status: "success", data: dataToSend });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── DELETE /sterilisasi/history/:id ───────────────────────────
// Hapus riwayat berdasarkan ID
router.delete("/history/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ status: "error", message: "ID tidak valid" });
    }

    const deleted = await Finish.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Data tidak ditemukan" });
    }

    res.json({ status: "success", message: "Riwayat berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── PATCH /sterilisasi/history/:id ────────────────────────────
// Update catatan riwayat berdasarkan ID
router.patch("/history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!id) {
      return res.status(400).json({ status: "error", message: "ID tidak valid" });
    }

    const updated = await Finish.findByIdAndUpdate(
      id,
      { notes: notes || "" },
      { returnDocument: 'after' } // Updated: use returnDocument instead of new
    );

    if (!updated) {
      return res.status(404).json({ status: "error", message: "Data tidak ditemukan" });
    }

    res.json({ status: "success", message: "Catatan berhasil diupdate", data: updated });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── POST /sterilisasi/manual ──────────────────────────────────
// Frontend kirim perintah manual control → publish ke MQTT sterilisasi/manual
router.post("/manual", async (req, res) => {
  try {
    const { valve, gas, starter, suhureal, tekananreal, device } = req.body;

    if (!device) {
      return res.status(400).json({ status: "error", message: "Field device wajib diisi" });
    }

    // Validasi nilai valve
    if (valve && !["OPEN", "CLOSE"].includes(valve)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Nilai valve harus OPEN atau CLOSE" 
      });
    }

    // Validasi nilai gas
    if (gas && !["TUTUP", "KECIL", "SEDANG", "BESAR"].includes(gas)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Nilai gas harus TUTUP, KECIL, SEDANG, atau BESAR" 
      });
    }

    // Validasi nilai starter
    if (starter && !["ON", "OFF"].includes(starter)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Nilai starter harus ON atau OFF" 
      });
    }

    const mqttPayload = {
      valve:       valve       ?? null,
      gas:         gas         ?? null,
      starter:     starter     ?? null,
      suhureal:    suhureal    != null ? Number(suhureal)    : null,
      tekananreal: tekananreal != null ? Number(tekananreal) : null,
      device:      device,
    };

    await mqttClient.publishManual(mqttPayload);

    res.json({ 
      status: "success", 
      message: "Perintah manual control berhasil dikirim",
      data: mqttPayload
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/manual/last ──────────────────────────────
// Ambil data manual control terbaru dari memory
router.get("/manual/last", async (_req, res) => {
  try {
    const lastManual = mqttClient.getLastManualData();
    res.json({ status: "success", data: lastManual });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/manual ───────────────────────────────────
// History manual control - DISABLED (data tidak disimpan ke database)
router.get("/manual", async (_req, res) => {
  res.json({ 
    status: "info", 
    message: "History manual control tidak tersedia. Data hanya disimpan di memory untuk real-time access.",
    data: [] 
  });
});

module.exports = router;
