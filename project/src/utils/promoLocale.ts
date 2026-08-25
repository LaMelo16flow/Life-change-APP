type LocalizablePromo = { title?: string | null; buy_quantity: number; free_quantity: number };

export function getPromoBuyGetFreeText(buyQuantity: number, freeQuantity: number, language: 'en' | 'fr'): string {
  return language === 'fr'
    ? `Achetez ${buyQuantity} Obtenez ${freeQuantity} Gratuit`
    : `Buy ${buyQuantity} Get ${freeQuantity} Free`;
}

export function getPromoLabel(promo: LocalizablePromo, language: 'en' | 'fr'): string {
  if (promo.title?.trim()) return promo.title;
  return getPromoBuyGetFreeText(promo.buy_quantity, promo.free_quantity, language);
}
