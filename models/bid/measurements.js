import mongoose from "mongoose";

// Measurements Schema - Item-specific measurement tracking
const measurementsSchema = new mongoose.Schema({
  // Primary measurement based on item type
  quantity: {
    type: Number,
    default: null
  },
  unit: {
    type: String,
    trim: true,
    default: null,
    enum: ['SF', 'LF', 'EA', 'CY', 'SY', null] // Square Feet, Linear Feet, Each, Cubic Yards, Square Yards
  },
  // Specific measurement fields based on item type
  squareFeet: {
    type: Number,
    default: null
  },
  linearFeet: {
    type: Number,
    default: null
  },
  count: {
    type: Number,
    default: null
  },
  // Additional context
  dimensions: {
    type: String,
    trim: true,
    default: null
  }
}, { _id: false });

export default measurementsSchema;
