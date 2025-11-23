import mongoose from "mongoose";


import contractorInfoSchema from "./bid/contractorInfo.js";
import clientInfoSchema from "./bid/clientInfo.js";
import projectDetailsSchema from "./bid/projectDetails.js";
import measurementsSchema from "./bid/measurements.js";
import workItemSchema from "./bid/workItem.js";
import measurementSummarySchema from "./bid/measurementSummary.js";
import pricingSummarySchema from "./bid/pricingSummary.js";
import demolitionItemSchema from "./bid/demolitionItem.js";
import documentSchema from "./bid/document.js";
import aiProcessingSchema from "./bid/aiProcessing.js";




// Main Bid Schema - Optimized for PUT operations
const bidSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Core project information (editable)
  projectDetails: projectDetailsSchema,
  
  // Contractor information (editable via PUT)
  contractorInfo: contractorInfoSchema,
  
  // Client information (editable via PUT)
  clientInfo: clientInfoSchema,

  // Demolition items (fully editable array)
  demolitionItems: [demolitionItemSchema],

  // Exclusions (editable array)
  exclusions: [{
    type: String,
    trim: true
  }],

  // Work scope (editable) - Enhanced structure
  scopeOfWork: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      itemsToRemove: [],
      itemsToRemain: []
    }
  },

  // Basic item count from Phase 1 processing
  basicItemCount: {
    type: Number,
    default: 0
  },

  // Section headers found during processing
  sectionHeaders: [{
    type: String,
    trim: true
  }],

  // Special notes for remain/excluded/retain items
  specialNotes: [{
    type: String,
    trim: true
  }],

  // Price information structure
  priceInfo: {
    totalAmount: {
      type: String,
      trim: true
    },
    includes: [{
      type: String,
      trim: true
    }]
  },

  // Additional conditions and disclaimers
  additionalConditions: [{
    type: String,
    trim: true
  }],

  // Work items extracted from AI
  workItems: [workItemSchema],

  // Special requirements
  specialRequirements: {
    type: String,
    trim: true
  },

  // Measurement summaries
  measurementSummary: measurementSummarySchema,

  // Pricing summaries
  pricingSummary: pricingSummarySchema,

  // Document management
  documents: [documentSchema],

  // Cost calculations (auto-calculated and editable)
  totalProjectCost: {
    type: String,
    trim: true
  },

  // Proposed bid amount (user input)
  proposedBid: {
    type: Number,
    default: null
  },

  // Total Proposed Amount (separate from individual item proposed bids)
  totalProposedAmount: {
    type: Number,
    default: null
  },

  // AI processing metadata
  aiProcessing: aiProcessingSchema,

  // Complete AI extracted data (stored as JSON for reference)
  aiExtractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Processing method used
  processingMethod: {
    type: String,
    trim: true,
    default: 'manual'
  },

  // AI processing success flag
  aiProcessingSuccess: {
    type: Boolean,
    default: false
  },

  // Extraction notes
  extractionNotes: {
    type: String,
    trim: true
  },

  // Legacy compatibility fields
  projectName: {
    type: String,
    trim: true,
    index: true
  },
  projectType: {
    type: String,
    trim: true
  },
  client: {
    type: String,
    trim: true
  },

  // Additional legacy fields for backward compatibility
  clientAddress: {
    type: String,
    trim: true
  },
  projectLocation: {
    type: String,
    trim: true
  },
  projectDescription: {
    type: String,
    trim: true
  },
  bidItems: [{
    type: mongoose.Schema.Types.Mixed
  }],

  // Status management
  status: {
    type: String,
    enum: [
      "Draft",
      "Pending", 
      "In Review", 
      "Approved", 
      "Rejected", 
      "Awarded", 
      "Completed", 
      "Cancelled"
    ],
    default: "Draft",
    index: true
  },

  // Revision tracking for PUT operations
  revision: {
    type: Number,
    default: 1
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
bidSchema.index({ 'projectDetails.projectName': 'text', 'contractorInfo.companyName': 'text' });
bidSchema.index({ user: 1, status: 1 });
bidSchema.index({ 'projectDetails.bidDate': -1 });
bidSchema.index({ createdAt: -1 });

// Virtual for total calculated cost (prioritize AI extracted data)
bidSchema.virtual('calculatedTotalCost').get(function() {
  // First try AI extracted demolition items
  const aiDemolitionItems = this.aiExtractedData?.demolitionItems;
  if (aiDemolitionItems && aiDemolitionItems.length > 0) {
    return aiDemolitionItems.reduce((total, item) => {
      if (!item.pricing && !item.totalPrice) return total;
      const numericPrice = parseFloat((item.totalPrice || item.pricing || '0').toString().replace(/[$,]/g, ''));
      return total + (isNaN(numericPrice) ? 0 : numericPrice);
    }, 0);
  }
  
  // Fallback to root demolition items
  if (!this.demolitionItems || this.demolitionItems.length === 0) return 0;
  
  return this.demolitionItems.reduce((total, item) => {
    if (!item.pricing) return total;
    const numericPrice = parseFloat(item.pricing.replace(/[$,]/g, ''));
    return total + (isNaN(numericPrice) ? 0 : numericPrice);
  }, 0);
});

// Virtual for active demolition items count (prioritize AI extracted data)
bidSchema.virtual('activeDemolitionItemsCount').get(function() {
  // First try AI extracted demolition items
  const aiDemolitionItems = this.aiExtractedData?.demolitionItems;
  if (aiDemolitionItems && aiDemolitionItems.length > 0) {
    return aiDemolitionItems.filter(item => item.isActive !== false).length;
  }
  
  // Fallback to root demolition items
  if (!this.demolitionItems) return 0;
  return this.demolitionItems.filter(item => item.isActive !== false).length;
});

// Virtual for legacy scopeOfWork string format (backward compatibility)
bidSchema.virtual('legacyScopeOfWork').get(function() {
  if (this.scopeOfWork && typeof this.scopeOfWork === 'object') {
    const removeItems = this.scopeOfWork.itemsToRemove || [];
    const remainItems = this.scopeOfWork.itemsToRemain || [];
    
    let scope = '';
    if (removeItems.length > 0) {
      scope += 'Items to Remove: ' + removeItems.join(', ');
    }
    if (remainItems.length > 0) {
      if (scope) scope += '; ';
      scope += 'Items to Remain: ' + remainItems.join(', ');
    }
    return scope || 'To be determined';
  }
  return this.scopeOfWork || 'To be determined';
});

// Pre-save middleware to update legacy fields and revision
bidSchema.pre('save', function(next) {
  // Update legacy fields for backward compatibility
  if (this.projectDetails) {
    this.projectName = this.projectDetails.projectName;
    this.projectType = this.projectDetails.projectType;
  }
  if (this.clientInfo) {
    this.client = this.clientInfo.companyName;
  }
  
  // Handle scopeOfWork backward compatibility
  if (this.scopeOfWork && typeof this.scopeOfWork === 'string') {
    // Convert old string format to new object format
    this.scopeOfWork = {
      itemsToRemove: [this.scopeOfWork],
      itemsToRemain: []
    };
  } else if (!this.scopeOfWork) {
    // Initialize new structure if not present
    this.scopeOfWork = {
      itemsToRemove: [],
      itemsToRemain: []
    };
  }
  
  // Update revision and last modified
  if (this.isModified() && !this.isNew) {
    this.revision += 1;
    this.lastModified = new Date();
  }
  
  next();
});

// Instance method for updating demolition items efficiently
bidSchema.methods.updateDemolitionItem = function(itemId, updateData) {
  const item = this.demolitionItems.id(itemId);
  if (!item) {
    throw new Error('Demolition item not found');
  }
  
  Object.assign(item, updateData);
  this.lastModified = new Date();
  return this.save();
};

// Instance method for updating AI extracted demolition items
bidSchema.methods.updateAIDemolitionItem = function(itemIndex, updateData) {
  if (!this.aiExtractedData) {
    this.aiExtractedData = {};
  }
  if (!this.aiExtractedData.demolitionItems) {
    this.aiExtractedData.demolitionItems = [];
  }
  
  if (itemIndex >= 0 && itemIndex < this.aiExtractedData.demolitionItems.length) {
    this.aiExtractedData.demolitionItems[itemIndex] = {
      ...this.aiExtractedData.demolitionItems[itemIndex],
      ...updateData
    };
    this.markModified('aiExtractedData');
    this.lastModified = new Date();
    return this.save();
  } else {
    throw new Error('AI Demolition item not found');
  }
};

// Instance method for adding new AI extracted demolition items
bidSchema.methods.addAIDemolitionItem = function(itemData) {
  if (!this.aiExtractedData) {
    this.aiExtractedData = {};
  }
  if (!this.aiExtractedData.demolitionItems) {
    this.aiExtractedData.demolitionItems = [];
  }
  
  this.aiExtractedData.demolitionItems.push(itemData);
  this.markModified('aiExtractedData');
  this.lastModified = new Date();
  return this.save();
};

// Instance method for adding new demolition items
bidSchema.methods.addDemolitionItem = function(itemData) {
  this.demolitionItems.push(itemData);
  this.lastModified = new Date();
  return this.save();
};

// Instance method for removing demolition items (soft delete)
bidSchema.methods.removeDemolitionItem = function(itemId) {
  const item = this.demolitionItems.id(itemId);
  if (!item) {
    throw new Error('Demolition item not found');
  }
  
  item.isActive = false;
  this.lastModified = new Date();
  return this.save();
};

// Instance method for updating scope of work items
bidSchema.methods.updateScopeOfWork = function(itemsToRemove = [], itemsToRemain = []) {
  this.scopeOfWork = {
    itemsToRemove: Array.isArray(itemsToRemove) ? itemsToRemove : [],
    itemsToRemain: Array.isArray(itemsToRemain) ? itemsToRemain : []
  };
  this.lastModified = new Date();
  return this.save();
};

// Instance method for adding special notes
bidSchema.methods.addSpecialNote = function(note) {
  if (!this.specialNotes) {
    this.specialNotes = [];
  }
  this.specialNotes.push(note);
  this.lastModified = new Date();
  return this.save();
};

// Instance method for updating price information
bidSchema.methods.updatePriceInfo = function(totalAmount, includes = []) {
  this.priceInfo = {
    totalAmount: totalAmount || this.priceInfo?.totalAmount,
    includes: Array.isArray(includes) ? includes : (this.priceInfo?.includes || [])
  };
  this.lastModified = new Date();
  return this.save();
};

// Instance method for adding additional conditions
bidSchema.methods.addAdditionalCondition = function(condition) {
  if (!this.additionalConditions) {
    this.additionalConditions = [];
  }
  this.additionalConditions.push(condition);
  this.lastModified = new Date();
  return this.save();
};

// Helper function to safely parse numeric values
const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
  if (typeof value === 'string') {
    const cleaned = value.toString().replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

// Helper function to safely get quantity from new measurement structure
const safeGetQuantity = (measurements) => {
  if (!measurements || typeof measurements !== 'object') return 0;
  
  // Try different quantity fields in priority order
  if (measurements.quantity !== null && measurements.quantity !== undefined) {
    return safeParseFloat(measurements.quantity, 0);
  }
  if (measurements.squareFeet !== null && measurements.squareFeet !== undefined) {
    return safeParseFloat(measurements.squareFeet, 0);
  }
  if (measurements.linearFeet !== null && measurements.linearFeet !== undefined) {
    return safeParseFloat(measurements.linearFeet, 0);
  }
  if (measurements.count !== null && measurements.count !== undefined) {
    return safeParseFloat(measurements.count, 0);
  }
  
  return 0;
};

// Instance method for calculating all demolition item prices
bidSchema.methods.calculateAllPrices = function() {
  try {
    console.log('💰 Calculating prices for all demolition items...');
    
    let totalCalculatedCost = 0;
    let itemsWithPrices = 0;
    let itemsWithPricesheetMatch = 0;
    let itemsWithErrors = 0;
    let itemsWithoutPrices = 0;
    
    // Calculate prices for AI extracted demolition items (prioritized)
    if (this.aiExtractedData?.demolitionItems && Array.isArray(this.aiExtractedData.demolitionItems)) {
      this.aiExtractedData.demolitionItems.forEach((item, index) => {
        try {
          // Get quantity with null safety
          const quantity = safeGetQuantity(item.measurements);
          
          // Determine unit price with comprehensive null handling
          let unitPrice = 0;
          let calculationMethod = 'manual';
          let hasValidPrice = false;
          
          // Priority 1: Use pricesheet match
          if (item.pricesheetMatch?.matched) {
            const matchedPrice = safeParseFloat(item.pricesheetMatch.itemPrice);
            if (matchedPrice > 0) {
              unitPrice = matchedPrice;
              calculationMethod = 'pricesheet';
              hasValidPrice = true;
            }
          }
          
          // Priority 2: Use AI extracted unit price
          if (!hasValidPrice && item.unitPrice) {
            const parsedUnitPrice = safeParseFloat(item.unitPrice);
            if (parsedUnitPrice > 0) {
              unitPrice = parsedUnitPrice;
              calculationMethod = 'ai_extracted';
              hasValidPrice = true;
            }
          }
          
          // Priority 3: Use total price divided by quantity
          if (!hasValidPrice && item.totalPrice && quantity > 0) {
            const parsedTotalPrice = safeParseFloat(item.totalPrice);
            if (parsedTotalPrice > 0) {
              unitPrice = parsedTotalPrice / quantity;
              calculationMethod = 'ai_extracted';
              hasValidPrice = true;
            }
          }
          
          // Calculate total price
          const totalPrice = quantity * unitPrice;
          
          // Update item with calculated prices
          item.calculatedUnitPrice = unitPrice;
          item.calculatedTotalPrice = totalPrice;
          item.priceCalculation = {
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            calculationMethod: calculationMethod,
            lastCalculated: new Date(),
            hasValidPrice: hasValidPrice,
            measurementType: item.measurements?.unit || 'unknown'
          };
          
          if (hasValidPrice) {
            totalCalculatedCost += totalPrice;
            itemsWithPrices++;
            if (calculationMethod === 'pricesheet') {
              itemsWithPricesheetMatch++;
            }
            console.log(`✅ Calculated: ${item.name || `Item ${index + 1}`} - Qty: ${quantity} × $${unitPrice} = $${totalPrice}`);
          } else {
            itemsWithoutPrices++;
            console.log(`⚠️ No valid price found for: ${item.name || `Item ${index + 1}`} - Qty: ${quantity}`);
          }
          
        } catch (itemError) {
          itemsWithErrors++;
          console.error(`❌ Error calculating price for item ${index + 1}:`, itemError);
          
          // Set safe defaults on error
          item.calculatedUnitPrice = 0;
          item.calculatedTotalPrice = 0;
          item.priceCalculation = {
            quantity: safeGetQuantity(item.measurements),
            unitPrice: 0,
            totalPrice: 0,
            calculationMethod: 'error',
            lastCalculated: new Date(),
            hasValidPrice: false,
            measurementType: 'unknown',
            error: itemError.message
          };
        }
      });
    }
    
    // Calculate prices for regular demolition items
    if (this.demolitionItems && Array.isArray(this.demolitionItems)) {
      this.demolitionItems.forEach((item, index) => {
        try {
          // Get quantity with null safety
          const quantity = safeGetQuantity(item.measurements);
          
          // Determine unit price with comprehensive null handling
          let unitPrice = 0;
          let calculationMethod = 'manual';
          let hasValidPrice = false;
          
          // Priority 1: Use pricesheet match
          if (item.pricesheetMatch?.matched) {
            const matchedPrice = safeParseFloat(item.pricesheetMatch.itemPrice);
            if (matchedPrice > 0) {
              unitPrice = matchedPrice;
              calculationMethod = 'pricesheet';
              hasValidPrice = true;
            }
          }
          
          // Priority 2: Use AI extracted unit price
          if (!hasValidPrice && item.unitPrice) {
            const parsedUnitPrice = safeParseFloat(item.unitPrice);
            if (parsedUnitPrice > 0) {
              unitPrice = parsedUnitPrice;
              calculationMethod = 'ai_extracted';
              hasValidPrice = true;
            }
          }
          
          // Priority 3: Use total price divided by quantity
          if (!hasValidPrice && item.totalPrice && quantity > 0) {
            const parsedTotalPrice = safeParseFloat(item.totalPrice);
            if (parsedTotalPrice > 0) {
              unitPrice = parsedTotalPrice / quantity;
              calculationMethod = 'ai_extracted';
              hasValidPrice = true;
            }
          }
          
          // Calculate total price
          const totalPrice = quantity * unitPrice;
          
          // Update item with calculated prices
          item.calculatedUnitPrice = unitPrice;
          item.calculatedTotalPrice = totalPrice;
          item.priceCalculation = {
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: totalPrice,
            calculationMethod: calculationMethod,
            lastCalculated: new Date(),
            hasValidPrice: hasValidPrice,
            measurementType: item.measurements?.unit || 'unknown'
          };
          
          if (hasValidPrice) {
            totalCalculatedCost += totalPrice;
            itemsWithPrices++;
            if (calculationMethod === 'pricesheet') {
              itemsWithPricesheetMatch++;
            }
            console.log(`✅ Calculated: ${item.name || `Item ${index + 1}`} - Qty: ${quantity} × $${unitPrice} = $${totalPrice}`);
          } else {
            itemsWithoutPrices++;
            console.log(`⚠️ No valid price found for: ${item.name || `Item ${index + 1}`} - Qty: ${quantity}`);
          }
          
        } catch (itemError) {
          itemsWithErrors++;
          console.error(`❌ Error calculating price for item ${index + 1}:`, itemError);
          
          // Set safe defaults on error
          item.calculatedUnitPrice = 0;
          item.calculatedTotalPrice = 0;
          item.priceCalculation = {
            quantity: safeGetQuantity(item.measurements),
            unitPrice: 0,
            totalPrice: 0,
            calculationMethod: 'error',
            lastCalculated: new Date(),
            hasValidPrice: false,
            measurementType: 'unknown',
            error: itemError.message
          };
        }
      });
    }
    
    // Update pricing summary with null safety
    if (!this.pricingSummary) {
      this.pricingSummary = {};
    }
    
    this.pricingSummary.subtotal = totalCalculatedCost;
    this.pricingSummary.grandTotal = totalCalculatedCost;
    this.pricingSummary.totalProjectCost = `$${totalCalculatedCost.toFixed(2)}`;
    this.pricingSummary.itemsWithPrices = itemsWithPrices;
    this.pricingSummary.itemsWithPricesheetMatch = itemsWithPricesheetMatch;
    this.pricingSummary.itemsWithoutPrices = itemsWithoutPrices;
    this.pricingSummary.itemsWithErrors = itemsWithErrors;
    
    // Mark the document as modified
    this.markModified('aiExtractedData');
    this.markModified('demolitionItems');
    this.markModified('pricingSummary');
    this.lastModified = new Date();
    
    console.log(`💰 Price calculation complete:`);
    console.log(`   - Total calculated cost: $${totalCalculatedCost.toFixed(2)}`);
    console.log(`   - Items with prices: ${itemsWithPrices}`);
    console.log(`   - Items with pricesheet match: ${itemsWithPricesheetMatch}`);
    console.log(`   - Items without prices: ${itemsWithoutPrices}`);
    console.log(`   - Items with errors: ${itemsWithErrors}`);
    
    return {
      totalCalculatedCost: totalCalculatedCost,
      itemsWithPrices: itemsWithPrices,
      itemsWithPricesheetMatch: itemsWithPricesheetMatch,
      itemsWithoutPrices: itemsWithoutPrices,
      itemsWithErrors: itemsWithErrors,
      pricingSummary: this.pricingSummary,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error calculating prices:', error);
    return {
      totalCalculatedCost: 0,
      itemsWithPrices: 0,
      itemsWithPricesheetMatch: 0,
      itemsWithoutPrices: 0,
      itemsWithErrors: 0,
      success: false,
      error: error.message
    };
  }
};

// Static method for efficient PUT operations
bidSchema.statics.updateBidEfficiently = async function(bidId, updateData) {
  const options = {
    new: true,
    runValidators: true,
    upsert: false
  };
  
  // Increment revision for tracking
  updateData.$inc = { revision: 1 };
  updateData.lastModified = new Date();
  
  return this.findByIdAndUpdate(bidId, updateData, options);
};

export const Bid = mongoose.model("Bid", bidSchema);