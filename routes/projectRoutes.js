import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { 
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    getProjectStats
} from '../controllers/projectController.js';

const router = express.Router();

router.get('/test', (req, res) => {
    res.json({
        message: 'Projects API working',
        session: {
            exists: !!req.session,
            id: req.session?.id,
            userId: req.session?.userId
        },
        timestamp: new Date().toISOString()
    });
});

router.use(requireAuth);

router.get('/', getProjects);

router.get('/stats', getProjectStats);

router.get('/:id', getProjectById);

router.post('/', createProject);

router.put('/:id', updateProject);

router.delete('/:id', deleteProject);

export default router;
