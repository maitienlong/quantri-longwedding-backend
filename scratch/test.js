const mongoose = require("mongoose");
require("dotenv").config({ path: "../.env" });

const DATABASE_URL = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
console.log("Connecting to Database URL:", DATABASE_URL);

mongoose.connect(DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("MongoDB connected successfully!");
    const HopDong = require("../src/models/hopDong.model");
    
    // Find any contract
    const contract = await HopDong.findOne({});
    if (!contract) {
      console.log("No contract found in database to test!");
      process.exit(0);
    }
    
    console.log(`Found contract: ${contract.maHopDong}, stage: ${contract.giaiDoan}`);
    const originalStage = contract.giaiDoan;
    
    // Attempt to set stage to 5 and save
    contract.giaiDoan = 5;
    try {
      await contract.save();
      console.log("Save successful! contract.giaiDoan is now 5");
      
      // Revert back
      contract.giaiDoan = originalStage;
      await contract.save();
      console.log("Reverted stage successfully!");
    } catch (saveErr) {
      console.error("Error during save:", saveErr);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
  });
