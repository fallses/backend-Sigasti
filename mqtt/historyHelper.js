const { History } = require("../models/sterilisasi");

/**
 * Helper functions untuk mengelola collection History
 */

/**
 * Buat history baru saat menerima SET (start)
 */
async function createHistory(data) {
  const batchId = data.batch_id;
  
  if (!batchId) {
    console.log("[History] Tidak ada batch_id, skip create history");
    return null;
  }
  
  try {
    const history = await History.create({
      batch_id: batchId,
      device: data.Device ?? data.device,
      namaAlat: data.namaAlat ?? "",
      set: {
        suhu: data.suhu ?? null,
        tekanan: data.tekanan ?? null,
        waktu: data.waktu ?? null,
        startedAt: new Date(),
      },
      runningData: [],
      status: 'running',
    });
    
    console.log(`[History] ✅ Created: batch_id=${batchId}`);
    return history;
  } catch (error) {
    if (error.code === 11000) {
      console.log(`[History] Sudah ada: batch_id=${batchId}`);
    } else {
      console.error("[History] Error create:", error.message);
    }
    return null;
  }
}

/**
 * Tambah data running ke history
 */
async function addRunningData(data) {
  const batchId = data.batch_id;
  
  if (!batchId) {
    return null;
  }
  
  try {
    const history = await History.findOneAndUpdate(
      { batch_id: batchId },
      {
        $push: {
          runningData: {
            suhu: data.suhu ?? null,
            tekanan: data.tekanan ?? null,
            timer: data.timer ?? null,
            timestamp: new Date(),
          }
        },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    
    if (history) {
      console.log(`[History] ✅ Running data added: batch_id=${batchId}, total=${history.runningData.length}`);
    } else {
      console.log(`[History] ⚠️  History not found for batch_id=${batchId}`);
    }
    
    return history;
  } catch (error) {
    console.error("[History] Error add running:", error.message);
    return null;
  }
}

/**
 * Update history dengan data finish
 */
async function finishHistory(data) {
  const batchId = data.batch_id;
  
  if (!batchId) {
    return null;
  }
  
  const action = data.action ?? "finish";
  const newStatus = action === "stop" ? "stopped" : "completed";
  
  try {
    const history = await History.findOneAndUpdate(
      { batch_id: batchId },
      {
        $set: {
          finish: {
            action: action,
            suhu: data.suhu ?? null,
            tekanan: data.tekanan ?? null,
            finishedAt: new Date(),
          },
          status: newStatus,
          updatedAt: new Date(),
        }
      },
      { new: true }
    );
    
    if (history) {
      console.log(`[History] ✅ Finished: batch_id=${batchId}, status=${newStatus}`);
    } else {
      console.log(`[History] ⚠️  History not found for batch_id=${batchId}`);
    }
    
    return history;
  } catch (error) {
    console.error("[History] Error finish:", error.message);
    return null;
  }
}

module.exports = {
  createHistory,
  addRunningData,
  finishHistory,
};
