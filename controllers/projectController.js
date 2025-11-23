import Project from '../models/project.js';
import mongoose from 'mongoose';

// Get all projects for the authenticated user
export const getProjects = async (req, res) => {
    try {
        console.log('=== GET PROJECTS API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('User Email:', req.session.email);
        console.log('Request URL:', req.originalUrl);
        console.log('Request Method:', req.method);
        console.log('Timestamp:', new Date().toISOString());
        
        const projects = await Project.find({ createdBy: req.session.userId })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'firstName lastName email');
        
        console.log('Projects found:', projects.length);
        console.log('Project IDs:', projects.map(p => p._id));
        console.log('Project Names:', projects.map(p => p.projectName));
        
        res.status(200).json({
            success: true,
            count: projects.length,
            data: projects
        });
        
        console.log('GET PROJECTS - Response sent successfully');
        console.log('================================');
    } catch (error) {
        console.error('=== GET PROJECTS ERROR ===');
        console.error('User ID:', req.session.userId);
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('==========================');
        
        res.status(500).json({
            success: false,
            message: 'Error fetching projects',
            error: error.message
        });
    }
};

// Get a single project by ID
export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== GET PROJECT BY ID API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('User Email:', req.session.email);
        console.log('Project ID requested:', id);
        console.log('Request URL:', req.originalUrl);
        console.log('Request Method:', req.method);
        console.log('Timestamp:', new Date().toISOString());

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('VALIDATION ERROR: Invalid ObjectId format');
            console.log('Provided ID:', id);
            console.log('ID length:', id.length);
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID format'
            });
        }

        const project = await Project.findOne({ 
            _id: id, 
            createdBy: req.session.userId 
        }).populate('createdBy', 'firstName lastName email');

        if (!project) {
            console.log('PROJECT NOT FOUND or ACCESS DENIED');
            console.log('Searched for project ID:', id);
            console.log('User ID:', req.session.userId);
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        console.log('Project found:', {
            id: project._id,
            name: project.projectName,
            client: project.clientName,
            type: project.projectType,
            location: project.location
        });

        res.status(200).json({
            success: true,
            data: project
        });
        
        console.log('GET PROJECT BY ID - Response sent successfully');
        console.log('====================================');
    } catch (error) {
        console.error('=== GET PROJECT BY ID ERROR ===');
        console.error('User ID:', req.session.userId);
        console.error('Project ID:', req.params.id);
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('===============================');
        
        res.status(500).json({
            success: false,
            message: 'Error fetching project',
            error: error.message
        });
    }
};

// Create a new project
export const createProject = async (req, res) => {
    try {
        console.log('=== CREATE PROJECT API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('User Email:', req.session.email);
        console.log('Request URL:', req.originalUrl);
        console.log('Request Method:', req.method);
        console.log('Timestamp:', new Date().toISOString());
        console.log('Request Body:', JSON.stringify(req.body, null, 2));

        const {
            projectName,
            clientName,
            projectType,
            location,
            estimatedStartDate,
            projectDescription,
            demolitionScope,
            // Handle alternative field names from frontend
            title,
            client,
            description,
            dueDate,
            budget,
            status
        } = req.body;

        // Map frontend field names to backend field names
        const mappedProjectName = projectName || title;
        const mappedClientName = clientName || client;
        const mappedProjectDescription = projectDescription || description;
        const mappedEstimatedStartDate = estimatedStartDate || dueDate;
        
        // Normalize project type to proper case
        let normalizedProjectType = projectType;
        if (normalizedProjectType) {
            normalizedProjectType = normalizedProjectType.charAt(0).toUpperCase() + normalizedProjectType.slice(1).toLowerCase();
        }

        console.log('Extracted fields:', {
            projectName: mappedProjectName,
            clientName: mappedClientName,
            projectType: normalizedProjectType,
            location,
            estimatedStartDate: mappedEstimatedStartDate,
            hasProjectDescription: !!mappedProjectDescription,
            hasDemolitionScope: !!demolitionScope,
            // Also log original fields for debugging
            originalFields: {
                title,
                client,
                description,
                dueDate,
                budget,
                status
            }
        });

        // Validate required fields
        if (!mappedProjectName || !mappedClientName || !normalizedProjectType || !location) {
            console.log('VALIDATION ERROR: Missing required fields');
            console.log('Required fields check:', {
                projectName: !!mappedProjectName,
                clientName: !!mappedClientName,
                projectType: !!normalizedProjectType,
                location: !!location
            });
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: projectName/title, clientName/client, projectType, and location are required'
            });
        }

        // Validate project type
        const validProjectTypes = ['Commercial', 'Residential', 'Industrial'];
        if (!validProjectTypes.includes(normalizedProjectType)) {
            console.log('VALIDATION ERROR: Invalid project type');
            console.log('Provided project type:', normalizedProjectType);
            console.log('Valid types:', validProjectTypes);
            return res.status(400).json({
                success: false,
                message: 'Invalid project type. Must be Commercial, Residential, or Industrial'
            });
        }

        // Create new project
        const projectData = {
            projectName: mappedProjectName,
            clientName: mappedClientName,
            projectType: normalizedProjectType,
            location,
            projectDescription: mappedProjectDescription,
            createdBy: req.session.userId
        };

        // Add optional fields if provided
        if (mappedEstimatedStartDate) {
            projectData.estimatedStartDate = new Date(mappedEstimatedStartDate);
            console.log('Estimated start date parsed:', projectData.estimatedStartDate);
        }

        // Add budget if provided
        if (budget !== undefined && budget !== null) {
            projectData.budget = Number(budget);
            console.log('Budget set:', projectData.budget);
        }

        // Add status if provided
        if (status) {
            const validStatuses = ['pending', 'active', 'completed', 'cancelled'];
            if (validStatuses.includes(status.toLowerCase())) {
                projectData.status = status.toLowerCase();
                console.log('Status set:', projectData.status);
            }
        }

        if (demolitionScope) {
            projectData.demolitionScope = {
                interior: Boolean(demolitionScope.interior),
                exterior: Boolean(demolitionScope.exterior),
                structural: Boolean(demolitionScope.structural),
                mechanicalSystems: Boolean(demolitionScope.mechanicalSystems),
                electricalSystems: Boolean(demolitionScope.electricalSystems),
                plumbingSystems: Boolean(demolitionScope.plumbingSystems)
            };
            console.log('Demolition scope processed:', projectData.demolitionScope);
        }

        console.log('Final project data to save:', JSON.stringify(projectData, null, 2));

        const project = new Project(projectData);
        const savedProject = await project.save();

        console.log('Project saved to database with ID:', savedProject._id);

        // Populate the createdBy field for response
        const populatedProject = await Project.findById(savedProject._id)
            .populate('createdBy', 'firstName lastName email');

        console.log('Project populated and ready for response');

        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            data: populatedProject
        });
        
        console.log('CREATE PROJECT - Response sent successfully');
        console.log('Project created:', {
            id: populatedProject._id,
            name: populatedProject.projectName,
            client: populatedProject.clientName,
            type: populatedProject.projectType
        });
        console.log('==================================');
    } catch (error) {
        console.error('=== CREATE PROJECT ERROR ===');
        console.error('User ID:', req.session.userId);
        console.error('Request Body:', JSON.stringify(req.body, null, 2));
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack:', error.stack);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            console.error('Validation errors:', validationErrors);
            console.error('============================');
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationErrors
            });
        }

        console.error('=============================');
        res.status(500).json({
            success: false,
            message: 'Error creating project',
            error: error.message
        });
    }
};

// Update a project
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== UPDATE PROJECT API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('User Email:', req.session.email);
        console.log('Project ID to update:', id);
        console.log('Request URL:', req.originalUrl);
        console.log('Request Method:', req.method);
        console.log('Timestamp:', new Date().toISOString());
        console.log('Update data:', JSON.stringify(req.body, null, 2));

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('VALIDATION ERROR: Invalid ObjectId format');
            console.log('Provided ID:', id);
            console.log('ID length:', id.length);
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID format'
            });
        }

        // Check if project exists and belongs to user
        const existingProject = await Project.findOne({ 
            _id: id, 
            createdBy: req.session.userId 
        });

        if (!existingProject) {
            console.log('PROJECT NOT FOUND or ACCESS DENIED');
            console.log('Searched for project ID:', id);
            console.log('User ID:', req.session.userId);
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        console.log('Existing project found:', {
            id: existingProject._id,
            name: existingProject.projectName,
            client: existingProject.clientName,
            type: existingProject.projectType
        });

        const {
            projectName,
            clientName,
            projectType,
            location,
            estimatedStartDate,
            projectDescription,
            demolitionScope,
            // Handle alternative field names from frontend
            title,
            client,
            description,
            dueDate,
            budget,
            status
        } = req.body;

        // Map frontend field names to backend field names
        const mappedProjectName = projectName !== undefined ? projectName : title;
        const mappedClientName = clientName !== undefined ? clientName : client;
        const mappedProjectDescription = projectDescription !== undefined ? projectDescription : description;
        const mappedEstimatedStartDate = estimatedStartDate !== undefined ? estimatedStartDate : dueDate;
        
        // Normalize project type to proper case if provided
        let normalizedProjectType = projectType;
        if (normalizedProjectType) {
            normalizedProjectType = normalizedProjectType.charAt(0).toUpperCase() + normalizedProjectType.slice(1).toLowerCase();
        }

        // Validate project type if provided
        if (normalizedProjectType) {
            const validProjectTypes = ['Commercial', 'Residential', 'Industrial'];
            if (!validProjectTypes.includes(normalizedProjectType)) {
                console.log('VALIDATION ERROR: Invalid project type');
                console.log('Provided project type:', normalizedProjectType);
                console.log('Valid types:', validProjectTypes);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid project type. Must be Commercial, Residential, or Industrial'
                });
            }
        }

        // Prepare update data
        const updateData = {};
        
        if (mappedProjectName !== undefined) {
            updateData.projectName = mappedProjectName;
            console.log('Updating project name:', mappedProjectName);
        }
        if (mappedClientName !== undefined) {
            updateData.clientName = mappedClientName;
            console.log('Updating client name:', mappedClientName);
        }
        if (normalizedProjectType !== undefined) {
            updateData.projectType = normalizedProjectType;
            console.log('Updating project type:', normalizedProjectType);
        }
        if (location !== undefined) {
            updateData.location = location;
            console.log('Updating location:', location);
        }
        if (mappedProjectDescription !== undefined) {
            updateData.projectDescription = mappedProjectDescription;
            console.log('Updating project description');
        }
        
        if (mappedEstimatedStartDate !== undefined) {
            updateData.estimatedStartDate = mappedEstimatedStartDate ? new Date(mappedEstimatedStartDate) : null;
            console.log('Updating estimated start date:', updateData.estimatedStartDate);
        }

        // Add budget if provided
        if (budget !== undefined) {
            updateData.budget = Number(budget);
            console.log('Updating budget:', updateData.budget);
        }

        // Add status if provided
        if (status !== undefined) {
            const validStatuses = ['pending', 'active', 'completed', 'cancelled'];
            if (validStatuses.includes(status.toLowerCase())) {
                updateData.status = status.toLowerCase();
                console.log('Updating status:', updateData.status);
            }
        }

        if (demolitionScope !== undefined) {
            updateData.demolitionScope = {
                interior: Boolean(demolitionScope.interior),
                exterior: Boolean(demolitionScope.exterior),
                structural: Boolean(demolitionScope.structural),
                mechanicalSystems: Boolean(demolitionScope.mechanicalSystems),
                electricalSystems: Boolean(demolitionScope.electricalSystems),
                plumbingSystems: Boolean(demolitionScope.plumbingSystems)
            };
            console.log('Updating demolition scope:', updateData.demolitionScope);
        }

        console.log('Final update data:', JSON.stringify(updateData, null, 2));

        // Update the project
        const updatedProject = await Project.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'firstName lastName email');

        console.log('Project updated successfully in database');

        res.status(200).json({
            success: true,
            message: 'Project updated successfully',
            data: updatedProject
        });
        
        console.log('UPDATE PROJECT - Response sent successfully');
        console.log('Updated project:', {
            id: updatedProject._id,
            name: updatedProject.projectName,
            client: updatedProject.clientName,
            type: updatedProject.projectType
        });
        console.log('==================================');
    } catch (error) {
        console.error('=== UPDATE PROJECT ERROR ===');
        console.error('User ID:', req.session.userId);
        console.error('Project ID:', req.params.id);
        console.error('Update data:', JSON.stringify(req.body, null, 2));
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack:', error.stack);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            console.error('Validation errors:', validationErrors);
            console.error('============================');
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: validationErrors
            });
        }

        console.error('=============================');
        res.status(500).json({
            success: false,
            message: 'Error updating project',
            error: error.message
        });
    }
};

// Delete a project
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== DELETE PROJECT API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('User Email:', req.session.email);
        console.log('Project ID to delete:', id);
        console.log('Request URL:', req.originalUrl);
        console.log('Request Method:', req.method);
        console.log('Timestamp:', new Date().toISOString());

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('VALIDATION ERROR: Invalid ObjectId format');
            console.log('Provided ID:', id);
            console.log('ID length:', id.length);
            return res.status(400).json({
                success: false,
                message: 'Invalid project ID format'
            });
        }

        // Find and delete the project (only if it belongs to the user)
        const deletedProject = await Project.findOneAndDelete({ 
            _id: id, 
            createdBy: req.session.userId 
        });

        if (!deletedProject) {
            console.log('PROJECT NOT FOUND or ACCESS DENIED');
            console.log('Searched for project ID:', id);
            console.log('User ID:', req.session.userId);
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        console.log('Project deleted successfully:', {
            id: deletedProject._id,
            name: deletedProject.projectName,
            client: deletedProject.clientName,
            type: deletedProject.projectType
        });

        res.status(200).json({
            success: true,
            message: 'Project deleted successfully',
            data: deletedProject
        });
        
        console.log('DELETE PROJECT - Response sent successfully');
        console.log('==================================');
    } catch (error) {
        console.error('=== DELETE PROJECT ERROR ===');
        console.error('User ID:', req.session.userId);
        console.error('Project ID:', req.params.id);
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('============================');
        
        res.status(500).json({
            success: false,
            message: 'Error deleting project',
            error: error.message
        });
    }
};

// Get project statistics for the user
export const getProjectStats = async (req, res) => {
    try {
        console.log('=== GET PROJECT STATS API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('User Email:', req.session.email);
        console.log('Request URL:', req.originalUrl);
        console.log('Request Method:', req.method);
        console.log('Timestamp:', new Date().toISOString());

        const userId = req.session.userId;

        // Get total count and breakdown by project type
        console.log('Running aggregation query for project stats...');
        const stats = await Project.aggregate([
            { $match: { createdBy: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$projectType',
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('Aggregation results:', stats);

        // Get total count
        const totalProjects = await Project.countDocuments({ createdBy: userId });
        console.log('Total projects count:', totalProjects);

        // Format the response
        const projectTypeStats = {
            Commercial: 0,
            Residential: 0,
            Industrial: 0
        };

        stats.forEach(stat => {
            projectTypeStats[stat._id] = stat.count;
            console.log(`${stat._id} projects: ${stat.count}`);
        });

        const responseData = {
            totalProjects,
            byProjectType: projectTypeStats
        };

        console.log('Final stats response:', responseData);

        res.status(200).json({
            success: true,
            data: responseData
        });
        
        console.log('GET PROJECT STATS - Response sent successfully');
        console.log('=====================================');
    } catch (error) {
        console.error('=== GET PROJECT STATS ERROR ===');
        console.error('User ID:', req.session.userId);
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('===============================');
        
        res.status(500).json({
            success: false,
            message: 'Error fetching project statistics',
            error: error.message
        });
    }
};
