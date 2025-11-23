/**
 * Utility functions for safe price calculations with comprehensive null handling
 * This module provides robust functions to handle null, undefined, and invalid values
 * in price calculations throughout the demolition bid system.
 */

/**
 * Safely parse a numeric value with comprehensive null handling
 * @param {any} value - The value to parse
 * @param {number} defaultValue - Default value if parsing fails (default: 0)
 * @returns {number} - Parsed numeric value or default
 */
export const safeParseFloat = (value, defaultValue = 0) => {
  // Handle null, undefined, or empty string
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  // Handle numbers
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    const cleaned = value.toString().replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  // Handle other types
  return defaultValue;
};

/**
 * Safely get quantity from measurements object
 * @param {object} measurements - Measurements object
 * @param {number} defaultValue - Default quantity if not found (default: 0)
 * @returns {number} - Quantity value or default
 */
export const safeGetQuantity = (measurements, defaultValue = 0) => {
  if (!measurements || typeof measurements !== 'object') {
    return defaultValue;
  }
  return safeParseFloat(measurements.quantity, defaultValue);
};

/**
 * Safely calculate total price from quantity and unit price
 * @param {number} quantity - Item quantity
 * @param {number} unitPrice - Unit price per item
 * @returns {object} - Calculation result with metadata
 */
export const safeCalculateTotalPrice = (quantity, unitPrice) => {
  const safeQuantity = safeParseFloat(quantity);
  const safeUnitPrice = safeParseFloat(unitPrice);
  const totalPrice = safeQuantity * safeUnitPrice;
  
  return {
    quantity: safeQuantity,
    unitPrice: safeUnitPrice,
    totalPrice: totalPrice,
    isValid: safeQuantity > 0 && safeUnitPrice > 0,
    hasValidQuantity: safeQuantity > 0,
    hasValidUnitPrice: safeUnitPrice > 0
  };
};

/**
 * Safely format currency values
 * @param {any} value - Value to format
 * @param {string} fallback - Fallback text if value is invalid (default: '$0.00')
 * @returns {string} - Formatted currency string
 */
export const safeFormatCurrency = (value, fallback = '$0.00') => {
  const numericValue = safeParseFloat(value);
  return `$${numericValue.toFixed(2)}`;
};

/**
 * Safely calculate profit margin
 * @param {number} proposedBid - Proposed bid amount
 * @param {number} calculatedCost - Calculated cost amount
 * @returns {object} - Margin calculation result
 */
export const safeCalculateMargin = (proposedBid, calculatedCost) => {
  const safeProposedBid = safeParseFloat(proposedBid);
  const safeCalculatedCost = safeParseFloat(calculatedCost);
  
  if (safeCalculatedCost === 0) {
    return {
      margin: 0,
      marginPercentage: 0,
      isValid: false,
      error: 'Cannot calculate margin when calculated cost is zero'
    };
  }
  
  const margin = safeProposedBid - safeCalculatedCost;
  const marginPercentage = (margin / safeCalculatedCost) * 100;
  
  return {
    margin: margin,
    marginPercentage: marginPercentage,
    isValid: true,
    proposedBid: safeProposedBid,
    calculatedCost: safeCalculatedCost
  };
};

/**
 * Safely aggregate prices from an array of items
 * @param {Array} items - Array of items with price information
 * @param {string} priceField - Field name containing the price (default: 'calculatedTotalPrice')
 * @returns {object} - Aggregation result
 */
export const safeAggregatePrices = (items, priceField = 'calculatedTotalPrice') => {
  if (!Array.isArray(items)) {
    return {
      total: 0,
      itemCount: 0,
      itemsWithPrices: 0,
      itemsWithoutPrices: 0,
      isValid: false,
      error: 'Items must be an array'
    };
  }
  
  let total = 0;
  let itemsWithPrices = 0;
  let itemsWithoutPrices = 0;
  
  items.forEach((item, index) => {
    const price = safeParseFloat(item[priceField]);
    total += price;
    
    if (price > 0) {
      itemsWithPrices++;
    } else {
      itemsWithoutPrices++;
    }
  });
  
  return {
    total: total,
    itemCount: items.length,
    itemsWithPrices: itemsWithPrices,
    itemsWithoutPrices: itemsWithoutPrices,
    isValid: true
  };
};

/**
 * Safely determine the best available price for an item
 * @param {object} item - Item object with various price fields
 * @returns {object} - Best price determination result
 */
export const safeGetBestPrice = (item) => {
  if (!item || typeof item !== 'object') {
    return {
      price: 0,
      source: 'none',
      isValid: false,
      error: 'Invalid item object'
    };
  }
  
  // Priority order for price sources
  const priceSources = [
    { field: 'proposedBid', source: 'proposed' },
    { field: 'calculatedTotalPrice', source: 'calculated' },
    { field: 'totalPrice', source: 'ai_extracted' },
    { field: 'unitPrice', source: 'unit_price' }
  ];
  
  for (const source of priceSources) {
    const price = safeParseFloat(item[source.field]);
    if (price > 0) {
      return {
        price: price,
        source: source.source,
        isValid: true,
        field: source.field
      };
    }
  }
  
  return {
    price: 0,
    source: 'none',
    isValid: false,
    error: 'No valid price found'
  };
};

/**
 * Safely validate price calculation inputs
 * @param {object} inputs - Input object with quantity, unitPrice, etc.
 * @returns {object} - Validation result
 */
export const safeValidatePriceInputs = (inputs) => {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  if (!inputs) {
    errors.push('Inputs object is required');
    return { isValid: false, errors, warnings };
  }
  
  // Validate quantity
  const quantity = safeParseFloat(inputs.quantity);
  if (quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  } else if (quantity > 10000) {
    warnings.push('Quantity seems unusually high');
  }
  
  // Validate unit price
  const unitPrice = safeParseFloat(inputs.unitPrice);
  if (unitPrice < 0) {
    errors.push('Unit price cannot be negative');
  } else if (unitPrice === 0) {
    warnings.push('Unit price is zero - this may be intentional');
  } else if (unitPrice > 10000) {
    warnings.push('Unit price seems unusually high');
  }
  
  // Validate total price if provided
  if (inputs.totalPrice !== undefined) {
    const totalPrice = safeParseFloat(inputs.totalPrice);
    const calculatedTotal = quantity * unitPrice;
    const difference = Math.abs(totalPrice - calculatedTotal);
    
    if (difference > 0.01) { // Allow for small floating point differences
      warnings.push(`Total price (${totalPrice}) doesn't match calculated total (${calculatedTotal})`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedInputs: {
      quantity,
      unitPrice,
      totalPrice: safeParseFloat(inputs.totalPrice)
    }
  };
};

/**
 * Safely create price calculation metadata
 * @param {object} calculation - Calculation result
 * @param {string} method - Calculation method
 * @returns {object} - Price calculation metadata
 */
export const safeCreatePriceMetadata = (calculation, method = 'manual') => {
  return {
    quantity: calculation.quantity || 0,
    unitPrice: calculation.unitPrice || 0,
    totalPrice: calculation.totalPrice || 0,
    calculationMethod: method,
    lastCalculated: new Date(),
    hasValidPrice: calculation.isValid || false,
    isValid: calculation.isValid || false,
    errors: calculation.errors || [],
    warnings: calculation.warnings || []
  };
};

export default {
  safeParseFloat,
  safeGetQuantity,
  safeCalculateTotalPrice,
  safeFormatCurrency,
  safeCalculateMargin,
  safeAggregatePrices,
  safeGetBestPrice,
  safeValidatePriceInputs,
  safeCreatePriceMetadata
};
