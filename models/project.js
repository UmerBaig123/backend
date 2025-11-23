import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  clientName: { type: String, required: true },
  projectType: { type: String, enum: ['Commercial', 'Residential', 'Industrial'], required: true },
  location: { type: String, required: true },
  estimatedStartDate: { type: Date },
  projectDescription: { type: String },
  budget: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  demolitionScope: {
    interior: { type: Boolean, default: false },
    exterior: { type: Boolean, default: false },
    structural: { type: Boolean, default: false },
    mechanicalSystems: { type: Boolean, default: false },
    electricalSystems: { type: Boolean, default: false },
    plumbingSystems: { type: Boolean, default: false }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Project', projectSchema);
