type LocalizableName = { name: string; name_en?: string | null };
type LocalizableDescription = { description?: string | null; description_en?: string | null };
type LocalizableType = { product_type: string; product_type_en?: string | null };

export function getLocalizedProductName(product: LocalizableName, language: 'en' | 'fr'): string {
  if (language === 'en' && product.name_en?.trim()) return product.name_en;
  return product.name;
}

export function getLocalizedProductDescription(product: LocalizableDescription, language: 'en' | 'fr'): string {
  if (language === 'en' && product.description_en?.trim()) return product.description_en;
  return product.description || '';
}

export function getLocalizedProductType(product: LocalizableType, language: 'en' | 'fr'): string {
  if (language === 'en' && product.product_type_en?.trim()) return product.product_type_en;
  return product.product_type;
}
