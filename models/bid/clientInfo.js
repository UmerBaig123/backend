import mongoose from "mongoose";

// Client Information Schema - Editable
const clientInfoSchema = new mongoose.Schema({
  companyName: {
    type: String,
    trim: true,
    index: true
  },
  address: {
    type: String,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  // Additional fields from AI extraction
  clientName: {
    type: String,
    trim: true
  },
  clientAddress: {
    type: String,
    trim: true
  }
}, { _id: false });

export default clientInfoSchema;
