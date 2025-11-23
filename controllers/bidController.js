import { Bid } from '../models/bid.js';
import cloudinary from '../utils/cloudinary.js';
import { extractBidDataFromDocument } from '../utils/ai.js';
import { createBidWithDocument } from '../services/bidDocumentService.js';

// Create a new bid
export const createBid = async (req, res) => {
    try {
        console.log('Creating new bid for user:', req.session.userId);
        
        const bidData = {
            ...req.body,
            user: req.session.userId
        };
        
        const bid = new Bid(bidData);
        await bid.save();
        
        console.log('Bid created successfully:', bid._id);
        
        res.status(201).json({
            message: 'Bid created successfully',
            bid
        });
    } catch (error) {
        console.error('Create bid error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Get all bids for the authenticated user
export const getBids = async (req, res) => {
    try {
        console.log('Fetching bids for user:', req.session.userId);
        
        const bids = await Bid.find({ user: req.session.userId })
            .populate('user', 'email')
            .sort({ createdAt: -1 });
            
        console.log('Found', bids.length, 'bids');
        
        res.status(200).json({
            message: 'Bids retrieved successfully',
            bids
        });
    } catch (error) {
        console.error('Get bids error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Get a single bid by ID
export const getBidById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Fetching bid:', id, 'for user:', req.session.userId);
        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            console.warn('Invalid bid ID:', id);
            return res.status(400).json({
                message: 'Invalid bid ID format. Must be a 24-character hex string.'
            });
        }
        const bid = await Bid.findOne({ 
            _id: id, 
            user: req.session.userId 
        }).populate('user', 'email');
        
        if (!bid) {
            console.log('Bid not found or unauthorized:', id);
            return res.status(404).json({
                message: 'Bid not found or you do not have permission to access it'
            });
        }
        
        console.log('Bid found:', bid._id);
        
        res.status(200).json({
            message: 'Bid retrieved successfully',
            bid
        });
    } catch (error) {
        console.error('Get bid by ID error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Update a bid
export const updateBid = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Updating bid:', id, 'for user:', req.session.userId);
        console.log('Update data:', req.body);
        
        // Validate and normalize status if provided
        if (req.body.status) {
            const validStatuses = [
                "Pending", 
                "In Review", 
                "Approved", 
                "Rejected", 
                "Awarded", 
                "Completed", 
                "Cancelled",
                "Denied"
            ];
            
            // Normalize status to proper case (first letter uppercase)
            const normalizedStatus = req.body.status.charAt(0).toUpperCase() + req.body.status.slice(1).toLowerCase();
            
            // Special handling for "In Review" (two words)
            const statusMapping = {
                'pending': 'Pending',
                'inreview': 'In Review',
                'in review': 'In Review',
                'approved': 'Approved',
                'rejected': 'Rejected',
                'awarded': 'Awarded',
                'completed': 'Completed',
                'cancelled': 'Cancelled',
                'denied': 'Denied'
            };
            
            const mappedStatus = statusMapping[req.body.status.toLowerCase()] || normalizedStatus;
            
            if (!validStatuses.includes(mappedStatus)) {
                console.log('Invalid status provided:', req.body.status);
                return res.status(400).json({
                    message: 'Invalid status value',
                    validStatuses: validStatuses,
                    providedStatus: req.body.status,
                    normalizedStatus: mappedStatus
                });
            }
            
            // Update the status in the request body with the normalized value
            const originalStatus = req.body.status;
            req.body.status = mappedStatus;
            console.log('Status normalized from', originalStatus, 'to', mappedStatus);
        }
        
        const bid = await Bid.findOneAndUpdate(
            { _id: id, user: req.session.userId },
            req.body,
            { new: true, runValidators: true }
        ).populate('user', 'email');
        
        if (!bid) {
            console.log('Bid not found or unauthorized for update:', id);
            return res.status(404).json({
                message: 'Bid not found or you do not have permission to update it'
            });
        }
        
        console.log('Bid updated successfully:', bid._id);
        
        res.status(200).json({
            message: 'Bid updated successfully',
            bid
        });
    } catch (error) {
        console.error('Update bid error:', error);
        
        // Handle validation errors specifically
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message,
                value: err.value
            }));
            
            return res.status(400).json({
                message: 'Validation failed',
                errors: validationErrors
            });
        }
        
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Delete a bid
export const deleteBid = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Deleting bid:', id, 'for user:', req.session.userId);
        
        const bid = await Bid.findOneAndDelete({ 
            _id: id, 
            user: req.session.userId 
        });
        
        if (!bid) {
            console.log('Bid not found or unauthorized for deletion:', id);
            return res.status(404).json({
                message: 'Bid not found or you do not have permission to delete it'
            });
        }
        
        console.log('Bid deleted successfully:', id);
        
        res.status(200).json({
            message: 'Bid deleted successfully',
            bidId: id
        });
    } catch (error) {
        console.error('Delete bid error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Get bid details with AI analysis and items for sheet/table display
export const getBidDetails = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== GET BID DETAILS API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Bid ID requested:', id);
        console.log('Timestamp:', new Date().toISOString());

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            console.log('VALIDATION ERROR: Invalid ObjectId format');
            return res.status(400).json({
                success: false,
                message: 'Invalid bid ID format'
            });
        }

        const bid = await Bid.findOne({ 
            _id: id, 
            user: req.session.userId 
        }).populate('user', 'firstName lastName email');

        if (!bid) {
            console.log('BID NOT FOUND or ACCESS DENIED');
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        console.log('Bid found with details:', {
            id: bid._id,
            projectName: bid.projectName,
            aiDemolitionItemsCount: bid.aiExtractedData?.demolitionItems?.length || 0,
            rootDemolitionItemsCount: bid.demolitionItems?.length || 0,
            bidItemsCount: bid.bidItems?.length || 0,
            hasAiData: !!bid.aiExtractedData
        });

        // Prioritize AI extracted data for demolition items
        const demolitionItems = bid.aiExtractedData?.demolitionItems || bid.demolitionItems || [];

        // Format the response with all necessary data for frontend
        const response = {
            success: true,
            data: {
                bid: {
                    _id: bid._id,
                    projectName: bid.projectName,
                    projectType: bid.projectType,
                    client: bid.client,
                    additionalNotes: bid.additionalNotes,
                    status: bid.status,
                    documents: bid.documents,
                    processingMethod: bid.processingMethod,
                    createdAt: bid.createdAt,
                    updatedAt: bid.updatedAt
                },
                // Return AI extracted demolition items as the primary data source
                bidItems: demolitionItems, // For backward compatibility
                demolitionItems: demolitionItems,
                aiExtractedData: bid.aiExtractedData || {},
                summary: {
                    totalItems: demolitionItems.length,
                    totalValue: demolitionItems.reduce((sum, item) => {
                        const price = parseFloat(item.totalPrice || item.proposedBid || item.pricing || 0);
                        return sum + (isNaN(price) ? 0 : price);
                    }, 0),
                    hasAiAnalysis: !!bid.aiExtractedData,
                    processingMethod: bid.processingMethod
                }
            }
        };

        console.log('GET BID DETAILS - Response sent successfully');
        console.log('Sample item structure:', bid.demolitionItems?.[0] || bid.bidItems?.[0] || 'No items found');
        res.status(200).json(response);
    } catch (error) {
        console.error('=== GET BID DETAILS ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error fetching bid details',
            error: error.message
        });
    }
};

// Update bid items in the sheet/table

// Updated backend controller for updatebid.js
// This should replace your existing updateBidItems function

export const updateBidItems = async (req, res) => {
    try {
        const { id } = req.params;
        const { demolitionItems } = req.body;

        console.log('=== UPDATE BID ITEMS API CALLED ===');
        console.log('User ID:', req.session.userId);
        console.log('Bid ID:', id);
        console.log('Items to update:', demolitionItems?.length || 0);
        console.log('Timestamp:', new Date().toISOString());

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bid ID format'
            });
        }

        // Validate demolitionItems format
        if (!Array.isArray(demolitionItems)) {
            return res.status(400).json({
                success: false,
                message: 'demolitionItems must be an array'
            });
        }

        // Process demolitionItems to match the structure used in createBidWithDocument
        const processedItems = demolitionItems.map(item => {
            // Handle mixed categories like "electrical, mechanical, plumbing"
            let category = item.category || 'other';
            if (category.includes(',')) {
                // If multiple categories, take the first one
                category = category.split(',')[0].trim();
            }
            
            // Map category variations to model enum values
            const categoryMap = {
                'HVAC': 'hvac',
                'MEP': 'electrical',
                'Storefront': 'storefront',
                'signage': 'signage',
                'demolition': 'other', // Map 'demolition' to 'other'
                'mechanical': 'mechanical'
            };
            
            category = categoryMap[category] || category.toLowerCase();
            
            // Ensure category is in allowed enum, fallback to 'other'
            const allowedCategories = [
                'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
                'cleanup', 'door', 'window', 'fixture', 'hvac', 
                'structural', 'interior', 'exterior', 'other',
                'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
                'Storefront', 'mechanical'
            ];
            
            if (!allowedCategories.includes(category)) {
                category = 'other';
            }
            
            // Use the action from input directly as string
            let action = item.action || 'Remove';
            
            return {
                itemNumber: item.itemNumber || null,
                name: item.name || item.description || 'No name', // Add name field
                description: item.description || 'No description',
                category: category,
                action: action,
                measurements: {
                    quantity: item.measurements?.quantity || null,
                    unit: item.measurements?.unit || null,
                    dimensions: item.measurements?.dimensions || null
                },
                pricing: item.pricing || item.totalPrice || null,
                // Add pricesheetMatch structure
                pricesheetMatch: {
                    matched: item.pricesheetMatch?.matched || false,
                    itemName: item.pricesheetMatch?.itemName || null,
                    itemPrice: item.pricesheetMatch?.itemPrice || null,
                    itemId: item.pricesheetMatch?.itemId || null
                },
                location: item.location || null,
                specifications: item.specifications || null,
                notes: item.notes || null,
                unitPrice: item.unitPrice || null,
                totalPrice: item.totalPrice || null,
                isActive: item.isActive !== undefined ? item.isActive : true
            };
        });

        // Update the bid with new demolition items in aiExtractedData
        const updatedBid = await Bid.findOneAndUpdate(
            { _id: id, user: req.session.userId },
            { 
                $set: {
                    'aiExtractedData.demolitionItems': processedItems,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedBid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        // Calculate total value from AI extracted demolition items
        const totalValue = (updatedBid.aiExtractedData?.demolitionItems || []).reduce((sum, item) => {
            const price = parseFloat(item.totalPrice || item.pricing || 0);
            return sum + (isNaN(price) ? 0 : price);
        }, 0);

        console.log('Demolition items updated successfully in aiExtractedData:', {
            bidId: updatedBid._id,
            itemsCount: (updatedBid.aiExtractedData?.demolitionItems || []).length,
            totalValue: totalValue
        });

        res.status(200).json({
            success: true,
            message: 'Demolition items updated successfully',
            data: {
                demolitionItems: updatedBid.aiExtractedData?.demolitionItems || [],
                summary: {
                    totalItems: (updatedBid.aiExtractedData?.demolitionItems || []).length,
                    totalValue: totalValue
                }
            }
        });
    } catch (error) {
        console.error('Error updating bid items:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


// ===

// export const updateBidItems = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { demolitionItems } = req.body;

//         console.log("========= incoming data of update api....",req.body);

//         console.log('=== UPDATE BID ITEMS API CALLED ===');
//         console.log('User ID:', req.session.userId);
//         console.log('Bid ID:', id);
//         console.log('Items to update:', demolitionItems?.length || 0);
//         console.log('Timestamp:', new Date().toISOString());

//         // Validate ObjectId
//         const mongoose = await import('mongoose');
//         if (!mongoose.default.Types.ObjectId.isValid(id)) {
//             console.log('VALIDATION ERROR: Invalid ObjectId format');
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid bid ID format'
//             });
//         }

//         // Validate demolitionItems format
//         if (!Array.isArray(demolitionItems)) {
//             console.log('VALIDATION ERROR: demolitionItems must be an array');
//             return res.status(400).json({
//                 success: false,
//                 message: 'demolitionItems must be an array'
//             });
//         }

//         // Process demolitionItems to match the structure used in createBidWithDocument
//         const processedItems = demolitionItems.map(item => {
//             // Handle mixed categories like "electrical, mechanical, plumbing"
//             let category = item.category || 'other';
//             if (category.includes(',')) {
//                 // If multiple categories, take the first one
//                 category = category.split(',')[0].trim();
//             }
            
//             // Map category variations to model enum values
//             const categoryMap = {
//                 'HVAC': 'hvac',
//                 'MEP': 'electrical',
//                 'Storefront': 'storefront',
//                 'signage': 'signage'
//             };
            
//             category = categoryMap[category] || category.toLowerCase();
            
//             // Ensure category is in allowed enum, fallback to 'other'
//             const allowedCategories = [
//                 'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
//                 'cleanup', 'door', 'window', 'fixture', 'hvac', 
//                 'structural', 'interior', 'exterior', 'other',
//                 'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
//                 'Storefront', 'mechanical'
//             ];
            
//             if (!allowedCategories.includes(category)) {
//                 category = 'other';
//             }
            
//             // Use the action from input directly as string
//             let action = item.action || 'Remove';
            
//             return {
//                 itemNumber: item.itemNumber || null,
//                 description: item.description || 'No description',
//                 category: category,
//                 action: action,
//                 measurements: {
//                     quantity: item.measurements?.quantity || null,
//                     unit: item.measurements?.unit || null,
//                     dimensions: item.measurements?.dimensions || null
//                 },
//                 pricing: item.pricing || item.totalPrice || null,
//                 location: item.location || null,
//                 specifications: item.specifications || null,
//                 notes: item.notes || null,
//                 unitPrice: item.unitPrice || null,
//                 totalPrice: item.totalPrice || null,
//                 isActive: item.isActive !== undefined ? item.isActive : true
//             };
//         });

//         // Update the bid with new demolition items
//         const updatedBid = await Bid.findOneAndUpdate(
//             { _id: id, user: req.session.userId },
//             { 
//                 demolitionItems: processedItems,
//                 updatedAt: new Date()
//             },
//             { new: true, runValidators: true }
//         );

//         if (!updatedBid) {
//             console.log('BID NOT FOUND or ACCESS DENIED');
//             return res.status(404).json({
//                 success: false,
//                 message: 'Bid not found or access denied'
//             });
//         }

//         // Calculate total value from demolition items
//         const totalValue = updatedBid.demolitionItems.reduce((sum, item) => {
//             const price = parseFloat(item.totalPrice || item.pricing || 0);
//             return sum + (isNaN(price) ? 0 : price);
//         }, 0);

//         console.log('Demolition items updated successfully:', {
//             bidId: updatedBid._id,
//             itemsCount: updatedBid.demolitionItems.length,
//             totalValue: totalValue
//         });

//         res.status(200).json({
//             success: true,
//             message: 'Demolition items updated successfully',
//             data: {
//                 demolitionItems: updatedBid.demolitionItems,
//                 summary: {
//                     totalItems: updatedBid.demolitionItems.length,
//                     totalValue: totalValue
//                 }
//             }
//         });

//         console.log('UPDATE BID ITEMS - Response sent successfully');
//     } catch (error) {
//         console.error('=== UPDATE BID ITEMS ERROR ===');
//         console.error('Error:', error.message);
//         console.error('Stack:', error.stack);
        
//         res.status(500).json({
//             success: false,
//             message: 'Error updating bid items',
//             error: error.message
//         });
//     }
// };

// Get demolition items from AI extracted data for frontend display
export const getDemolitionItems = async (req, res) => {
    try {
        const bid = await Bid.findById(req.params.id);
        
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        // Check if user owns this bid
        if (bid.user.toString() !== req.session.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Extract demolition items from AI extracted data
        const aiData = bid.aiExtractedData || {};
        const demolitionItems = aiData.demolitionItems || [];
        
        // Format the items for frontend display with new measurement structure
        const formattedItems = demolitionItems.map((item, index) => {
            // Build measurement display based on new structure
            let measurementDisplay = null;
            if (item.measurements) {
                const { quantity, unit, squareFeet, linearFeet, count, dimensions } = item.measurements;
                
                if (squareFeet && squareFeet > 0) {
                    measurementDisplay = `${squareFeet} SF`;
                } else if (linearFeet && linearFeet > 0) {
                    measurementDisplay = `${linearFeet} LF`;
                } else if (count && count > 0) {
                    measurementDisplay = `${count} EA`;
                } else if (quantity && quantity > 0) {
                    measurementDisplay = `${quantity} ${unit || ''}`.trim();
                }
            }

            return {
                id: item._id || `item_${index}`,
                itemNumber: item.itemNumber || null,
                name: item.name || item.description || 'Unnamed Item',
                description: item.description || 'No description',
                measurement: measurementDisplay,
                // New measurement structure
                measurements: {
                    quantity: item.measurements?.quantity || null,
                    unit: item.measurements?.unit || null,
                    squareFeet: item.measurements?.squareFeet || null,
                    linearFeet: item.measurements?.linearFeet || null,
                    count: item.measurements?.count || null,
                    dimensions: item.measurements?.dimensions || null
                },
                price: item.unitPrice || null,
                proposedBid: item.proposedBid || null,
                calculatedTotalPrice: item.calculatedTotalPrice || null,
                calculatedUnitPrice: item.calculatedUnitPrice || null,
                location: item.location || null,
                specifications: item.specifications || null,
                notes: item.notes || null,
                category: item.category || null,
                action: item.action || null,
                // Include pricesheet matching information
                pricesheetMatch: {
                    matched: item.pricesheetMatch?.matched || false,
                    itemName: item.pricesheetMatch?.itemName || null,
                    itemPrice: item.pricesheetMatch?.itemPrice || null,
                    itemId: item.pricesheetMatch?.itemId || null
                },
                // Include price calculation metadata
                priceCalculation: item.priceCalculation || null,
                originalData: item
            };
        });

        res.json({
            success: true,
            bidId: bid._id,
            projectName: bid.projectName,
            demolitionItems: formattedItems,
            totalItems: formattedItems.length,
            measurementSummary: aiData.measurementSummary || null,
            pricingSummary: aiData.pricingSummary || null,
            extractionNotes: aiData.extractionNotes || null
        });

    } catch (error) {
        console.error('Get demolition items error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};



// Update a single demolition item
export const updateDemolitionItem = async (req, res) => {
    try {
        const { id: bidId, itemId } = req.params;
        const itemData = req.body;

        console.log("========= UPDATE SINGLE DEMOLITION ITEM API CALLED =========");
        console.log('User ID:', req.session.userId);
        console.log('Bid ID:', bidId);
        console.log('Item ID:', itemId);
        console.log('Item Data:', itemData);

        // Validate ObjectId
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(bidId)) {
            console.log('VALIDATION ERROR: Invalid bid ID format');
            return res.status(400).json({
                success: false,
                message: 'Invalid bid ID format'
            });
        }

        // Find the bid
        const { Bid } = await import('../models/bid.js');
        const bid = await Bid.findOne({ _id: bidId, user: req.session.userId });

        if (!bid) {
            console.log('BID NOT FOUND or ACCESS DENIED');
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        // Debug: Log all available items in aiExtractedData
        console.log('Available AI extracted demolition items:');
        const aiDemolitionItems = bid.aiExtractedData?.demolitionItems || [];
        aiDemolitionItems.forEach((item, index) => {
            console.log(`  [${index}] ID: ${item._id || 'none'}, itemNumber: ${item.itemNumber}, description: ${item.description?.substring(0, 50)}...`);
        });

        // Find the demolition item to update in aiExtractedData
        // Try multiple search strategies
        let demolitionItemIndex = -1;
        
        // Strategy 1: Search by itemNumber
        demolitionItemIndex = aiDemolitionItems.findIndex(item => item.itemNumber === itemId);
        if (demolitionItemIndex !== -1) {
            console.log(`Found item by itemNumber: ${itemId} at index ${demolitionItemIndex}`);
        }
        
        // Strategy 2: Search by _id
        if (demolitionItemIndex === -1) {
            demolitionItemIndex = aiDemolitionItems.findIndex(item => item._id?.toString() === itemId);
            if (demolitionItemIndex !== -1) {
                console.log(`Found item by _id: ${itemId} at index ${demolitionItemIndex}`);
            }
        }
        
        // Strategy 3: Search by index-based ID like "item_18"
        if (demolitionItemIndex === -1 && itemId.startsWith('item_')) {
            const itemIndex = parseInt(itemId.replace('item_', ''));
            if (!isNaN(itemIndex) && itemIndex >= 0 && itemIndex < aiDemolitionItems.length) {
                demolitionItemIndex = itemIndex;
                console.log(`Found item by index: ${itemId} -> index ${demolitionItemIndex}`);
            }
        }

        if (demolitionItemIndex === -1) {
            console.log('DEMOLITION ITEM NOT FOUND in aiExtractedData:', itemId);
            console.log('Searched with strategies: itemNumber, _id, index-based');
            return res.status(404).json({
                success: false,
                message: 'Demolition item not found'
            });
        }

        // Update the demolition item in aiExtractedData
        if (!bid.aiExtractedData) {
            bid.aiExtractedData = {};
        }
        if (!bid.aiExtractedData.demolitionItems) {
            bid.aiExtractedData.demolitionItems = [];
        }

        const existingItem = bid.aiExtractedData.demolitionItems[demolitionItemIndex];
        
        // Validate and normalize category
        let category = itemData.category || existingItem.category || 'other';
        if (category.includes(',')) {
            // If multiple categories, take the first one
            category = category.split(',')[0].trim();
        }
        
        // Map category variations to model enum values
        const categoryMap = {
            'HVAC': 'hvac',
            'MEP': 'electrical',
            'Storefront': 'storefront',
            'signage': 'signage',
            'demolition': 'other', // Map 'demolition' to 'other'
            'mechanical': 'mechanical'
        };
        
        category = categoryMap[category] || category.toLowerCase();
        
        // Ensure category is in allowed enum, fallback to 'other'
        const allowedCategories = [
            'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
            'cleanup', 'door', 'window', 'fixture', 'hvac', 
            'structural', 'interior', 'exterior', 'other',
            'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
            'Storefront', 'mechanical'
        ];
        
        if (!allowedCategories.includes(category)) {
            category = 'other';
        }
        
        // --- Normalize measurement inputs (quantity/unit) ---
        const toNumber = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'number') return isNaN(val) ? null : val;
            const cleaned = String(val).replace(/[,]/g, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
        };

        // Safer numeric parser for currency-like strings
        const safeParseFloat = (value, defaultValue = 0) => {
            if (value === null || value === undefined || value === '') return defaultValue;
            if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
            const cleaned = String(value).replace(/[$,]/g, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? defaultValue : parsed;
        };

        // Extract a valid unit from strings like "1 EA", "EA", "sf", "75 LF", etc.
        const extractUnit = (value) => {
            if (!value) return null;
            const str = String(value).toUpperCase();
            const match = str.match(/\b(SF|LF|EA|CY|SY)\b/);
            return match ? match[1] : null;
        };

        // Derive normalized quantity and unit from incoming data
        const incomingMeasurements = itemData.measurements || {};
        const rawMeasurementString = itemData.measurement || '';

        // If a combined measurement string like "2 EA" is provided, prefer parsing from it
        let normalizedQuantity = null;
        let normalizedUnit = null;
        const rawMatch = String(rawMeasurementString).toUpperCase().match(/(\d+(?:\.\d+)?)\s*(SF|LF|EA|CY|SY)\b/);
        if (rawMatch) {
            normalizedQuantity = toNumber(rawMatch[1]);
            normalizedUnit = rawMatch[2];
        }

        // If still missing, use explicit quantity/unit fields
        if (normalizedQuantity === null) {
            normalizedQuantity = toNumber(incomingMeasurements.quantity);
        }
        if (normalizedQuantity === null) {
            const qtyFromAlt = String(incomingMeasurements.unit || '')
                .match(/\d+(?:\.\d+)?/);
            normalizedQuantity = qtyFromAlt ? toNumber(qtyFromAlt[0]) : existingItem.measurements?.quantity || null;
        }

        if (!normalizedUnit) {
            normalizedUnit = extractUnit(incomingMeasurements.unit) 
                || extractUnit(rawMeasurementString) 
                || (existingItem.measurements?.unit ? extractUnit(existingItem.measurements.unit) : null);
        }
        
        // Ensure unit is one of the allowed enums (or null)
        const allowedUnits = ['SF','LF','EA','CY','SY'];
        if (normalizedUnit && !allowedUnits.includes(normalizedUnit)) {
            normalizedUnit = null;
        }
        
        // Keep dimensions if provided
        const normalizedDimensions = incomingMeasurements.dimensions || existingItem.measurements?.dimensions || null;
        
        // Merge the updates with existing data in aiExtractedData
        bid.aiExtractedData.demolitionItems[demolitionItemIndex] = {
            ...existingItem,
            name: itemData.name || existingItem.name || itemData.description || existingItem.description, // Use name field primarily
            description: itemData.description || itemData.name || existingItem.description,
            category: category,
            action: itemData.action || existingItem.action,
            measurements: {
                quantity: normalizedQuantity,
                unit: normalizedUnit,
                dimensions: normalizedDimensions
            },
            pricing: itemData.pricing || String(itemData.price) || existingItem.pricing,
            // Handle pricesheet matching information
            pricesheetMatch: {
                matched: itemData.pricesheetMatch?.matched !== undefined ? itemData.pricesheetMatch.matched : existingItem.pricesheetMatch?.matched || false,
                itemName: itemData.pricesheetMatch?.itemName || existingItem.pricesheetMatch?.itemName || null,
                itemPrice: itemData.pricesheetMatch?.itemPrice || existingItem.pricesheetMatch?.itemPrice || null,
                itemId: itemData.pricesheetMatch?.itemId || existingItem.pricesheetMatch?.itemId || null
            },
            unitPrice: itemData.unitPrice || String(itemData.price) || existingItem.unitPrice,
            totalPrice: itemData.totalPrice || String(itemData.price) || existingItem.totalPrice,
            proposedBid: itemData.proposedBid !== undefined ? Number(itemData.proposedBid) : existingItem.proposedBid,
            notes: itemData.notes || existingItem.notes,
            isActive: itemData.isActive !== undefined ? itemData.isActive : existingItem.isActive,
            location: itemData.location || existingItem.location,
            specifications: itemData.specifications || existingItem.specifications,
            itemNumber: existingItem.itemNumber,
            // Keep backward compatibility fields
            measurement: itemData.measurement || existingItem.measurement,
            price: Number(itemData.price) || existingItem.price
        };

        // --- Recalculate calculatedUnitPrice and calculatedTotalPrice ---
        const updatedItem = bid.aiExtractedData.demolitionItems[demolitionItemIndex];

        const quantityForCalc = updatedItem.measurements?.quantity != null
            ? Number(updatedItem.measurements.quantity)
            : 0;

        let unitPriceForCalc = 0;
        let calculationMethod = 'manual';
        let hasValidPrice = false;

        // Priority 1: pricesheet matched price
        if (updatedItem.pricesheetMatch?.matched && updatedItem.pricesheetMatch?.itemPrice) {
            const matchedPrice = safeParseFloat(updatedItem.pricesheetMatch.itemPrice);
            if (matchedPrice > 0) {
                unitPriceForCalc = matchedPrice;
                calculationMethod = 'pricesheet';
                hasValidPrice = true;
            }
        }

        // Priority 2: explicit unitPrice/pricing
        if (!hasValidPrice) {
            const explicitUnit = safeParseFloat(itemData.unitPrice ?? updatedItem.unitPrice);
            if (explicitUnit > 0) {
                unitPriceForCalc = explicitUnit;
                calculationMethod = 'manual';
                hasValidPrice = true;
            }
        }

        if (!hasValidPrice) {
            const parsedPricing = safeParseFloat(updatedItem.pricing);
            if (parsedPricing > 0) {
                unitPriceForCalc = parsedPricing;
                calculationMethod = 'ai_extracted';
                hasValidPrice = true;
            }
        }

        // Priority 3: derive from totalPrice if quantity present
        if (!hasValidPrice) {
            const totalGiven = safeParseFloat(updatedItem.totalPrice);
            if (totalGiven > 0 && quantityForCalc > 0) {
                unitPriceForCalc = totalGiven / quantityForCalc;
                calculationMethod = 'ai_extracted';
                hasValidPrice = true;
            }
        }

        const calculatedTotal = (quantityForCalc > 0 && unitPriceForCalc > 0) 
            ? quantityForCalc * unitPriceForCalc 
            : 0;

        updatedItem.calculatedUnitPrice = unitPriceForCalc;
        updatedItem.calculatedTotalPrice = calculatedTotal;
        // Keep legacy string fields in sync with calculated values
        if (unitPriceForCalc > 0) {
            updatedItem.unitPrice = unitPriceForCalc.toString();
        }
        if (calculatedTotal >= 0) {
            updatedItem.totalPrice = calculatedTotal.toFixed(2);
        }
        updatedItem.priceCalculation = {
            quantity: quantityForCalc,
            unitPrice: unitPriceForCalc,
            totalPrice: calculatedTotal,
            calculationMethod,
            lastCalculated: new Date(),
            hasValidPrice,
            measurementType: updatedItem.measurements?.unit || 'unknown'
        };

        // Also update the root-level demolitionItems array if it exists for backward compatibility
        if (bid.demolitionItems && bid.demolitionItems[demolitionItemIndex]) {
            Object.assign(bid.demolitionItems[demolitionItemIndex], bid.aiExtractedData.demolitionItems[demolitionItemIndex]);
        }

        // Mark the aiExtractedData as modified for Mongoose
        bid.markModified('aiExtractedData');

        // Recalculate all totals after item update
        try {
            await bid.calculateAllPrices();
        } catch (calcErr) {
            console.warn('⚠️ Price recalculation warning:', calcErr.message);
        }

        // Save the updated bid
        bid.updatedAt = new Date();
        await bid.save();

        console.log('✅ Demolition item updated successfully in aiExtractedData:', {
            bidId: bid._id,
            itemId: itemId,
            updatedItem: bid.aiExtractedData.demolitionItems[demolitionItemIndex]
        });

        res.status(200).json({
            success: true,
            message: 'Demolition item updated successfully',
            data: {
                demolitionItem: bid.aiExtractedData.demolitionItems[demolitionItemIndex],
                bidId: bid._id
            }
        });

    } catch (error) {
        console.error('=== UPDATE DEMOLITION ITEM ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Error updating demolition item',
            error: error.message
        });
    }
};

// ===

// PUT: Update project details
export const updateProjectDetails = async (req, res) => {
    try {
        const { bidId } = req.params;
        const projectData = req.body;
        const userId = req.session.userId;

        console.log('📋 Updating project details for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Update project details efficiently
        bid.projectDetails = {
            ...bid.projectDetails?.toObject(),
            ...projectData
        };
        bid.modifiedBy = userId;
        bid.lastModified = new Date();

        await bid.save();

        console.log('✅ Project details updated successfully');

        res.json({
            success: true,
            message: 'Project details updated successfully',
            projectDetails: bid.projectDetails,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Project details update error:', error);
        res.status(500).json({
            message: 'Failed to update project details',
            error: error.message
        });
    }
};

// PUT: Update specific demolition item (optimized)
export const updateDemolitionItemOptimized = async (req, res) => {
    try {
        const { id: bidId, itemId } = req.params;
        const updateData = req.body;
        const userId = req.session.userId;

        console.log('🔨 Updating demolition item:', itemId, 'for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Validate and normalize category if it's being updated
        if (updateData.category) {
            let category = updateData.category;
            if (category.includes(',')) {
                // If multiple categories, take the first one
                category = category.split(',')[0].trim();
            }
            
            // Map category variations to model enum values
            const categoryMap = {
                'HVAC': 'hvac',
                'MEP': 'electrical',
                'Storefront': 'storefront',
                'signage': 'signage',
                'demolition': 'other', // Map 'demolition' to 'other'
                'mechanical': 'mechanical'
            };
            
            category = categoryMap[category] || category.toLowerCase();
            
            // Ensure category is in allowed enum, fallback to 'other'
            const allowedCategories = [
                'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
                'cleanup', 'door', 'window', 'fixture', 'hvac', 
                'structural', 'interior', 'exterior', 'other',
                'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
                'Storefront', 'mechanical'
            ];
            
            if (!allowedCategories.includes(category)) {
                category = 'other';
            }
            
            updateData.category = category;
        }

        // Use the instance method for efficient item updates
        await bid.updateDemolitionItem(itemId, updateData);

        const updatedItem = bid.demolitionItems.id(itemId);

        console.log('✅ Demolition item updated successfully');

        res.json({
            success: true,
            message: 'Demolition item updated successfully',
            item: updatedItem,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Demolition item update error:', error);
        res.status(500).json({
            message: 'Failed to update demolition item',
            error: error.message
        });
    }
};

// POST: Add new demolition item
export const addDemolitionItem = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const itemData = req.body;
        const userId = req.session.userId;

        console.log('➕ Adding new demolition item to bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Validate and normalize category before adding
        let category = itemData.category || 'other';
        if (category.includes(',')) {
            // If multiple categories, take the first one
            category = category.split(',')[0].trim();
        }
        
        // Map category variations to model enum values
        const categoryMap = {
            'HVAC': 'hvac',
            'MEP': 'electrical',
            'Storefront': 'storefront',
            'signage': 'signage',
            'demolition': 'other', // Map 'demolition' to 'other'
            'mechanical': 'mechanical'
        };
        
        category = categoryMap[category] || category.toLowerCase();
        
        // Ensure category is in allowed enum, fallback to 'other'
        const allowedCategories = [
            'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
            'cleanup', 'door', 'window', 'fixture', 'hvac', 
            'structural', 'interior', 'exterior', 'other',
            'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
            'Storefront', 'mechanical'
        ];
        
        if (!allowedCategories.includes(category)) {
            category = 'other';
        }

        // Measurement parsing helpers
        const toNumber = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'number') return isNaN(val) ? null : val;
            const cleaned = String(val).replace(/[$,]/g, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? null : parsed;
        };
        const extractUnit = (value) => {
            if (!value) return null;
            const str = String(value).toUpperCase();
            const match = str.match(/\b(SF|LF|EA|CY|SY)\b/);
            return match ? match[1] : null;
        };
        const measurementStr = itemData.measurement || '';
        const match = String(measurementStr).toUpperCase().match(/(\d+(?:\.\d+)?)\s*(SF|LF|EA|CY|SY)\b/);
        const parsedQuantity = match ? toNumber(match[1]) : toNumber(itemData.measurements?.quantity);
        const parsedUnit = match ? match[2] : extractUnit(itemData.measurements?.unit) || extractUnit(measurementStr);

        // Prepare validated item data with new structure
        const validatedItemData = {
            ...itemData,
            name: itemData.name || itemData.description || 'New Item', // Ensure name field is included
            description: itemData.description || itemData.name || 'No description',
            category: category,
            measurements: {
                quantity: parsedQuantity ?? null,
                unit: parsedUnit ?? null,
                dimensions: itemData.measurements?.dimensions || null
            },
            unitPrice: itemData.unitPrice || (itemData.price != null ? String(itemData.price) : undefined),
            totalPrice: itemData.totalPrice,
            proposedBid: itemData.proposedBid != null ? Number(itemData.proposedBid) : null,
            pricing: itemData.pricing,
            // Initialize pricesheet matching structure if not provided
            pricesheetMatch: {
                matched: itemData.pricesheetMatch?.matched || false,
                itemName: itemData.pricesheetMatch?.itemName || null,
                itemPrice: itemData.pricesheetMatch?.itemPrice || null,
                itemId: itemData.pricesheetMatch?.itemId || null
            }
        };

        // Use the instance method for efficient item addition
        await bid.addDemolitionItem(validatedItemData);

        // Also push into AI-extracted list with auto itemNumbering if present
        if (!bid.aiExtractedData) bid.aiExtractedData = {};
        if (!Array.isArray(bid.aiExtractedData.demolitionItems)) bid.aiExtractedData.demolitionItems = [];
        const nextItemNumber = String(bid.aiExtractedData.demolitionItems.length + 1);
        const aiItem = {
            itemNumber: nextItemNumber,
            name: validatedItemData.name,
            description: validatedItemData.description,
            category: validatedItemData.category,
            action: validatedItemData.action || 'Remove',
            measurements: validatedItemData.measurements || { quantity: null, unit: null, dimensions: null },
            pricing: validatedItemData.pricing || null,
            pricesheetMatch: validatedItemData.pricesheetMatch,
            unitPrice: validatedItemData.unitPrice,
            totalPrice: validatedItemData.totalPrice,
            proposedBid: validatedItemData.proposedBid ?? null,
            isActive: true
        };
        bid.aiExtractedData.demolitionItems.push(aiItem);
        bid.markModified('aiExtractedData');

        // Recalculate totals after insertion
        try {
            await bid.calculateAllPrices();
        } catch (calcErr) {
            console.warn('⚠️ Price recalculation warning (add):', calcErr.message);
        }

        const newItem = bid.demolitionItems[bid.demolitionItems.length - 1];

        console.log('✅ Demolition item added successfully');

        res.json({
            success: true,
            message: 'Demolition item added successfully',
            item: newItem,
            totalItems: bid.activeDemolitionItemsCount,
            pricingSummary: bid.pricingSummary,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Add demolition item error:', error);
        res.status(500).json({
            message: 'Failed to add demolition item',
            error: error.message
        });
    }
};

// DELETE: Remove demolition item (soft delete)
export const removeDemolitionItem = async (req, res) => {
    try {
        const { id: bidId, itemId } = req.params;
        const userId = req.session.userId;

        console.log('🗑️ Removing demolition item:', itemId, 'from bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Use the instance method for efficient item removal (soft delete)
        await bid.removeDemolitionItem(itemId);

        console.log('✅ Demolition item removed successfully');

        res.json({
            success: true,
            message: 'Demolition item removed successfully',
            totalActiveItems: bid.activeDemolitionItemsCount,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Remove demolition item error:', error);
        res.status(500).json({
            message: 'Failed to remove demolition item',
            error: error.message
        });
    }
};

// PUT: Bulk update demolition items
export const bulkUpdateDemolitionItems = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const { items } = req.body; // Array of {id, updateData}
        const userId = req.session.userId;

        console.log('🔄 Bulk updating demolition items for bid:', bidId);
        console.log(`📊 Updating ${items.length} items`);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        let updateCount = 0;
        const errors = [];

        // Process each item update
        for (const { id, updateData } of items) {
            try {
                const item = bid.demolitionItems.id(id);
                if (item) {
                    // Validate and normalize category if it's being updated
                    if (updateData.category) {
                        let category = updateData.category;
                        if (category.includes(',')) {
                            // If multiple categories, take the first one
                            category = category.split(',')[0].trim();
                        }
                        
                        // Map category variations to model enum values
                        const categoryMap = {
                            'HVAC': 'hvac',
                            'MEP': 'electrical',
                            'Storefront': 'storefront',
                            'signage': 'signage',
                            'demolition': 'other', // Map 'demolition' to 'other'
                            'mechanical': 'mechanical'
                        };
                        
                        category = categoryMap[category] || category.toLowerCase();
                        
                        // Ensure category is in allowed enum, fallback to 'other'
                        const allowedCategories = [
                            'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
                            'cleanup', 'door', 'window', 'fixture', 'hvac', 
                            'structural', 'interior', 'exterior', 'other',
                            'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
                            'Storefront', 'mechanical'
                        ];
                        
                        if (!allowedCategories.includes(category)) {
                            category = 'other';
                        }
                        
                        updateData.category = category;
                    }
                    
                    Object.assign(item, updateData);
                    updateCount++;
                }
            } catch (error) {
                errors.push({ itemId: id, error: error.message });
            }
        }

        // Save all changes at once
        bid.modifiedBy = userId;
        bid.lastModified = new Date();
        await bid.save();

        console.log(`✅ Bulk update completed: ${updateCount} items updated`);

        res.json({
            success: true,
            message: `Bulk update completed: ${updateCount} items updated`,
            updatedCount: updateCount,
            errors: errors,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Bulk update error:', error);
        res.status(500).json({
            message: 'Failed to bulk update demolition items',
            error: error.message
        });
    }
};

// GET: Detailed bid information with all related data
export const getBidDetailed = async (req, res) => {
    try {
        const { bidId } = req.params;
        const userId = req.session.userId;

        console.log('📋 Fetching detailed bid information for:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId })
            .populate('modifiedBy', 'name email')
            .lean();

        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Add calculated fields
        const activeDemolitionItems = bid.demolitionItems?.filter(item => item.isActive !== false) || [];
        const calculatedTotal = activeDemolitionItems.reduce((total, item) => {
            if (!item.pricing) return total;
            const numericPrice = parseFloat((item.pricing || '0').replace(/[$,]/g, ''));
            return total + (isNaN(numericPrice) ? 0 : numericPrice);
        }, 0);

        const detailedBid = {
            ...bid,
            activeDemolitionItemsCount: activeDemolitionItems.length,
            calculatedTotalCost: calculatedTotal,
            formattedTotalCost: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(calculatedTotal)
        };

        console.log('✅ Detailed bid information retrieved');

        res.json({
            success: true,
            bid: detailedBid
        });

    } catch (error) {
        console.error('❌ Get detailed bid error:', error);
        res.status(500).json({
            message: 'Failed to retrieve bid details',
            error: error.message
        });
    }
};

// PUT: Update proposed bid amount
export const updateProposedBid = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const { proposedBid } = req.body;
        const userId = req.session.userId;

        console.log('💰 Updating proposed bid for bid:', bidId, 'Amount:', proposedBid);

        // Validate proposed bid amount
        if (proposedBid === undefined || proposedBid === null) {
            return res.status(400).json({
                success: false,
                message: 'Proposed bid amount is required'
            });
        }

        const numericProposedBid = parseFloat(proposedBid);
        if (isNaN(numericProposedBid) || numericProposedBid < 0) {
            return res.status(400).json({
                success: false,
                message: 'Proposed bid must be a valid positive number'
            });
        }

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        // Update proposed bid
        bid.proposedBid = numericProposedBid;
        bid.modifiedBy = userId;
        bid.lastModified = new Date();

        await bid.save();

        console.log('✅ Proposed bid updated successfully:', numericProposedBid);

        res.json({
            success: true,
            message: 'Proposed bid updated successfully',
            proposedBid: numericProposedBid,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Update proposed bid error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update proposed bid',
            error: error.message
        });
    }
};

// POST: Calculate all prices for demolition items
export const calculateAllPrices = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const userId = req.session.userId;

        console.log('💰 Calculating all prices for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        // Calculate prices using the instance method
        const calculationResult = bid.calculateAllPrices();

        // Save the updated bid
        await bid.save();

        console.log('✅ Price calculation completed successfully');

        res.json({
            success: true,
            message: 'Price calculation completed successfully',
            calculationResult: calculationResult,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Calculate prices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate prices',
            error: error.message
        });
    }
};

// GET: Get pricing summary for a bid
export const getPricingSummary = async (req, res) => {
    try {
        const { id: bidId } = req.params;
        const userId = req.session.userId;

        console.log('📊 Getting pricing summary for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        // Calculate current totals
        let totalCalculatedCost = 0;
        let totalProposedBid = 0;
        let itemsWithPrices = 0;
        let itemsWithProposedBids = 0;
        let itemsWithPricesheetMatch = 0;

        // Calculate from AI extracted demolition items (prioritized)
        if (bid.aiExtractedData?.demolitionItems && Array.isArray(bid.aiExtractedData.demolitionItems)) {
            bid.aiExtractedData.demolitionItems.forEach(item => {
                if (item.calculatedTotalPrice) {
                    totalCalculatedCost += item.calculatedTotalPrice;
                    itemsWithPrices++;
                }
                if (item.proposedBid) {
                    totalProposedBid += item.proposedBid;
                    itemsWithProposedBids++;
                }
                if (item.pricesheetMatch?.matched) {
                    itemsWithPricesheetMatch++;
                }
            });
        }

        // Calculate from regular demolition items
        if (bid.demolitionItems && Array.isArray(bid.demolitionItems)) {
            bid.demolitionItems.forEach(item => {
                if (item.calculatedTotalPrice) {
                    totalCalculatedCost += item.calculatedTotalPrice;
                    itemsWithPrices++;
                }
                if (item.proposedBid) {
                    totalProposedBid += item.proposedBid;
                    itemsWithProposedBids++;
                }
                if (item.pricesheetMatch?.matched) {
                    itemsWithPricesheetMatch++;
                }
            });
        }

        const pricingSummary = {
            totalCalculatedCost: totalCalculatedCost,
            totalProposedBid: totalProposedBid,
            itemsWithPrices: itemsWithPrices,
            itemsWithProposedBids: itemsWithProposedBids,
            itemsWithPricesheetMatch: itemsWithPricesheetMatch,
            totalItems: (bid.aiExtractedData?.demolitionItems?.length || 0) + (bid.demolitionItems?.length || 0),
            pricingSummary: bid.pricingSummary,
            lastCalculated: new Date()
        };

        console.log('✅ Pricing summary retrieved successfully');

        res.json({
            success: true,
            pricingSummary: pricingSummary
        });

    } catch (error) {
        console.error('❌ Get pricing summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get pricing summary',
            error: error.message
        });
    }
};

// PUT: Update proposed bid for individual demolition item
export const updateItemProposedBid = async (req, res) => {
    try {
        const { id: bidId, itemId } = req.params;
        const { proposedBid } = req.body;
        const userId = req.session.userId;

        console.log('💰 Updating proposed bid for item:', itemId, 'in bid:', bidId, 'Amount:', proposedBid);

        // Validate proposed bid amount
        if (proposedBid === undefined || proposedBid === null) {
            return res.status(400).json({
                success: false,
                message: 'Proposed bid amount is required'
            });
        }

        const numericProposedBid = parseFloat(proposedBid);
        if (isNaN(numericProposedBid) || numericProposedBid < 0) {
            return res.status(400).json({
                success: false,
                message: 'Proposed bid must be a valid positive number'
            });
        }

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found or access denied'
            });
        }

        // Find the demolition item in AI extracted data (prioritized)
        let demolitionItemIndex = -1;
        let demolitionItem = null;
        
        if (bid.aiExtractedData?.demolitionItems && Array.isArray(bid.aiExtractedData.demolitionItems)) {
            // Try multiple search strategies
            demolitionItemIndex = bid.aiExtractedData.demolitionItems.findIndex(item => item.itemNumber === itemId);
            if (demolitionItemIndex === -1) {
                demolitionItemIndex = bid.aiExtractedData.demolitionItems.findIndex(item => item._id?.toString() === itemId);
            }
            if (demolitionItemIndex === -1 && itemId.startsWith('item_')) {
                const itemIndex = parseInt(itemId.replace('item_', ''));
                if (!isNaN(itemIndex) && itemIndex >= 0 && itemIndex < bid.aiExtractedData.demolitionItems.length) {
                    demolitionItemIndex = itemIndex;
                }
            }
            
            if (demolitionItemIndex !== -1) {
                demolitionItem = bid.aiExtractedData.demolitionItems[demolitionItemIndex];
            }
        }

        if (!demolitionItem) {
            return res.status(404).json({
                success: false,
                message: 'Demolition item not found'
            });
        }

        // Update proposed bid
        demolitionItem.proposedBid = numericProposedBid;
        
        // Update price calculation metadata
        if (!demolitionItem.priceCalculation) {
            demolitionItem.priceCalculation = {};
        }
        demolitionItem.priceCalculation.proposedBid = numericProposedBid;
        demolitionItem.priceCalculation.lastCalculated = new Date();

        // Mark the document as modified
        bid.markModified('aiExtractedData');
        bid.modifiedBy = userId;
        bid.lastModified = new Date();

        await bid.save();

        console.log('✅ Item proposed bid updated successfully:', {
            itemName: demolitionItem.name,
            proposedBid: numericProposedBid
        });

        res.json({
            success: true,
            message: 'Item proposed bid updated successfully',
            data: {
                itemId: itemId,
                itemName: demolitionItem.name,
                proposedBid: numericProposedBid,
                revision: bid.revision
            }
        });

    } catch (error) {
        console.error('❌ Update item proposed bid error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update item proposed bid',
            error: error.message
        });
    }
};