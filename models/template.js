import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
    
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    cloudinaryUrl: {
        type: String,
        required: true,
    },

    cloudinaryPublicId: {
        type: String,
        required: true,
    },

    originalName: {
        type: String,
        required: true,
        trim: true
    },
    
    fileType: {
        type: String,
        required: true,
        enum: ['pdf', 'doc', 'docx', 'image', 'text', 'other'],
        lowercase: true
    },

    fileSize: {
        type: Number,
        required: true
    },

    mimeType: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes for efficient queries
templateSchema.index({ user: 1, createdAt: -1 });
templateSchema.index({ fileType: 1 });

// Virtual for file size in readable format
templateSchema.virtual('fileSizeFormatted').get(function() {
    const sizeInMB = this.fileSize / (1024 * 1024);
    if (sizeInMB < 1) {
        const sizeInKB = this.fileSize / 1024;
        return `${sizeInKB.toFixed(2)} KB`;
    }
    return `${sizeInMB.toFixed(2)} MB`;
});

// Instance method to get file extension
templateSchema.methods.getFileExtension = function() {
    if (!this.originalName) return '';
    return this.originalName.substring(this.originalName.lastIndexOf('.'));
};

// Static method to find templates by file type
templateSchema.statics.findByFileType = function(userId, fileType) {
    return this.find({ user: userId, fileType: fileType }).sort({ createdAt: -1 });
};

const Template = mongoose.model('Template', templateSchema);

export default Template;
