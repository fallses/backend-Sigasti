require("dotenv").config();
const mqtt   = require("mqtt");
const broker = "mqtt://broker.hivemq.com";
const { Set, Running, Finish } = require("../models/sterilisasi");

/**
 * TOPIK MQTT:
 *
 * SUBSCRIBE (menerima dari perangkat):
 *   sterilisasi/running  — respon proses (countdown, running, ignition)
 *   sterilisasi/finish   — sinyal selesai dari perangkat
 *   sterilisasi/set      — logging perintah yang dikirim ke perangkat
 *
 * PUBLISH (mengirim ke perangkat):
 *   sterilisasi/set      — perintah start dari aplikasi
 *   sterilisasi/running  — perintah stop dari aplikasi
 */

const SUBSCRIBE_TOPIC = "sterilisasi/running";
const FINISH_TOPIC    = "sterilisasi/finish";
const SET_TOPIC       = "sterilisasi/set";
const PUBLISH_TOPIC   = "sterilisasi/set";

const client = mqtt.connect(broker);

let lastData       = null;
let lastFinishData = null;
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
    lastFinishData = {
      suhu:    data.suhu    ?? null,
      tekanan: data.tekanan ?? null,
      waktu:   data.waktu   ?? null, // Tidak menggunakan fallback
      device:  data.Device  ?? data.device ?? null,
    };
    finishConsumed = false;
    finishTimestamp = Date.now(); // Catat waktu finish diterima
    console.log("lastFinishData diperbarui:", lastFinishData);
    
    // Update lastData juga agar frontend bisa detect action finish
    lastData = {
      action:  "finish",
      suhu:    data.suhu    ?? null,
      tekanan: data.tekanan ?? null,
      waktu:   data.waktu   ?? null,
      timer:   null,
      device:  data.Device  ?? data.device ?? null,
      sesi:    null,
      status:  null,
    };
    console.log("lastData diperbarui dengan action finish:", lastData);
    
    try {
      await new Finish(lastFinishData).save();
      console.log("[sterilisasi/finish] Disimpan ke collection Finish");
    } catch (error) {
      console.error("[sterilisasi/finish] Gagal simpan:", error.message);
    }
    return;
  }

  // ── Topik sterilisasi/running ─────────────────────────────
  const action = data.action ?? null;
  if (!action) {
    console.warn("Tidak ada field action, diabaikan");
    return;
  }

  const validActions = ["countdown", "running", "ignition", "stop"];
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
    suhu:    data.suhu    ?? null,
    tekanan: data.tekanan ?? null,
    waktu:   data.waktu   ?? null, // Tidak menggunakan fallback, biarkan null jika tidak ada
    timer:   data.timer   ?? null, // Timer dari alat (format: "00:00:00")
    device:  data.Device  ?? data.device ?? null,
    sesi:    data.sesi    ?? null,
    status:  data.status  ?? null,
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
  PUBLISH_TOPIC,
  updateLastDataWithStop: (device) => {
    lastData = {
      action:  "stop",
      suhu:    null,
      tekanan: null,
      waktu:   null,
      timer:   null,
      device:  device ?? null,
      sesi:    null,
      status:  null,
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
  publishRunning: (payload) => {
    return new Promise((resolve, reject) => {
      client.publish(SUBSCRIBE_TOPIC, JSON.stringify(payload), (err) => {
        if (err) reject(err);
        else { console.log(`[PUBLISH] ${SUBSCRIBE_TOPIC}:`, JSON.stringify(payload)); resolve(); }
      });
    });
  },
};
