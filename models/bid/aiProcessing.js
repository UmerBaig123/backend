import mongoose from "mongoose";

// AI Processing Metadata Schema
const aiProcessingSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['gemini-two-phase', 'gemini-single-phase', 'manual', 'fallback'],
    default: 'gemini-two-phase'
  },
  success: {
    type: Boolean,
    default: false
  },
  phase1Success: {
    type: Boolean,
    default: false
  },
  phase2Success: {
    type: Boolean,
    default: false
  },
  extractedItemCount: {
    type: Number,
    default: 0
  },
  processingTime: {
    type: Number // milliseconds
  },
  extractionNotes: {
    type: String,
    trim: true
  },
  lastProcessedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

export default aiProcessingSchema;
