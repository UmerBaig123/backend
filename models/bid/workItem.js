import mongoose from "mongoose";

// Work Items Schema for extracted work items
const workItemSchema = new mongoose.Schema({
  itemNumber: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  specifications: {
    type: String,
    trim: true
  }
}, { _id: false });

export default workItemSchema;
