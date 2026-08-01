import { supabase } from '../lib/supabase';

let countriesCache: Record<string, string> | null = null;

export async function loadCountryNames(): Promise<Record<string, string>> {
  if (countriesCache) return countriesCache;

  const { data } = await supabase
    .from('countries')
    .select('code, name');

  const map: Record<string, string> = {};
  if (data) {
    data.forEach((c) => {
      map[c.code] = c.name;
    });
  }
  countriesCache = map;
  return map;
}

export function getCountryName(
  code: string,
  countryMap: Record<string, string>
): string {
  return countryMap[code] || code;
}
