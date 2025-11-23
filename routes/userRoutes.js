import express from 'express';
import { 
    updateAccountInfo, 
    updateCompanyInfo, 
    updateNotificationPreferences, 
    updatePassword,
    getUserProfile 
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Middleware to check if user is authenticated
// const requireAuth = (req, res, next) => {
//     if (!req.session.userId) {
//         return res.status(401).json({
//             success: false,
//             message: 'Authentication required'
//         });
//     }
//     next();
// };

// Apply authentication middleware to all routes
router.use(requireAuth);

// Get user profile information
router.get('/profile', getUserProfile);

// Update Account Information (full name, company name, phone - not email)
router.put('/account', updateAccountInfo);

// Update Company Information (company name, website, address)
router.put('/company', updateCompanyInfo);

// Update Notification Preferences
router.put('/notifications', updateNotificationPreferences);

// Update Password (Security)
router.put('/security', updatePassword);

export default router;
