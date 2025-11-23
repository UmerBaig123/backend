import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  fileUrl:    { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:  { type: Date, default: Date.now }
});

export default mongoose.model('Document', documentSchema);
