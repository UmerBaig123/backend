import mongoose from "mongoose";
import measurementsSchema from "./measurements.js";

// Demolition Item Schema - Fully Editable with PUT support
const demolitionItemSchema = new mongoose.Schema({
  itemNumber: {
    type: String,
    trim: true,
    index: true
  },
  name: {
    type: String,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    enum: [
      'wall', 'ceiling', 'floor', 'electrical', 'plumbing', 
      'cleanup', 'door', 'window', 'fixture', 'hvac', 
      'structural', 'interior', 'exterior', 'other',
      // Additional categories from AI extraction
      'HVAC', 'signage', 'storefront', 'MEP', 'fire protection',
      'Storefront', 'mechanical'
    ]
  },
  action: {
    type: String,
    trim: true
  },
  measurements: measurementsSchema,
  pricing: {
    type: String,
    trim: true
  },
  // Pricesheet matching information
  pricesheetMatch: {
    matched: {
      type: Boolean,
      default: false
    },
    itemName: {
      type: String,
      trim: true
    },
    itemPrice: {
      type: Number
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriceSheet'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Additional fields from AI extraction
  location: {
    type: String,
    trim: true
  },
  specifications: {
    type: String,
    trim: true
  },
  unitPrice: {
    type: String,
    trim: true
  },
  totalPrice: {
    type: String,
    trim: true
  },
  // Calculated pricing fields
  calculatedUnitPrice: {
    type: Number,
    default: null
  },
  calculatedTotalPrice: {
    type: Number,
    default: null
  },
  // Proposed bid for this individual item
  proposedBid: {
    type: Number,
    default: null
  },
  // Price calculation metadata
  priceCalculation: {
    quantity: {
      type: Number,
      default: null
    },
    unitPrice: {
      type: Number,
      default: null
    },
    totalPrice: {
      type: Number,
      default: null
    },
    calculationMethod: {
      type: String,
      enum: ['pricesheet', 'manual', 'ai_extracted', 'error', 'no_price'],
      default: 'manual'
    },
    lastCalculated: {
      type: Date,
      default: Date.now
    },
    hasValidPrice: {
      type: Boolean,
      default: false
    },
    measurementType: {
      type: String,
      trim: true,
      default: 'unknown'
    },
    error: {
      type: String,
      trim: true
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for pricing calculation
demolitionItemSchema.virtual('calculatedPrice').get(function() {
  if (!this.pricing) return 0;
  const numericPrice = parseFloat(this.pricing.replace(/[$,]/g, ''));
  return isNaN(numericPrice) ? 0 : numericPrice;
});

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

// Method to calculate price based on quantity and pricesheet price
demolitionItemSchema.methods.calculatePrice = function(pricesheetPrice = null) {
  try {
    // Get quantity from measurements with null safety
    const quantity = safeGetQuantity(this.measurements);
    
    // Determine unit price with comprehensive null handling
    let unitPrice = 0;
    let calculationMethod = 'manual';
    let hasValidPrice = false;
    
    // Priority 1: Use provided pricesheet price
    if (pricesheetPrice !== null && pricesheetPrice !== undefined) {
      const parsedPricesheetPrice = safeParseFloat(pricesheetPrice);
      if (parsedPricesheetPrice > 0) {
        unitPrice = parsedPricesheetPrice;
        calculationMethod = 'pricesheet';
        hasValidPrice = true;
      }
    }
    
    // Priority 2: Use matched pricesheet price
    if (!hasValidPrice && this.pricesheetMatch?.matched) {
      const matchedPrice = safeParseFloat(this.pricesheetMatch.itemPrice);
      if (matchedPrice > 0) {
        unitPrice = matchedPrice;
        calculationMethod = 'pricesheet';
        hasValidPrice = true;
      }
    }
    
    // Priority 3: Use AI extracted unit price
    if (!hasValidPrice && this.unitPrice) {
      const parsedUnitPrice = safeParseFloat(this.unitPrice);
      if (parsedUnitPrice > 0) {
        unitPrice = parsedUnitPrice;
        calculationMethod = 'ai_extracted';
        hasValidPrice = true;
      }
    }
    
    // Priority 4: Use total price divided by quantity (if available)
    if (!hasValidPrice && this.totalPrice && quantity > 0) {
      const parsedTotalPrice = safeParseFloat(this.totalPrice);
      if (parsedTotalPrice > 0) {
        unitPrice = parsedTotalPrice / quantity;
        calculationMethod = 'ai_extracted';
        hasValidPrice = true;
      }
    }
    
    // If no valid price found, set to 0 and mark as manual
    if (!hasValidPrice) {
      unitPrice = 0;
      calculationMethod = 'manual';
    }
    
    // Calculate total price with null safety
    const totalPrice = quantity * unitPrice;
    
    // Update price calculation fields with null safety
    this.calculatedUnitPrice = unitPrice;
    this.calculatedTotalPrice = totalPrice;
    this.priceCalculation = {
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      calculationMethod: calculationMethod,
      lastCalculated: new Date(),
      hasValidPrice: hasValidPrice,
      measurementType: this.measurements?.unit || 'unknown'
    };
    
    return {
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      calculationMethod: calculationMethod,
      hasValidPrice: hasValidPrice
    };
    
  } catch (error) {
    console.error('Error calculating price for item:', this.name, error);
    
    // Set safe defaults on error
    this.calculatedUnitPrice = 0;
    this.calculatedTotalPrice = 0;
    this.priceCalculation = {
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0,
      calculationMethod: 'error',
      lastCalculated: new Date(),
      hasValidPrice: false,
      measurementType: 'unknown',
      error: error.message
    };
    
    return {
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0,
      calculationMethod: 'error',
      hasValidPrice: false
    };
  }
};

// Method to update proposed bid for this individual item
demolitionItemSchema.methods.updateProposedBid = function(proposedBidAmount) {
  try {
    // Validate proposed bid amount
    if (proposedBidAmount === undefined || proposedBidAmount === null) {
      throw new Error('Proposed bid amount is required');
    }

    const numericProposedBid = parseFloat(proposedBidAmount);
    if (isNaN(numericProposedBid) || numericProposedBid < 0) {
      throw new Error('Proposed bid must be a valid positive number');
    }

    // Update proposed bid
    this.proposedBid = numericProposedBid;
    
    // Update price calculation metadata
    if (!this.priceCalculation) {
      this.priceCalculation = {};
    }
    this.priceCalculation.proposedBid = numericProposedBid;
    this.priceCalculation.lastCalculated = new Date();
    
    return {
      success: true,
      proposedBid: numericProposedBid,
      itemName: this.name
    };
    
  } catch (error) {
    console.error('Error updating proposed bid for item:', this.name, error);
    return {
      success: false,
      error: error.message,
      itemName: this.name
    };
  }
};

export default demolitionItemSchema;
