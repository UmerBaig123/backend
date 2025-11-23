import mongoose from "mongoose";

// Measurement Summary Schema for aggregated measurements
const measurementSummarySchema = new mongoose.Schema({
  totalArea: {
    type: Number,
    default: null
  },
  totalVolume: {
    type: Number,
    default: null
  },
  totalLinearFeet: {
    type: Number,
    default: null
  },
  // Additional measurement fields
  squareFootage: {
    type: Number,
    default: null
  },
  linearFootage: {
    type: Number,
    default: null
  },
  itemCount: {
    type: Number,
    default: null
  }
}, { _id: false });

export default measurementSummarySchema;
