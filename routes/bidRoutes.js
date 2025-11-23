import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { 
    createBid, 
    getBids, 
    getBidById, 
    updateBid, 
    deleteBid,
    getBidDetails,
    updateBidItems,
    getDemolitionItems,
    updateDemolitionItem,
    // getDemolitionItemsEditable,
    // getDemolitionTemplates,
    // New optimized methods
    // updateBidOptimized,
    // updateContractorInfo,
    // updateClientInfo,
    updateProjectDetails,
    updateDemolitionItemOptimized,
    addDemolitionItem,
    removeDemolitionItem,
    bulkUpdateDemolitionItems,


    
    getBidDetailed,
    // New pricing methods
    updateProposedBid,
    calculateAllPrices,
    getPricingSummary,
    updateItemProposedBid
} from '../controllers/bidController.js';
import { createBidWithDocument } from '../services/bidDocumentService.js';
import { downloadBidDocument } from '../services/pdfDocumentService.js';

const router = express.Router();

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow specific file types
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/gif',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, Word, images, and text files are allowed.'), false);
        }
    }
});

router.use(requireAuth);

// POST /api/bids/with-document - Create a new bid with document upload and AI processing
router.post('/with-document', (req, res, next) => {
    upload.single('document')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
            }
            return res.status(400).json({ message: 'File upload error: ' + err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}, createBidWithDocument);

// POST /api/bids - Create a new bid manually
router.post('/', createBid);

// GET /api/bids - Get all bids for user
router.get('/', getBids);

// GET /api/bids/:id - Get a single bid by ID
router.get('/:id', getBidById);

// GET /api/bids/:id/detailed - Get detailed bid with all related data (NEW OPTIMIZED)
router.get('/:id/detailed', getBidDetailed);

// GET /api/bids/:id/details - Get bid details with items and AI data for sheet/table display
router.get('/:id/details', getBidDetails);


// =====
// GET /api/bids/:id/demolition-items - Get demolition items from AI extracted data
router.get('/:id/demolition-items', getDemolitionItems);
// =====



// PUT /api/bids/:id/project - Update project details (NEW)
router.put('/:id/project', updateProjectDetails);

// PUT /api/bids/:id/demolition-items/:itemId/optimized - Update specific demolition item (NEW OPTIMIZED)
router.put('/:id/demolition-items/:itemId/optimized', updateDemolitionItemOptimized);

// POST /api/bids/:id/demolition-items - Add new demolition item (NEW)
router.post('/:id/demolition-items', addDemolitionItem);

// DELETE /api/bids/:id/demolition-items/:itemId - Remove demolition item (NEW)
router.delete('/:id/demolition-items/:itemId', removeDemolitionItem);

// PUT /api/bids/:id/demolition-items/bulk - Bulk update demolition items (NEW)
router.put('/:id/demolition-items/bulk', bulkUpdateDemolitionItems);

// ===== PRICING ROUTES =====

// PUT /api/bids/:id/proposed-bid - Update proposed bid amount
router.put('/:id/proposed-bid', updateProposedBid);

// POST /api/bids/:id/calculate-prices - Calculate all prices for demolition items
router.post('/:id/calculate-prices', calculateAllPrices);

// GET /api/bids/:id/pricing-summary - Get pricing summary for a bid
router.get('/:id/pricing-summary', getPricingSummary);

// PUT /api/bids/:id/demolition-items/:itemId/proposed-bid - Update proposed bid for individual demolition item
router.put('/:id/demolition-items/:itemId/proposed-bid', updateItemProposedBid);

// ===== LEGACY ROUTES (for backward compatibility) =====



// =====
// PUT /api/bids/:id/demolition-items/:itemId - Update specific demolition item (LEGACY)
router.put('/:id/demolition-items/:itemId', updateDemolitionItem);
// =====




// PUT /api/bids/:id/items - Update bid items array after user modifications (LEGACY)
router.put('/:id/items', updateBidItems);





// GET /api/bids/:id/document - Download bid document as PDF
router.get('/:id/document', downloadBidDocument);

// PUT /api/bids/:id - Update an existing bid (LEGACY)
router.put('/:id', updateBid);

// DELETE /api/bids/:id - Delete a bid
router.delete('/:id', deleteBid);

export default router;







// GET /api/bids/:id/demolition-items/editable - Get demolition items optimized for frontend editing
// router.get('/:id/demolition-items/editable', getDemolitionItemsEditable);



// =====
// GET /api/bids/demolition-templates - Get demolition item templates and categories
// router.get('/demolition-templates', getDemolitionTemplates);
// =====


// ===== OPTIMIZED PUT OPERATIONS =====

// PUT /api/bids/:id/optimized - Update entire bid (NEW OPTIMIZED)
// router.put('/:id/optimized', updateBidOptimized);

// PUT /api/bids/:id/contractor - Update contractor information (NEW)
// router.put('/:id/contractor', updateContractorInfo);

// PUT /api/bids/:id/client - Update client information (NEW)
// router.put('/:id/client', updateClientInfo);


