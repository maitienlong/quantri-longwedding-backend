const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");
    try {
      const { ensureDefaultSizes } = require("../services/kichThuocAnh.service");
      await ensureDefaultSizes();
    } catch (e) {
      console.warn("Could not seed default photo sizes:", e.message);
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
