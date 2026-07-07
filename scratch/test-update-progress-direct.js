const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const DATABASE_URL = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
console.log("Connecting to Database URL:", DATABASE_URL);

mongoose.connect(DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("MongoDB connected successfully!");
    const HopDong = require("../src/models/hopDong.model");
    const hopDongService = require("../src/services/hopDong.service");
    
    // Find any contract
    let contract = await HopDong.findOne({});
    if (!contract) {
      console.log("Creating temporary contract...");
      contract = new HopDong({
        maHopDong: "TEST-TEMP-" + Date.now(),
        ngayHopDong: new Date(),
        khachHang1: new mongoose.Types.ObjectId(),
        gioHang: [],
        giaiDoan: 3,
        dichVuChinh: 1
      });
      await contract.save();
    }
    
    // Force set current stage to 3
    contract.giaiDoan = 3;
    await contract.save();
    console.log(`Contract: ${contract.maHopDong}, stage set to: ${contract.giaiDoan}`);
    
    // Mock req and res
    const req = {
      body: {
        maHopDong: contract.maHopDong,
        giaiDoan: 5,
        data: {}
      }
    };
    
    const res = {
      json: function(data) {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
      },
      status: function(code) {
        console.log("Response status code:", code);
        return this;
      }
    };
    
    // Run updateProgress directly!
    await hopDongService.updateProgress(req, res);
    
    // Cleanup if temporary
    if (contract.maHopDong.startsWith("TEST-TEMP-")) {
      await HopDong.deleteOne({ _id: contract._id });
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
  });
