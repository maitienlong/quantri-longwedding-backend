const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const DATABASE_URL = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
console.log("Connecting to Database URL:", DATABASE_URL);

mongoose.connect(DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("MongoDB connected successfully!");
    const HopDong = require("../src/models/hopDong.model");
    
    // Find a contract that is stage 1 and service 5
    let contract = await HopDong.findOne({ giaiDoan: 1, dichVuChinh: 5 });
    if (!contract) {
      console.log("No stage 1 & service 5 contract found. Creating a temporary one...");
      contract = new HopDong({
        maHopDong: "TEST-TEMP-" + Date.now(),
        ngayHopDong: new Date(),
        khachHang1: new mongoose.Types.ObjectId(), // Dummy ID
        gioHang: [],
        giaiDoan: 1,
        dichVuChinh: 5
      });
      await contract.save();
      console.log("Created temporary contract:", contract.maHopDong);
    } else {
      console.log("Found existing contract:", contract.maHopDong);
    }
    
    const currentStage = contract.giaiDoan;
    const nextStage = 5;
    
    // Perform transition check
    const isAnhThe = Number(contract.dichVuChinh) === 5;
    console.log("isAnhThe:", isAnhThe);
    console.log("Current Stage:", currentStage, "Next Stage:", nextStage);
    
    if (nextStage !== currentStage) {
      if (isAnhThe) {
        if (currentStage === 5) {
          console.log("Error: Already completed");
        } else {
          console.log("Validation passed for isAnhThe!");
        }
      } else {
        console.log("Validation failed for regular sequential check");
      }
    }
    
    // Try updating in DB
    contract.giaiDoan = 5;
    try {
      await contract.save();
      console.log("Save successful! Contract is now stage 5");
    } catch (saveErr) {
      console.error("Error during save:", saveErr);
    }
    
    // Cleanup if temporary
    if (contract.maHopDong.startsWith("TEST-TEMP-")) {
      await HopDong.deleteOne({ _id: contract._id });
      console.log("Cleaned up temporary contract");
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
  });
