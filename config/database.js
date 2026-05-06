const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Support both MONGODB_URI (Railway default) and MONGO_URI (local .env)
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error("❌ MONGODB_URI atau MONGO_URI tidak ditemukan!");
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