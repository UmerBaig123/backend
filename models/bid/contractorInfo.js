import mongoose from "mongoose";

// Contractor Information Schema - Editable
const contractorInfoSchema = new mongoose.Schema({
  companyName: {
    type: String,
    trim: true,
    index: true
  },
  address: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  license: {
    type: String,
    trim: true
  },
  // Additional fields from AI extraction
  insurance: {
    type: String,
    trim: true
  }
}, { _id: false });

export default contractorInfoSchema;
