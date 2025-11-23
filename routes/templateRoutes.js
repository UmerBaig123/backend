import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
    uploadTemplate,
    getUserTemplates,
    getTemplateById,
    deleteTemplate,
    updateTemplate
} from '../controllers/templateController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow various document types
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'text/plain',
            'application/rtf'
        ];

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.rtf'];
        
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, images, and text files are allowed.'), false);
        }
    }
});

// Apply authentication middleware to all routes
router.use(requireAuth);

// Routes

// POST /api/templates/upload - Upload a new template
router.post('/upload', upload.single('template'), uploadTemplate);

// GET /api/templates - Get all templates for the authenticated user
router.get('/', getUserTemplates);

// GET /api/templates/:id - Get a specific template by ID
router.get('/:id', getTemplateById);

// PUT /api/templates/:id - Update template metadata
router.put('/:id', updateTemplate);

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', deleteTemplate);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 50MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error: ' + error.message
        });
    }
    
    if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
    next(error);
});

export default router;