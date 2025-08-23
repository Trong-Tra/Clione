/**
 * Hyperliquid Price and Size Formatting Utilities
 * 
 * Handles proper formatting of prices and sizes according to Hyperliquid's
 * tick and lot size requirements to avoid "invalid price" and "invalid size" errors.
 */

// Constants from Hyperliquid documentation
const MAX_DECIMALS_PERP = 6;
const MAX_DECIMALS_SPOT = 8;
const MAX_SIGNIFICANT_FIGURES = 5;

/**
 * Format price according to Hyperliquid's rules:
 * - Maximum 5 significant figures
 * - Maximum MAX_DECIMALS - szDecimals decimal places
 * - Integer prices are always allowed regardless of significant figures
 */
export function formatHyperliquidPrice(
  price: number, 
  szDecimals: number, 
  isSpot: boolean = false
): string {
  const maxDecimals = isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP;
  const maxDecimalPlaces = maxDecimals - szDecimals;

  // If price is an integer, return as-is (integers are always allowed)
  if (Number.isInteger(price)) {
    return price.toString();
  }

  // Convert to string to analyze significant figures
  const priceStr = price.toString();
  const [integerPart, decimalPart = ''] = priceStr.split('.');
  
  // Count significant figures
  let significantFigures = 0;
  let hasStartedCounting = false;
  
  // Count from integer part
  for (const digit of integerPart) {
    if (digit !== '0') hasStartedCounting = true;
    if (hasStartedCounting) significantFigures++;
  }
  
  // Count from decimal part
  for (const digit of decimalPart) {
    if (digit !== '0') hasStartedCounting = true;
    if (hasStartedCounting) significantFigures++;
  }

  // If we're within 5 significant figures, check decimal places
  if (significantFigures <= MAX_SIGNIFICANT_FIGURES) {
    // Limit by maximum decimal places
    const limitedByDecimals = parseFloat(price.toFixed(maxDecimalPlaces));
    return limitedByDecimals.toString();
  }

  // Too many significant figures - need to round to 5 significant figures
  const multiplier = Math.pow(10, MAX_SIGNIFICANT_FIGURES - Math.floor(Math.log10(Math.abs(price))) - 1);
  const roundedPrice = Math.round(price * multiplier) / multiplier;
  
  // Also respect decimal place limits
  const finalPrice = parseFloat(roundedPrice.toFixed(maxDecimalPlaces));
  
  return finalPrice.toString();
}

/**
 * Format size according to Hyperliquid's szDecimals
 */
export function formatHyperliquidSize(size: number, szDecimals: number): string {
  const roundedSize = parseFloat(size.toFixed(szDecimals));
  return roundedSize.toString();
}

/**
 * Validate if a price string is valid for Hyperliquid
 */
export function validateHyperliquidPrice(
  priceStr: string, 
  szDecimals: number, 
  isSpot: boolean = false
): { isValid: boolean; reason?: string } {
  const price = parseFloat(priceStr);
  const maxDecimals = isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP;
  const maxDecimalPlaces = maxDecimals - szDecimals;

  // Check if it's an integer (always valid)
  if (Number.isInteger(price)) {
    return { isValid: true };
  }

  // Check decimal places
  const decimalPlaces = (priceStr.split('.')[1] || '').length;
  if (decimalPlaces > maxDecimalPlaces) {
    return { 
      isValid: false, 
      reason: `Too many decimal places: ${decimalPlaces} > ${maxDecimalPlaces}` 
    };
  }

  // Check significant figures
  const priceStr2 = price.toString();
  let significantFigures = 0;
  let hasStartedCounting = false;
  
  for (const char of priceStr2.replace('.', '')) {
    if (char !== '0') hasStartedCounting = true;
    if (hasStartedCounting) significantFigures++;
  }

  if (significantFigures > MAX_SIGNIFICANT_FIGURES) {
    return { 
      isValid: false, 
      reason: `Too many significant figures: ${significantFigures} > ${MAX_SIGNIFICANT_FIGURES}` 
    };
  }

  return { isValid: true };
}

/**
 * Validate if a size string is valid for Hyperliquid
 */
export function validateHyperliquidSize(
  sizeStr: string, 
  szDecimals: number
): { isValid: boolean; reason?: string } {
  const decimalPlaces = (sizeStr.split('.')[1] || '').length;
  
  if (decimalPlaces > szDecimals) {
    return { 
      isValid: false, 
      reason: `Size has too many decimal places: ${decimalPlaces} > ${szDecimals}` 
    };
  }

  return { isValid: true };
}

// Examples based on the documentation:
export const EXAMPLES = {
  perp: {
    // For perps (MAX_DECIMALS = 6)
    valid: {
      szDecimals1: ['1234.5', '0.01234'], // szDecimals = 1, max 5 decimal places
      szDecimals3: ['1.001'], // szDecimals = 3, max 3 decimal places
    },
    invalid: {
      tooManySignificantFigures: ['1234.56'], // 6 significant figures > 5
      tooManyDecimals: ['0.0012345'], // 7 decimal places > 6
    }
  },
  spot: {
    // For spot (MAX_DECIMALS = 8)  
    valid: {
      szDecimals0or1: ['0.0001234'], // szDecimals = 0 or 1, max 7-8 decimal places
    },
    invalid: {
      szDecimalsGt2: ['0.0001234'], // If szDecimals > 2, this exceeds 8-2=6 decimal places
    }
  }
};
