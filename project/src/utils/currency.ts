export const COUNTRY_CURRENCIES: Record<string, { code: string; symbol: string; name: string }> = {
  US: { code: 'USD', symbol: '$', name: 'US Dollar' },
  GB: { code: 'GBP', symbol: '£', name: 'British Pound' },
  EU: { code: 'EUR', symbol: '€', name: 'Euro' },
  JP: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  CN: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  IN: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  CA: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  AU: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  CH: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  SE: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  NO: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  DK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  NZ: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  SG: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  HK: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  KR: { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  MX: { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  BR: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  ZA: { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  RU: { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  TR: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  PL: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  TH: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  ID: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  MY: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  PH: { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  CZ: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  IL: { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  CL: { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
  AE: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  SA: { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  AR: { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  CO: { code: 'COP', symbol: '$', name: 'Colombian Peso' },
  EG: { code: 'EGP', symbol: '£', name: 'Egyptian Pound' },
  NG: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  KE: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  VN: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  BD: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  PK: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  PE: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
};

const EUROZONE_COUNTRIES = [
  'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR'
];

export function getCurrencyForCountry(countryCode: string): { code: string; symbol: string; name: string } {
  if (EUROZONE_COUNTRIES.includes(countryCode)) {
    return COUNTRY_CURRENCIES['EU'];
  }

  return COUNTRY_CURRENCIES[countryCode] || COUNTRY_CURRENCIES['US'];
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = Object.values(COUNTRY_CURRENCIES).find(c => c.code === currencyCode) || COUNTRY_CURRENCIES['US'];

  return `${currency.symbol}${amount.toFixed(2)}`;
}
