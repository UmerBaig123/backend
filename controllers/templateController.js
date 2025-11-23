import Template from '../models/template.js';
import cloudinary from '../utils/cloudinary.js';
import path from 'path';

// Upload a new template document
export const uploadTemplate = async (req, res) => {
    try {
        console.log('=== UPLOAD TEMPLATE API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Timestamp:', new Date().toISOString());

        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'No document uploaded.' 
            });
        }

        const fileSize = req.file.size;
        const originalName = req.file.originalname;
        const mimeType = req.file.mimetype;
        
        console.log(`File Details: ${originalName} (${mimeType}) - ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Identify file type based on MIME type and extension
        const getFileType = (mimeType, filename) => {
            const extension = path.extname(filename).toLowerCase();
            
            if (mimeType.includes('pdf') || extension === '.pdf') {
                return 'pdf';
            } else if (mimeType.includes('msword') || extension === '.doc') {
                return 'doc';
            } else if (mimeType.includes('wordprocessingml') || extension === '.docx') {
                return 'docx';
            } else if (mimeType.includes('image')) {
                return 'image';
            } else if (mimeType.includes('text')) {
                return 'text';
            } else {
                return 'other';
            }
        };

        const fileType = getFileType(mimeType, originalName);
        console.log('Identified file type:', fileType);

        // Upload document to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadOptions = {
                folder: 'templates',
                use_filename: true,
                unique_filename: true,
                resource_type: 'auto', // Handles various file types
                public_id: `template_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9]/g, '_')}`
            };

            cloudinary.uploader.upload_stream(
                uploadOptions,
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        console.log('Document uploaded to Cloudinary:', result.secure_url);
                        resolve(result);
                    }
                }
            ).end(req.file.buffer);
        });

        // Save template to database
        const templateData = {
            user: req.session.userId,
            cloudinaryUrl: uploadResult.secure_url,
            originalName: originalName,
            fileType: fileType,
            cloudinaryPublicId: uploadResult.public_id,
            fileSize: fileSize,
            mimeType: mimeType
        };

        const template = new Template(templateData);
        await template.save();

        console.log('✅ Template saved successfully:', template._id);

        res.status(201).json({
            success: true,
            message: 'Template uploaded successfully',
            template: {
                id: template._id,
                originalName: template.originalName,
                fileType: template.fileType,
                cloudinaryUrl: template.cloudinaryUrl,
                uploadedAt: template.createdAt,
                fileSize: fileSize
            }
        });

    } catch (error) {
        console.error('=== UPLOAD TEMPLATE ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Server error uploading template',
            error: error.message
        });
    }
};

// Get all templates for a user
export const getUserTemplates = async (req, res) => {
    try {
        console.log('=== GET USER TEMPLATES API CALLED ===');
        console.log('User ID:', req.session.userId);

        const templates = await Template.find({ user: req.session.userId })
            .sort({ createdAt: -1 })
            .select('originalName fileType cloudinaryUrl createdAt updatedAt');

        console.log(`Found ${templates.length} templates for user`);

        res.status(200).json({
            success: true,
            message: 'Templates retrieved successfully',
            templates: templates,
            count: templates.length
        });

    } catch (error) {
        console.error('=== GET USER TEMPLATES ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error retrieving templates',
            error: error.message
        });
    }
};

// Get a specific template by ID
export const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== GET TEMPLATE BY ID API CALLED ===');
        console.log('Template ID:', id);
        console.log('User ID:', req.session.userId);

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID format'
            });
        }

        const template = await Template.findOne({ 
            _id: id, 
            user: req.session.userId 
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found or access denied'
            });
        }

        console.log('Template found:', template.originalName);

        res.status(200).json({
            success: true,
            message: 'Template retrieved successfully',
            template: template
        });

    } catch (error) {
        console.error('=== GET TEMPLATE BY ID ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error retrieving template',
            error: error.message
        });
    }
};

// Delete a template
export const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== DELETE TEMPLATE API CALLED ===');
        console.log('Template ID:', id);
        console.log('User ID:', req.session.userId);

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID format'
            });
        }

        const template = await Template.findOne({ 
            _id: id, 
            user: req.session.userId 
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found or access denied'
            });
        }

        // Delete from Cloudinary if public_id exists
        if (template.cloudinaryPublicId) {
            try {
                await cloudinary.uploader.destroy(template.cloudinaryPublicId);
                console.log('Template deleted from Cloudinary:', template.cloudinaryPublicId);
            } catch (cloudinaryError) {
                console.warn('Could not delete from Cloudinary:', cloudinaryError.message);
                // Continue with database deletion even if Cloudinary fails
            }
        }

        // Delete from database
        await Template.findByIdAndDelete(id);
        
        console.log('✅ Template deleted successfully:', template.originalName);

        res.status(200).json({
            success: true,
            message: 'Template deleted successfully'
        });

    } catch (error) {
        console.error('=== DELETE TEMPLATE ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error deleting template',
            error: error.message
        });
    }
};

// Update template metadata (name, etc.)
export const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { originalName } = req.body;
        
        console.log('=== UPDATE TEMPLATE API CALLED ===');
        console.log('Template ID:', id);
        console.log('User ID:', req.session.userId);

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID format'
            });
        }

        const template = await Template.findOne({ 
            _id: id, 
            user: req.session.userId 
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found or access denied'
            });
        }

        // Update template
        if (originalName) {
            template.originalName = originalName.trim();
        }

        await template.save();
        
        console.log('✅ Template updated successfully:', template.originalName);

        res.status(200).json({
            success: true,
            message: 'Template updated successfully',
            template: template
        });

    } catch (error) {
        console.error('=== UPDATE TEMPLATE ERROR ===');
        console.error('Error:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error updating template',
            error: error.message
        });
    }
};