const express    = require("express");
const router     = express.Router();
const { Set, Running, Finish, Manual, History } = require("../models/sterilisasi");
const mqttClient = require("../mqtt/mqttClient");

// ── POST /sterilisasi/set ─────────────────────────────────────
// Frontend kirim parameter start → publish ke MQTT sterilisasi/set
router.post("/set", async (req, res) => {
  try {
    const { action, suhu, tekanan, waktu, device, batch_id } = req.body;

    if (!device) {
      return res.status(400).json({ status: "error", message: "Field device wajib diisi" });
    }

    const mqttPayload = {
      action:   action || "start",
      suhu:     suhu    != null ? Number(suhu)    : null,
      tekanan:  tekanan != null ? Number(tekanan) : null,
      waktu,
      Device:   device,
      batch_id: batch_id ?? null, // Include batch_id jika ada
    };

    await mqttClient.publishSet(mqttPayload);

    res.json({ status: "success", message: `Perintah ${action || "start"} berhasil dikirim`, batch_id: batch_id });
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
    const { action, device, suhu, tekanan, batch_id } = req.body;

    if (!device) {
      return res.status(400).json({ status: "error", message: "Field device wajib diisi" });
    }

    // Jika action adalah stop, kirim ke topic sterilisasi/finish
    if (action === "stop" || !action) {
      const mqttPayload = {
        action:   "stop",
        suhu:     suhu     != null ? Number(suhu)     : 0,
        tekanan:  tekanan  != null ? Number(tekanan)  : 0,
        device:   device,
        batch_id: batch_id ?? null, // Include batch_id jika ada
      };

      await mqttClient.publishStop(mqttPayload);

      // Update lastData langsung agar frontend bisa detect stop
      mqttClient.updateLastDataWithStop(device, batch_id);

      return res.json({ 
        status: "success", 
        message: `Perintah stop berhasil dikirim ke topik sterilisasi/finish`,
        batch_id: batch_id 
      });
    }

    // Untuk action lain, kirim ke topic sterilisasi/running
    const mqttPayload = {
      action:   action,
      Device:   device,
      batch_id: batch_id ?? null, // Include batch_id jika ada
    };

    await mqttClient.publishRunning(mqttPayload);

    res.json({ status: "success", message: `Perintah ${action} berhasil dikirim ke topik running`, batch_id: batch_id });
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

// ── GET /sterilisasi/running/batch/:batch_id ──────────────────
// Ambil semua data running berdasarkan batch_id untuk grafik riwayat
router.get("/running/batch/:batch_id", async (req, res) => {
  try {
    const { batch_id } = req.params;

    if (!batch_id) {
      return res.status(400).json({ status: "error", message: "batch_id tidak valid" });
    }

    // Ambil semua data running dengan batch_id yang sama, diurutkan berdasarkan waktu
    const runningData = await Running.find({ batch_id }).sort({ createdAt: 1 });

    res.json({ 
      status: "success", 
      data: runningData,
      count: runningData.length 
    });
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

// ── GET /sterilisasi/histories ────────────────────────────────
// Ambil semua data dari collection histories (yang punya batch_id)
router.get("/histories", async (_req, res) => {
  try {
    const histories = await History.find()
      .sort({ createdAt: -1 })
      .limit(100);
    
    // Transform data untuk frontend
    const data = histories.map(h => ({
      _id: h._id,
      batch_id: h.batch_id,
      device: h.device,
      namaAlat: h.namaAlat,
      suhu: h.set?.suhu ?? 0,
      tekanan: h.set?.tekanan ?? 0,
      waktu: h.set?.waktu ?? "00:00",
      status: h.status,
      action: h.finish?.action ?? null,
      createdAt: h.createdAt,
      notes: h.notes ?? "",
      runningDataCount: h.runningData?.length ?? 0,
    }));
    
    res.json({ status: "success", data });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/histories/:batch_id ──────────────────────
// Ambil satu history lengkap dengan runningData untuk grafik
router.get("/histories/:batch_id", async (req, res) => {
  try {
    const { batch_id } = req.params;
    
    const history = await History.findOne({ batch_id });
    
    if (!history) {
      return res.status(404).json({ 
        status: "error", 
        message: "History not found" 
      });
    }
    
    res.json({ status: "success", data: history });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ── GET /sterilisasi/history ──────────────────────────────────
// DEPRECATED: Masih ada untuk backward compatibility
// Menggabungkan data finish dengan set untuk history lengkap
router.get("/history", async (_req, res) => {
  try {
    const finishData = await Finish.find().sort({ createdAt: -1 }).limit(100);
    
    // Untuk setiap finish, cari set yang sesuai berdasarkan batch_id atau device+waktu
    const history = await Promise.all(
      finishData.map(async (finish) => {
        let matchingSet = null;
        let batchIdToUse = finish.batch_id; // Default: gunakan batch_id dari finish
        
        // Prioritas 1: Cari berdasarkan batch_id jika ada
        if (finish.batch_id) {
          matchingSet = await Set.findOne({
            batch_id: finish.batch_id,
            action: "start"
          }).sort({ createdAt: -1 });
          
          if (matchingSet) {
            console.log(`[History] Match berdasarkan batch_id: ${finish.batch_id}`);
          }
        }
        
        // Prioritas 2: Fallback ke metode lama (device + waktu) jika tidak ada batch_id atau tidak ketemu
        if (!matchingSet) {
          const timeWindow = new Date(finish.createdAt.getTime() - 2 * 60 * 60 * 1000);
          matchingSet = await Set.findOne({
            device: finish.device,
            action: "start",
            createdAt: { $gte: timeWindow, $lte: finish.createdAt }
          }).sort({ createdAt: -1 });
          
          if (matchingSet) {
            console.log(`[History] Match berdasarkan device+waktu untuk device: ${finish.device}`);
            
            // FALLBACK: Jika finish tidak punya batch_id tapi set punya, gunakan dari set
            if (!batchIdToUse && matchingSet.batch_id) {
              batchIdToUse = matchingSet.batch_id;
              console.log(`[History] Menggunakan batch_id dari Set: ${batchIdToUse}`);
            }
          }
        }
        
        // FALLBACK FINAL: Jika masih tidak ada batch_id, coba cari dari running terakhir
        if (!batchIdToUse) {
          const timeWindow = new Date(finish.createdAt.getTime() - 2 * 60 * 60 * 1000);
          const lastRunning = await Running.findOne({
            device: finish.device,
            batch_id: { $ne: null }, // Hanya yang ada batch_id
            createdAt: { $gte: timeWindow, $lte: finish.createdAt }
          }).sort({ createdAt: -1 });
          
          if (lastRunning && lastRunning.batch_id) {
            batchIdToUse = lastRunning.batch_id;
            console.log(`[History] Menggunakan batch_id dari Running: ${batchIdToUse}`);
          }
        }

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
          batch_id: batchIdToUse, // Include batch_id (dari finish, set, atau running)
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
