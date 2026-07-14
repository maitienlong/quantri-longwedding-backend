const mongoose = require("mongoose");

const websiteSchema = new mongoose.Schema({
  section: { 
    type: String, 
    required: true, 
    unique: true 
    // e.g., 'dresses', 'makeup', 'newConcept', 'packages'
  },
  data: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true,
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("website", websiteSchema);
