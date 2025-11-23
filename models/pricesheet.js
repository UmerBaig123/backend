import mongoose from 'mongoose';

const priceSheetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required.'],
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Price is required.'],
    default: 0,
  },

  category: {
    type: String,
    trim: true,
  },

  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
}, {
  timestamps: true,
});

export default mongoose.model('PriceSheet', priceSheetSchema);
