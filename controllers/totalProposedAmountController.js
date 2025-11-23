import { Bid } from '../models/bid.js';

// GET: Get total proposed amount for a specific bid
export const getTotalProposedAmount = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const userId = req.session.userId;

        console.log('📊 Getting total proposed amount for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ 
                message: 'Bid not found or access denied' 
            });
        }

        // Calculate current total from individual item proposed bids
        let calculatedTotal = 0;
        let itemsWithProposedBids = 0;

        // Check AI extracted demolition items first (prioritized)
        if (bid.aiExtractedData?.demolitionItems && Array.isArray(bid.aiExtractedData.demolitionItems)) {
            bid.aiExtractedData.demolitionItems.forEach((item, index) => {
                if (item.proposedBid && item.proposedBid > 0) {
                    calculatedTotal += item.proposedBid;
                    itemsWithProposedBids++;
                }
            });
        }

        // Check regular demolition items
        if (bid.demolitionItems && Array.isArray(bid.demolitionItems)) {
            bid.demolitionItems.forEach((item, index) => {
                if (item.proposedBid && item.proposedBid > 0) {
                    calculatedTotal += item.proposedBid;
                    itemsWithProposedBids++;
                }
            });
        }

        console.log(`✅ Total proposed amount retrieved: $${bid.totalProposedAmount || 0}`);
        console.log(`📈 Calculated from items: $${calculatedTotal} (${itemsWithProposedBids} items)`);

        res.json({
            success: true,
            totalProposedAmount: bid.totalProposedAmount || 0,
            calculatedFromItems: calculatedTotal,
            itemsWithProposedBids: itemsWithProposedBids,
            lastUpdated: bid.lastModified,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Get total proposed amount error:', error);
        res.status(500).json({
            message: 'Failed to get total proposed amount',
            error: error.message
        });
    }
};

// POST: Set total proposed amount for a specific bid
export const setTotalProposedAmount = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const { totalProposedAmount } = req.body;
        const userId = req.session.userId;

        console.log('💰 Setting total proposed amount for bid:', bidId);
        console.log('💵 Amount:', totalProposedAmount);

        // Validate input
        if (totalProposedAmount === null || totalProposedAmount === undefined) {
            return res.status(400).json({
                message: 'Total proposed amount is required'
            });
        }

        const amount = parseFloat(totalProposedAmount);
        if (isNaN(amount) || amount < 0) {
            return res.status(400).json({
                message: 'Total proposed amount must be a valid positive number'
            });
        }

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ 
                message: 'Bid not found or access denied' 
            });
        }

        // Update the total proposed amount
        bid.totalProposedAmount = amount;
        bid.lastModified = new Date();
        bid.modifiedBy = userId;

        await bid.save();

        console.log(`✅ Total proposed amount set to: $${amount}`);

        res.json({
            success: true,
            message: 'Total proposed amount updated successfully',
            totalProposedAmount: amount,
            lastUpdated: bid.lastModified,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Set total proposed amount error:', error);
        res.status(500).json({
            message: 'Failed to set total proposed amount',
            error: error.message
        });
    }
};

// PUT: Update total proposed amount for a specific bid
export const updateTotalProposedAmount = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const { totalProposedAmount } = req.body;
        const userId = req.session.userId;

        console.log('🔄 Updating total proposed amount for bid:', bidId);
        console.log('💵 New amount:', totalProposedAmount);

        // Validate input
        if (totalProposedAmount === null || totalProposedAmount === undefined) {
            return res.status(400).json({
                message: 'Total proposed amount is required'
            });
        }

        const amount = parseFloat(totalProposedAmount);
        if (isNaN(amount) || amount < 0) {
            return res.status(400).json({
                message: 'Total proposed amount must be a valid positive number'
            });
        }

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ 
                message: 'Bid not found or access denied' 
            });
        }

        const previousAmount = bid.totalProposedAmount || 0;

        // Update the total proposed amount
        bid.totalProposedAmount = amount;
        bid.lastModified = new Date();
        bid.modifiedBy = userId;

        await bid.save();

        console.log(`✅ Total proposed amount updated from $${previousAmount} to $${amount}`);

        res.json({
            success: true,
            message: 'Total proposed amount updated successfully',
            totalProposedAmount: amount,
            previousAmount: previousAmount,
            lastUpdated: bid.lastModified,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Update total proposed amount error:', error);
        res.status(500).json({
            message: 'Failed to update total proposed amount',
            error: error.message
        });
    }
};

// POST: Calculate total proposed amount from individual item proposed bids
export const calculateTotalProposedAmount = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const userId = req.session.userId;

        console.log('🧮 Calculating total proposed amount from items for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ 
                message: 'Bid not found or access denied' 
            });
        }

        let calculatedTotal = 0;
        let itemsWithProposedBids = 0;
        const itemDetails = [];

        // Check AI extracted demolition items first (prioritized)
        if (bid.aiExtractedData?.demolitionItems && Array.isArray(bid.aiExtractedData.demolitionItems)) {
            bid.aiExtractedData.demolitionItems.forEach((item, index) => {
                if (item.proposedBid && item.proposedBid > 0) {
                    calculatedTotal += item.proposedBid;
                    itemsWithProposedBids++;
                    itemDetails.push({
                        itemNumber: item.itemNumber || (index + 1),
                        name: item.name || `Item ${index + 1}`,
                        proposedBid: item.proposedBid
                    });
                }
            });
        }

        // Check regular demolition items
        if (bid.demolitionItems && Array.isArray(bid.demolitionItems)) {
            bid.demolitionItems.forEach((item, index) => {
                if (item.proposedBid && item.proposedBid > 0) {
                    calculatedTotal += item.proposedBid;
                    itemsWithProposedBids++;
                    itemDetails.push({
                        itemId: item._id,
                        name: item.name || `Item ${index + 1}`,
                        proposedBid: item.proposedBid
                    });
                }
            });
        }

        // Update the bid with calculated total
        bid.totalProposedAmount = calculatedTotal;
        bid.lastModified = new Date();
        bid.modifiedBy = userId;

        await bid.save();

        console.log(`✅ Calculated total proposed amount: $${calculatedTotal} from ${itemsWithProposedBids} items`);

        res.json({
            success: true,
            message: 'Total proposed amount calculated successfully',
            totalProposedAmount: calculatedTotal,
            itemsWithProposedBids: itemsWithProposedBids,
            itemDetails: itemDetails,
            lastUpdated: bid.lastModified,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Calculate total proposed amount error:', error);
        res.status(500).json({
            message: 'Failed to calculate total proposed amount',
            error: error.message
        });
    }
};

// DELETE: Clear total proposed amount for a specific bid
export const clearTotalProposedAmount = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const userId = req.session.userId;

        console.log('🗑️ Clearing total proposed amount for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ 
                message: 'Bid not found or access denied' 
            });
        }

        const previousAmount = bid.totalProposedAmount || 0;

        // Clear the total proposed amount
        bid.totalProposedAmount = null;
        bid.lastModified = new Date();
        bid.modifiedBy = userId;

        await bid.save();

        console.log(`✅ Total proposed amount cleared (was: $${previousAmount})`);

        res.json({
            success: true,
            message: 'Total proposed amount cleared successfully',
            previousAmount: previousAmount,
            lastUpdated: bid.lastModified,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Clear total proposed amount error:', error);
        res.status(500).json({
            message: 'Failed to clear total proposed amount',
            error: error.message
        });
    }
};

