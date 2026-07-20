const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function findLinks() {
  try {
    const dbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
    console.log("Connecting to:", dbUrl);
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB.");

    const Album = mongoose.model('album', new mongoose.Schema({
      maHopDong: String,
      driveLink: String,
      trangThai: String
    }));

    const albums = await Album.find({});
    console.log(`Found ${albums.length} albums in database.`);
    
    for (let album of albums) {
      console.log(`- Contract: ${album.maHopDong}, Link: ${album.driveLink}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

findLinks();
