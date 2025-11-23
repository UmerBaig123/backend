import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getTotalProposedAmount,
    setTotalProposedAmount,
    updateTotalProposedAmount,
    calculateTotalProposedAmount,
    clearTotalProposedAmount
} from '../controllers/totalProposedAmountController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/total-proposed-amount/:id - Get total proposed amount for a specific bid
router.get('/:id', getTotalProposedAmount);

// POST /api/total-proposed-amount/:id - Set total proposed amount for a specific bid
router.post('/:id', setTotalProposedAmount);

// PUT /api/total-proposed-amount/:id - Update total proposed amount for a specific bid
router.put('/:id', updateTotalProposedAmount);

// POST /api/total-proposed-amount/:id/calculate - Calculate total proposed amount from individual item proposed bids
router.post('/:id/calculate', calculateTotalProposedAmount);

// DELETE /api/total-proposed-amount/:id - Clear total proposed amount for a specific bid
router.delete('/:id', clearTotalProposedAmount);

export default router;

