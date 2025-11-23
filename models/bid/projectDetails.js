import mongoose from "mongoose";

// Project Details Schema - Editable
const projectDetailsSchema = new mongoose.Schema({
  documentType: {
    type: String,
    trim: true
  },
  bidDate: {
    type: Date
  },
  projectName: {
    type: String,
    trim: true,
    index: true
  },
  projectType: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  scopeSummary: {
    type: String,
    trim: true
  },
  // Additional fields from AI extraction
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

export default projectDetailsSchema;
