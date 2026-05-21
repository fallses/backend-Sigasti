require("dotenv").config();
const mqtt   = require("mqtt");
const broker = "mqtt://broker.hivemq.com";
const { Set, Running, Finish, Manual } = require("../models/sterilisasi");

/**
 * TOPIK MQTT:
 *
 * SUBSCRIBE (menerima dari perangkat):
 *   sterilisasi/running  — respon proses (countdown, running, ignition)
 *   sterilisasi/finish   — sinyal selesai dari perangkat
 *   sterilisasi/set      — logging perintah yang dikirim ke perangkat
 *   sterilisasi/manual   — logging perintah manual control
 *
 * PUBLISH (mengirim ke perangkat):
 *   sterilisasi/set      — perintah start dari aplikasi
 *   sterilisasi/finish   — perintah stop dari aplikasi
 *   sterilisasi/manual   — perintah manual control (valve, gas, starter)
 */

const SUBSCRIBE_TOPIC = "sterilisasi/running";
const FINISH_TOPIC    = "sterilisasi/finish";
const SET_TOPIC       = "sterilisasi/set";
const MANUAL_TOPIC    = "sterilisasi/manual";
const PUBLISH_TOPIC   = "sterilisasi/set";

const client = mqtt.connect(broker);

let lastData       = null;
let lastFinishData = null;
let lastManualData = null; // Data manual control terbaru
let finishConsumed = false;
let finishTimestamp = null; // Timestamp kapan finish diterima
const FINISH_LOCK_DURATION = 5000; // 5 detik setelah finish, abaikan running

client.on("connect", () => {
  console.log("MQTT Terhubung ✅ →", broker);

  client.subscribe(SUBSCRIBE_TOPIC, (err) => {
    if (!err) console.log("Subscribe ke topic:", SUBSCRIBE_TOPIC);
    else console.error("Gagal subscribe:", err.message);
  });

  client.subscribe(FINISH_TOPIC, (err) => {
    if (!err) console.log("Subscribe ke topic:", FINISH_TOPIC);
    else console.error("Gagal subscribe:", err.message);
  });

  client.subscribe(SET_TOPIC, (err) => {
    if (!err) console.log("Subscribe ke topic:", SET_TOPIC);
    else console.error("Gagal subscribe:", err.message);
  });

  client.subscribe(MANUAL_TOPIC, (err) => {
    if (!err) console.log("Subscribe ke topic:", MANUAL_TOPIC);
    else console.error("Gagal subscribe:", err.message);
  });
});

client.on("message", async (receivedTopic, message) => {
  const raw = message.toString();
  console.log(`[${receivedTopic}] Data masuk:`, raw);

  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    console.warn("Payload bukan JSON, diabaikan");
    return;
  }

  // ── Topik sterilisasi/set ─────────────────────────────────
  if (receivedTopic === SET_TOPIC) {
    const action = data.action ?? null;
    console.log(`[sterilisasi/set] Menerima perintah: ${action}`);
    try {
      const setData = {
        action,
        device:   data.Device  ?? data.device ?? "unknown",
        namaAlat: data.namaAlat ?? "",
        status:   action === "start" ? "running" : (action === "stop" ? "dihentikan" : "unknown"),
      };
      if (data.suhu    != null) setData.suhu    = data.suhu;
      if (data.tekanan != null) setData.tekanan = data.tekanan;
      if (data.waktu   != null) setData.waktu   = data.waktu;
      await new Set(setData).save();
      console.log(`[sterilisasi/set] Disimpan: action=${action}`);
    } catch (error) {
      console.error("[sterilisasi/set] Gagal simpan:", error.message);
    }
    return;
  }

  // ── Topik sterilisasi/finish ──────────────────────────────
  if (receivedTopic === FINISH_TOPIC) {
    const action = data.action ?? "finish"; // Default action adalah "finish"
    
    lastFinishData = {
      action:  action, // Bisa "finish" atau "stop"
      suhu:    data.suhu    ?? null,
      tekanan: data.tekanan ?? null,
      waktu:   data.waktu   ?? null,
      device:  data.Device  ?? data.device ?? null,
    };
    finishConsumed = false;
    finishTimestamp = Date.now(); // Catat waktu finish diterima
    console.log(`[sterilisasi/finish] lastFinishData diperbarui (action=${action}):`, lastFinishData);
    
    // Update lastData juga agar frontend bisa detect action finish/stop
    lastData = {
      action:    action,
      suhu:      data.suhu    ?? null,
      tekanan:   data.tekanan ?? null,
      waktu:     data.waktu   ?? null,
      timer:     null,
      device:    data.Device  ?? data.device ?? null,
      sesi:      null,
      status:    null,
      percobaan: null,
    };
    console.log(`[sterilisasi/finish] lastData diperbarui dengan action ${action}:`, lastData);
    
    try {
      await new Finish(lastFinishData).save();
      console.log(`[sterilisasi/finish] Disimpan ke collection Finish (action=${action})`);
    } catch (error) {
      console.error("[sterilisasi/finish] Gagal simpan:", error.message);
    }
    return;
  }

  // ── Topik sterilisasi/manual ──────────────────────────────
  if (receivedTopic === MANUAL_TOPIC) {
    // ANTI-LOOP: Abaikan message yang dikirim oleh backend sendiri
    if (data.source === "backend") {
      console.log("[sterilisasi/manual] Message dari backend sendiri, diabaikan (anti-loop)");
      return;
    }

    lastManualData = {
      valve:       data.valve       ?? null,
      gas:         data.gas         ?? null,
      starter:     data.starter     ?? null,
      suhureal:    data.suhureal    ?? null,
      tekananreal: data.tekananreal ?? null,
      device:      data.device      ?? data.Device ?? null,
      source:      data.source      ?? "device", // Track source
    };
    console.log("[sterilisasi/manual] lastManualData diperbarui (source: device, TIDAK disimpan ke DB):", lastManualData);
    
    // TIDAK DISIMPAN KE DATABASE - hanya di memory untuk real-time access
    // try {
    //   await new Manual(lastManualData).save();
    //   console.log("[sterilisasi/manual] Disimpan ke collection Manual");
    // } catch (error) {
    //   console.error("[sterilisasi/manual] Gagal simpan:", error.message);
    // }
    return;
  }

  // ── Topik sterilisasi/running ─────────────────────────────
  const action = data.action ?? null;
  if (!action) {
    console.warn("Tidak ada field action, diabaikan");
    return;
  }

  const validActions = ["countdown", "running", "ignition", "ignition_failed", "stop"];
  if (!validActions.includes(action)) {
    console.warn("Action tidak dikenali:", action);
    return;
  }

  // WORKAROUND: Abaikan data running jika baru saja menerima finish (dalam 5 detik)
  if (action === "running" && finishTimestamp && (Date.now() - finishTimestamp < FINISH_LOCK_DURATION)) {
    console.warn(`[WORKAROUND] Data running diabaikan karena finish baru diterima ${Date.now() - finishTimestamp}ms yang lalu`);
    return;
  }

  lastData = {
    action,
    suhu:      data.suhu      ?? null,
    tekanan:   data.tekanan   ?? null,
    waktu:     data.waktu     ?? null, // Tidak menggunakan fallback, biarkan null jika tidak ada
    timer:     data.timer     ?? null, // Timer dari alat (format: "00:00:00")
    device:    data.Device    ?? data.device ?? null,
    sesi:      data.sesi      ?? null,
    status:    data.status    ?? null,
    percobaan: data.percobaan ?? null, // Jumlah percobaan ignition (untuk ignition_failed)
  };
  console.log("lastData diperbarui:", lastData);

  try {
    await new Running(lastData).save();
    console.log(`[sterilisasi/running] Disimpan: action=${action}`);
  } catch (error) {
    console.error("[sterilisasi/running] Gagal simpan:", error.message);
  }
});

module.exports = {
  client,
  getLastData:       () => lastData,
  consumeAction:     () => { if (lastData) lastData.action = null; },
  getLastFinishData: () => lastFinishData,
  consumeFinish:     () => { lastFinishData = null; finishConsumed = true; },
  isFinishConsumed:  () => finishConsumed,
  getLastManualData: () => lastManualData,
  PUBLISH_TOPIC,
  MANUAL_TOPIC,
  updateLastDataWithStop: (device) => {
    lastData = {
      action:    "stop",
      suhu:      null,
      tekanan:   null,
      waktu:     null,
      timer:     null,
      device:    device ?? null,
      sesi:      null,
      status:    null,
      percobaan: null,
    };
    console.log("[MQTT] lastData diperbarui dengan action stop (dari frontend):", lastData);
  },
  publishSet: (payload) => {
    return new Promise((resolve, reject) => {
      client.publish(PUBLISH_TOPIC, JSON.stringify(payload), (err) => {
        if (err) reject(err);
        else { console.log(`[PUBLISH] ${PUBLISH_TOPIC}:`, JSON.stringify(payload)); resolve(); }
      });
    });
  },
  publishStop: (payload) => {
    return new Promise((resolve, reject) => {
      client.publish(FINISH_TOPIC, JSON.stringify(payload), (err) => {
        if (err) reject(err);
        else { console.log(`[PUBLISH] ${FINISH_TOPIC}:`, JSON.stringify(payload)); resolve(); }
      });
    });
  },
  publishManual: (payload) => {
    return new Promise((resolve, reject) => {
      // Tambahkan field source: "backend" untuk anti-loop
      const payloadWithSource = {
        ...payload,
        source: "backend"
      };
      
      client.publish(MANUAL_TOPIC, JSON.stringify(payloadWithSource), (err) => {
        if (err) reject(err);
        else { console.log(`[PUBLISH] ${MANUAL_TOPIC}:`, JSON.stringify(payloadWithSource)); resolve(); }
      });
    });
  },
  publishRunning: (payload) => {
    return new Promise((resolve, reject) => {
      client.publish(SUBSCRIBE_TOPIC, JSON.stringify(payload), (err) => {
        if (err) reject(err);
        else { console.log(`[PUBLISH] ${SUBSCRIBE_TOPIC}:`, JSON.stringify(payload)); resolve(); }
      });
    });
  },
};
