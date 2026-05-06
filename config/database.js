const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error("❌ MONGO_URI tidak ditemukan di environment variables!");
      console.log("Available env vars:", Object.keys(process.env).filter(k => k.includes('MONGO')));
      process.exit(1);
    }
    
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("MongoDB Connected ✅");
  } catch (error) {
    console.error("MongoDB Error ❌:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;