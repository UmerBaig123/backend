import { Bid } from '../models/bid.js';
// import cloudinary from '../utils/cloudinary.js';
// import { extractBidDataFromDocument } from '../utils/ai.js';
// import { createBidWithDocument } from '../services/bidDocumentService.js';



// PUT: Update contractor information
export const updateContractorInfo = async (req, res) => {
    try {
        const { bidId } = req.params;
        const contractorData = req.body;
        const userId = req.session.userId;

        console.log('🏢 Updating contractor info for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Update contractor info efficiently
        bid.contractorInfo = {
            ...bid.contractorInfo?.toObject(),
            ...contractorData
        };
        bid.modifiedBy = userId;
        bid.lastModified = new Date();

        await bid.save();

        console.log('✅ Contractor info updated successfully');

        res.json({
            success: true,
            message: 'Contractor information updated successfully',
            contractorInfo: bid.contractorInfo,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Contractor info update error:', error);
        res.status(500).json({
            message: 'Failed to update contractor information',
            error: error.message
        });
    }
};


// Update specific demolition item
// export const updateDemolitionItem = async (req, res) => {
//     try {
//         const { id: bidId, itemId } = req.params;
//         const updates = req.body;

//         const bid = await Bid.findById(bidId);
        
//         if (!bid) {
//             return res.status(404).json({ message: 'Bid not found' });
//         }

//         // Check if user owns this bid
//         if (bid.user.toString() !== req.session.userId) {
//             return res.status(403).json({ message: 'Access denied' });
//         }

//         // Get current AI extracted data
//         const aiData = bid.aiExtractedData || {};
//         const demolitionItems = aiData.demolitionItems || [];
        
//         // Find the item to update (by index if itemId is item_X format, or by actual ID)
//         let itemIndex = -1;
//         if (itemId.startsWith('item_')) {
//             itemIndex = parseInt(itemId.replace('item_', ''));
//         } else {
//             itemIndex = demolitionItems.findIndex(item => 
//                 item._id?.toString() === itemId || item.id === itemId
//             );
//         }

//         if (itemIndex === -1 || itemIndex >= demolitionItems.length) {
//             return res.status(404).json({ message: 'Demolition item not found' });
//         }

//         // Update the specific item
//         const item = demolitionItems[itemIndex];
        
//         // Update name (description)
//         if (updates.name !== undefined) {
//             item.description = updates.name;
//         }
        
//         // Update measurement
//         if (updates.measurement !== undefined) {
//             if (!item.measurements) item.measurements = {};
//             // Parse measurement string like "100 sq ft" into quantity and unit
//             if (updates.measurement) {
//                 const measurementParts = updates.measurement.trim().split(' ');
//                 if (measurementParts.length >= 2) {
//                     item.measurements.quantity = measurementParts[0];
//                     item.measurements.unit = measurementParts.slice(1).join(' ');
//                 } else {
//                     item.measurements.quantity = updates.measurement;
//                 }
//             } else {
//                 item.measurements.quantity = null;
//                 item.measurements.unit = null;
//             }
//         }
        
//         // Update price
//         if (updates.price !== undefined) {
//             item.unitPrice = updates.price;
//         }
        
//         // Update proposed bid
//         if (updates.proposedBid !== undefined) {
//             item.totalPrice = updates.proposedBid;
//         }

//         // Update additional fields
//         if (updates.location !== undefined) {
//             item.location = updates.location;
//         }
        
//         if (updates.specifications !== undefined) {
//             item.specifications = updates.specifications;
//         }
        
//         if (updates.notes !== undefined) {
//             item.notes = updates.notes;
//         }

//         // Save the updated bid
//         bid.aiExtractedData = aiData;
//         await bid.save();

//         // Return the updated item in the format expected by frontend
//         const updatedItem = {
//             id: itemId,
//             itemNumber: item.itemNumber || null,
//             name: item.description || 'Unnamed Item',
//             measurement: item.measurements ? 
//                 `${item.measurements.quantity || ''} ${item.measurements.unit || ''}`.trim() || null : null,
//             price: item.unitPrice || null,
//             proposedBid: item.totalPrice || null,
//             location: item.location || null,
//             specifications: item.specifications || null,
//             notes: item.notes || null
//         };

//         res.json({
//             success: true,
//             message: 'Demolition item updated successfully',
//             updatedItem,
//             bidId: bid._id
//         });

//     } catch (error) {
//         console.error('Update demolition item error:', error);
//         res.status(500).json({
//             message: 'Server error',
//             error: error.message
//         });
//     }
// };

// ===== OPTIMIZED PUT OPERATIONS FOR NEW MODEL STRUCTURE =====

// PUT: Update entire bid (optimized for new structure)
export const updateBidOptimized = async (req, res) => {
    try {
        const { bidId } = req.params;
        const updateData = req.body;
        const userId = req.session.userId;

        console.log('🔄 Optimized bid update for ID:', bidId);
        console.log('📝 Update data received:', Object.keys(updateData));

        // Validate bid ownership
        const existingBid = await Bid.findOne({ _id: bidId, user: userId });
        if (!existingBid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Track who modified the bid
        updateData.modifiedBy = userId;
        updateData.lastModified = new Date();

        // Use the static method for efficient updates
        const updatedBid = await Bid.updateBidEfficiently(bidId, updateData);

        console.log('✅ Bid updated successfully');

        res.json({
            success: true,
            message: 'Bid updated successfully',
            bid: updatedBid,
            revision: updatedBid.revision
        });

    } catch (error) {
        console.error('❌ Optimized bid update error:', error);
        res.status(500).json({
            message: 'Failed to update bid',
            error: error.message
        });
    }
};


// PUT: Update client information
export const updateClientInfo = async (req, res) => {
    try {
        const { bidId } = req.params;
        const clientData = req.body;
        const userId = req.session.userId;

        console.log('👤 Updating client info for bid:', bidId);

        const bid = await Bid.findOne({ _id: bidId, user: userId });
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found or access denied' });
        }

        // Update client info efficiently
        bid.clientInfo = {
            ...bid.clientInfo?.toObject(),
            ...clientData
        };
        bid.modifiedBy = userId;
        bid.lastModified = new Date();

        await bid.save();

        console.log('✅ Client info updated successfully');

        res.json({
            success: true,
            message: 'Client information updated successfully',
            clientInfo: bid.clientInfo,
            revision: bid.revision
        });

    } catch (error) {
        console.error('❌ Client info update error:', error);
        res.status(500).json({
            message: 'Failed to update client information',
            error: error.message
        });
    }
};


// Get demolition items optimized for frontend editing
export const getDemolitionItemsEditable = async (req, res) => {
    try {
        const bid = await Bid.findById(req.params.id);
        
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        // Check if user owns this bid
        if (bid.user.toString() !== req.session.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        console.log('🔍 Getting editable demolition items for bid:', bid._id);

        // Get demolition items from the optimized model structure
        const demolitionItems = bid.demolitionItems || [];
        
        // Format items specifically for frontend editing with all necessary fields
        const editableItems = demolitionItems.map((item, index) => ({
            // Essential identifiers
            id: item._id?.toString() || `temp_${index}`,
            itemNumber: item.itemNumber || (index + 1).toString(),
            
            // Display information
            name: item.description || '',
            description: item.description || '',
            category: item.category || 'general',
            action: item.action || 'remove',
            
            // Measurements (editable)
            measurements: {
                quantity: item.measurements?.quantity || null,
                unit: item.measurements?.unit || null,
                dimensions: item.measurements?.dimensions || null,
                totalArea: item.measurements?.totalArea || null
            },
            
            // Pricing (editable)
            pricing: {
                unitPrice: item.unitPrice || null,
                totalPrice: item.totalPrice || null,
                currency: 'USD'
            },
            
            // Additional editable fields
            location: item.location || null,
            specifications: item.specifications || null,
            notes: item.notes || null,
            
            // Status and flags
            isEdited: item.isEdited || false,
            isActive: item.isActive !== false, // Default to true
            
            // Metadata for tracking
            originalData: {
                extractedBy: item.extractedBy || 'gemini',
                extractedAt: item.extractedAt || bid.createdAt,
                lastModified: item.lastModified || null,
                modifiedBy: item.modifiedBy || null
            },
            
            // Validation helpers
            hasQuantity: !!(item.measurements?.quantity),
            hasPricing: !!(item.unitPrice || item.totalPrice),
            isComplete: !!(item.description && (item.measurements?.quantity || item.totalPrice))
        }));

        // Calculate summary statistics for frontend
        const summary = {
            totalItems: editableItems.length,
            itemsWithQuantity: editableItems.filter(item => item.hasQuantity).length,
            itemsWithPricing: editableItems.filter(item => item.hasPricing).length,
            completeItems: editableItems.filter(item => item.isComplete).length,
            incompleteItems: editableItems.filter(item => !item.isComplete).length,
            
            // Cost calculations
            totalEstimatedCost: editableItems.reduce((sum, item) => {
                const price = parseFloat(item.totalPrice?.replace(/[^0-9.-]/g, '') || 0);
                return sum + price;
            }, 0),
            
            // Measurement totals
            totalQuantity: editableItems.reduce((sum, item) => {
                const qty = parseFloat(item.measurements.quantity || 0);
                return sum + qty;
            }, 0)
        };

        // Group items by category for easier frontend handling
        const itemsByCategory = editableItems.reduce((groups, item) => {
            const category = item.category || 'general';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(item);
            return groups;
        }, {});

        // Include related bid information
        const bidInfo = {
            id: bid._id,
            projectName: bid.projectName,
            projectType: bid.projectType,
            client: bid.client,
            contractorInfo: bid.contractorInfo || {},
            clientInfo: bid.clientInfo || {},
            projectDetails: bid.projectDetails || {},
            lastAIExtraction: bid.aiExtractedAt || bid.createdAt,
            processingMethod: bid.processingMethod || 'unknown'
        };

        console.log('✅ Formatted', editableItems.length, 'demolition items for editing');
        console.log('📊 Summary:', {
            total: summary.totalItems,
            complete: summary.completeItems,
            withPricing: summary.itemsWithPricing
        });

        res.json({
            success: true,
            bid: bidInfo,
            demolitionItems: editableItems,
            itemsByCategory,
            summary,
            editingMetadata: {
                canEdit: true,
                canAddItems: true,
                canDeleteItems: true,
                canBulkUpdate: true,
                lastUpdated: bid.updatedAt,
                version: bid.__v || 0
            }
        });

    } catch (error) {
        console.error('❌ Get editable demolition items error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};


// Get demolition item templates and categories for frontend
export const getDemolitionTemplates = async (req, res) => {
    try {
        console.log('🔧 Getting demolition templates and categories...');

        // Define common demolition categories and templates
        const demolitionCategories = {
            wall: {
                name: 'Wall Demolition',
                description: 'Interior and exterior wall removal',
                commonUnits: ['sq ft', 'linear ft', 'each'],
                templates: [
                    { name: 'Interior Wall Removal', unit: 'sq ft', avgPrice: 8.50 },
                    { name: 'Exterior Wall Removal', unit: 'sq ft', avgPrice: 12.00 },
                    { name: 'Partition Wall Removal', unit: 'sq ft', avgPrice: 6.00 },
                    { name: 'Load Bearing Wall Removal', unit: 'sq ft', avgPrice: 15.00 }
                ]
            },
            ceiling: {
                name: 'Ceiling Demolition',
                description: 'Ceiling systems and components removal',
                commonUnits: ['sq ft', 'each'],
                templates: [
                    { name: 'Drop Ceiling Removal', unit: 'sq ft', avgPrice: 3.25 },
                    { name: 'Drywall Ceiling Removal', unit: 'sq ft', avgPrice: 4.50 },
                    { name: 'Suspended ACT Ceiling', unit: 'sq ft', avgPrice: 3.00 },
                    { name: 'Ceiling Grid Removal', unit: 'sq ft', avgPrice: 2.00 }
                ]
            },
            flooring: {
                name: 'Flooring Demolition',
                description: 'Floor finishes and underlayment removal',
                commonUnits: ['sq ft', 'sq yd'],
                templates: [
                    { name: 'Carpet Removal', unit: 'sq ft', avgPrice: 2.75 },
                    { name: 'Tile Removal', unit: 'sq ft', avgPrice: 4.00 },
                    { name: 'Hardwood Floor Removal', unit: 'sq ft', avgPrice: 3.50 },
                    { name: 'Vinyl Floor Removal', unit: 'sq ft', avgPrice: 2.25 }
                ]
            },
            electrical: {
                name: 'Electrical Demolition',
                description: 'Electrical systems and fixtures removal',
                commonUnits: ['each', 'linear ft'],
                templates: [
                    { name: 'Light Fixture Removal', unit: 'each', avgPrice: 35.00 },
                    { name: 'Electrical Panel Removal', unit: 'each', avgPrice: 150.00 },
                    { name: 'Outlet Removal', unit: 'each', avgPrice: 25.00 },
                    { name: 'Switch Removal', unit: 'each', avgPrice: 20.00 }
                ]
            },
            plumbing: {
                name: 'Plumbing Demolition',
                description: 'Plumbing fixtures and systems removal',
                commonUnits: ['each', 'linear ft'],
                templates: [
                    { name: 'Sink Removal', unit: 'each', avgPrice: 75.00 },
                    { name: 'Toilet Removal', unit: 'each', avgPrice: 100.00 },
                    { name: 'Water Heater Removal', unit: 'each', avgPrice: 125.00 },
                    { name: 'Pipe Removal', unit: 'linear ft', avgPrice: 8.00 }
                ]
            },
            hvac: {
                name: 'HVAC Demolition',
                description: 'Heating, ventilation, and air conditioning removal',
                commonUnits: ['each', 'linear ft', 'sq ft'],
                templates: [
                    { name: 'Ductwork Removal', unit: 'linear ft', avgPrice: 12.00 },
                    { name: 'HVAC Unit Removal', unit: 'each', avgPrice: 200.00 },
                    { name: 'Diffuser Removal', unit: 'each', avgPrice: 25.00 },
                    { name: 'Return Grille Removal', unit: 'each', avgPrice: 30.00 }
                ]
            },
            cleanup: {
                name: 'Cleanup & Disposal',
                description: 'General cleanup and waste disposal',
                commonUnits: ['cubic yards', 'each', 'sq ft'],
                templates: [
                    { name: 'Debris Removal', unit: 'cubic yards', avgPrice: 85.00 },
                    { name: 'Dumpster Service', unit: 'each', avgPrice: 450.00 },
                    { name: 'Broomsweep', unit: 'sq ft', avgPrice: 0.50 },
                    { name: 'Final Cleanup', unit: 'sq ft', avgPrice: 0.75 }
                ]
            },
            specialty: {
                name: 'Specialty Items',
                description: 'Specialized demolition items',
                commonUnits: ['each', 'sq ft', 'linear ft'],
                templates: [
                    { name: 'Built-in Cabinetry Removal', unit: 'linear ft', avgPrice: 25.00 },
                    { name: 'Countertop Removal', unit: 'sq ft', avgPrice: 8.00 },
                    { name: 'Window Removal', unit: 'each', avgPrice: 150.00 },
                    { name: 'Door & Frame Removal', unit: 'each', avgPrice: 75.00 }
                ]
            }
        };

        // Common measurement units with conversions
        const measurementUnits = {
            area: ['sq ft', 'sq yd', 'sq in', 'sq m'],
            length: ['linear ft', 'linear in', 'linear yd', 'linear m'],
            volume: ['cubic ft', 'cubic yd', 'cubic in', 'cubic m'],
            count: ['each', 'piece', 'item', 'set'],
            weight: ['lbs', 'tons', 'kg']
        };

        // Common actions for demolition items
        const demolitionActions = [
            { value: 'remove', label: 'Remove', description: 'Complete removal and disposal' },
            { value: 'remain', label: 'Remain', description: 'Item to stay in place' },
            { value: 'excluded', label: 'Excluded', description: 'Not included in scope' },
            { value: 'salvage', label: 'Salvage', description: 'Remove and save for reuse' },
            { value: 'relocate', label: 'Relocate', description: 'Move to different location' }
        ];

        // Item template for creating new demolition items
        const newItemTemplate = {
            itemNumber: '',
            description: '',
            category: 'general',
            action: 'remove',
            measurements: {
                quantity: null,
                unit: null,
                dimensions: null,
                totalArea: null
            },
            pricing: {
                unitPrice: null,
                totalPrice: null,
                currency: 'USD'
            },
            location: null,
            specifications: null,
            notes: null,
            isActive: true,
            isEdited: false
        };

        console.log('✅ Returning demolition templates and categories');

        res.json({
            success: true,
            categories: demolitionCategories,
            measurementUnits,
            demolitionActions,
            newItemTemplate,
            metadata: {
                totalCategories: Object.keys(demolitionCategories).length,
                totalTemplates: Object.values(demolitionCategories).reduce((sum, cat) => sum + cat.templates.length, 0),
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Get demolition templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
