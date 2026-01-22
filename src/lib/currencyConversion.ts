/**
 * Global Currency Conversion Utility
 * 
 * Converts amounts to the base currency using the rate and operator from currency_rates table.
 * - If operator is 'multiply': result = amount * rate_to_base
 * - If operator is 'divide': result = amount / rate_to_base
 */

export type ConversionOperator = 'multiply' | 'divide';

export interface CurrencyRate {
  id: string;
  currency_id: string;
  rate_to_base: number;
  conversion_operator: ConversionOperator;
  effective_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_name_ar?: string | null;
  symbol?: string | null;
  is_base: boolean;
  is_active: boolean;
}

/**
 * Convert an amount from a foreign currency to the base currency
 * 
 * @param amount - The amount to convert
 * @param currencyId - The ID of the source currency
 * @param currencyRates - Array of currency rates from the database
 * @param baseCurrency - The base currency object (optional, for early return if already base)
 * @returns The converted amount in base currency
 */
export function convertToBaseCurrency(
  amount: number,
  currencyId: string | null | undefined,
  currencyRates: CurrencyRate[],
  baseCurrency?: Currency | null
): number {
  // If no currency specified or no amount, return as-is
  if (!currencyId || !amount) return amount;
  
  // If already in base currency, return as-is
  if (baseCurrency && currencyId === baseCurrency.id) return amount;
  
  // Find the rate for this currency
  const rate = currencyRates.find(r => r.currency_id === currencyId);
  
  if (!rate || rate.rate_to_base <= 0) {
    // No rate found, return original amount
    return amount;
  }
  
  // Apply conversion based on operator
  const operator = rate.conversion_operator || 'multiply';
  
  if (operator === 'multiply') {
    return amount * rate.rate_to_base;
  } else {
    return amount / rate.rate_to_base;
  }
}

/**
 * Convert an amount from base currency to a foreign currency
 * 
 * @param amount - The amount in base currency to convert
 * @param currencyId - The ID of the target currency
 * @param currencyRates - Array of currency rates from the database
 * @param baseCurrency - The base currency object (optional, for early return if already base)
 * @returns The converted amount in the target currency
 */
export function convertFromBaseCurrency(
  amount: number,
  currencyId: string | null | undefined,
  currencyRates: CurrencyRate[],
  baseCurrency?: Currency | null
): number {
  // If no currency specified or no amount, return as-is
  if (!currencyId || !amount) return amount;
  
  // If already in base currency, return as-is
  if (baseCurrency && currencyId === baseCurrency.id) return amount;
  
  // Find the rate for this currency
  const rate = currencyRates.find(r => r.currency_id === currencyId);
  
  if (!rate || rate.rate_to_base <= 0) {
    // No rate found, return original amount
    return amount;
  }
  
  // Apply reverse conversion based on operator
  // If original is multiply, we divide; if original is divide, we multiply
  const operator = rate.conversion_operator || 'multiply';
  
  if (operator === 'multiply') {
    return amount / rate.rate_to_base;
  } else {
    return amount * rate.rate_to_base;
  }
}

/**
 * Calculate exchange rate between two currencies
 * 
 * @param fromCurrencyId - The source currency ID
 * @param toCurrencyId - The target currency ID
 * @param currencyRates - Array of currency rates from the database
 * @param currencies - Array of currencies (to check if base currency)
 * @returns The exchange rate to convert from source to target
 */
export function calculateExchangeRate(
  fromCurrencyId: string | null | undefined,
  toCurrencyId: string | null | undefined,
  currencyRates: CurrencyRate[],
  currencies: Currency[]
): number {
  if (!fromCurrencyId || !toCurrencyId || fromCurrencyId === toCurrencyId) {
    return 1;
  }
  
  // Get rate for source currency (how much 1 unit equals in base currency)
  const fromCurrency = currencies.find(c => c.id === fromCurrencyId);
  const toCurrency = currencies.find(c => c.id === toCurrencyId);
  
  // Convert 1 unit of fromCurrency to base
  const fromInBase = fromCurrency?.is_base 
    ? 1 
    : convertToBaseCurrency(1, fromCurrencyId, currencyRates);
  
  // Convert 1 unit of base to toCurrency
  const toInBase = toCurrency?.is_base 
    ? 1 
    : convertToBaseCurrency(1, toCurrencyId, currencyRates);
  
  // Calculate exchange rate
  if (toInBase === 0) return 1;
  return fromInBase / toInBase;
}

/**
 * Get the latest rate for a specific currency
 * 
 * @param currencyId - The currency ID to get rate for
 * @param currencyRates - Array of currency rates from the database
 * @param currencies - Array of currencies (to check if base currency)
 * @returns The rate_to_base value, or 1 if base currency or not found
 */
export function getLatestRate(
  currencyId: string | null | undefined,
  currencyRates: CurrencyRate[],
  currencies?: Currency[]
): number {
  if (!currencyId) return 1;
  
  // Check if this is the base currency
  if (currencies) {
    const currency = currencies.find(c => c.id === currencyId);
    if (currency?.is_base) return 1;
  }
  
  // Find the rate from currency_rates table
  const rate = currencyRates.find(r => r.currency_id === currencyId);
  return rate?.rate_to_base || 1;
}

/**
 * Get the conversion operator for a specific currency
 * 
 * @param currencyId - The currency ID
 * @param currencyRates - Array of currency rates from the database
 * @returns The conversion operator ('multiply' or 'divide'), defaults to 'multiply'
 */
export function getConversionOperator(
  currencyId: string | null | undefined,
  currencyRates: CurrencyRate[]
): ConversionOperator {
  if (!currencyId) return 'multiply';
  
  const rate = currencyRates.find(r => r.currency_id === currencyId);
  return rate?.conversion_operator || 'multiply';
}
