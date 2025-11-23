import mongoose from "mongoose";

// Pricing Summary Schema for cost calculations
const pricingSummarySchema = new mongoose.Schema({
  subtotal: {
    type: Number,
    default: null
  },
  laborTotal: {
    type: Number,
    default: null
  },
  materialTotal: {
    type: Number,
    default: null
  },
  grandTotal: {
    type: Number,
    default: null
  },
  // Additional pricing fields
  totalProjectCost: {
    type: String,
    trim: true
  }
}, { _id: false });

export default pricingSummarySchema;
