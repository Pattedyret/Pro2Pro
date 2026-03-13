/**
 * Maps 2-letter nationality codes to CS2 competitive regions.
 */

const regionMap: Record<string, string> = {
  // CIS
  RU: 'CIS', UA: 'CIS', KZ: 'CIS', BY: 'CIS', UZ: 'CIS',
  LT: 'CIS', LV: 'CIS', EE: 'CIS', GE: 'CIS', AM: 'CIS',
  AZ: 'CIS', MD: 'CIS', TJ: 'CIS', KG: 'CIS', TM: 'CIS',

  // Europe
  DE: 'Europe', FR: 'Europe', SE: 'Europe', DK: 'Europe', NO: 'Europe',
  FI: 'Europe', PL: 'Europe', CZ: 'Europe', SK: 'Europe', HU: 'Europe',
  RO: 'Europe', BG: 'Europe', HR: 'Europe', RS: 'Europe', BA: 'Europe',
  SI: 'Europe', PT: 'Europe', ES: 'Europe', IT: 'Europe', NL: 'Europe',
  BE: 'Europe', AT: 'Europe', CH: 'Europe', GB: 'Europe', IE: 'Europe',
  IS: 'Europe', GR: 'Europe', TR: 'Europe', IL: 'Europe', ME: 'Europe',
  MK: 'Europe', AL: 'Europe', XK: 'Europe', CY: 'Europe', MT: 'Europe',
  LU: 'Europe',

  // North America
  US: 'North America', CA: 'North America',

  // South America
  BR: 'South America', AR: 'South America', CL: 'South America',
  UY: 'South America', MX: 'South America', CO: 'South America',
  PE: 'South America', VE: 'South America', EC: 'South America',
  BO: 'South America', PY: 'South America',

  // Asia
  CN: 'Asia', JP: 'Asia', KR: 'Asia', IN: 'Asia', ID: 'Asia',
  MY: 'Asia', TH: 'Asia', PH: 'Asia', SG: 'Asia', VN: 'Asia',
  MN: 'Asia', TW: 'Asia', HK: 'Asia',

  // Oceania
  AU: 'Oceania', NZ: 'Oceania',
};

const regionEmojis: Record<string, string> = {
  'CIS': '🏔️',
  'Europe': '🇪🇺',
  'North America': '🌎',
  'South America': '🌎',
  'Asia': '🌏',
  'Oceania': '🌊',
  'Other': '🌍',
};

export function getRegion(nationalityCode: string | null): string {
  if (!nationalityCode) return 'Other';
  return regionMap[nationalityCode.toUpperCase()] ?? 'Other';
}

export function getRegionEmoji(region: string): string {
  return regionEmojis[region] ?? '🌍';
}
