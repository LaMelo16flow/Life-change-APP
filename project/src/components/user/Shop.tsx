import { useState, useEffect } from 'react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { getLocalizedProductName, getLocalizedProductDescription, getLocalizedProductType } from '../../utils/productLocale';
import { getPromoLabel, getPromoBuyGetFreeText } from '../../utils/promoLocale';
import { ShoppingCart, Package, Check, AlertCircle, X, ShoppingBag, Minus, Plus, Gift, Sparkles, Search } from 'lucide-react';
import { sendOrderPlacedNotification } from '../../utils/notifications';
import { MasonryGrid } from './MasonryGrid';

function getMasonryColumns(width: number) {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

function useMasonryColumns() {
  const [columns, setColumns] = useState(() => (typeof window === 'undefined' ? 3 : getMasonryColumns(window.innerWidth)));

  useEffect(() => {
    const onResize = () => setColumns(getMasonryColumns(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return columns;
}

interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
  product_type_en?: string | null;
  pv_value: number;
  description: string;
  description_en?: string | null;
  is_active: boolean;
  image_url: string | null;
}

interface ProductPrice {
  product_id: string;
  price: number;
}

interface ActivePromotion {
  id: string;
  product_id: string;
  title: string;
  buy_quantity: number;
  free_quantity: number;
  country_code: string | null;
}

interface InventoryInfo {
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
}

const isValidImageUrl = (value?: string | null) => {
  if (!value) return false;

  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed !== 'null' && trimmed !== 'undefined';
};

const buildInternetProductImageUrl = () => `${import.meta.env.BASE_URL}logo.webp`;

function getPromoBonusInfo(promo: ActivePromotion, quantity: number) {
  if (quantity < promo.buy_quantity) return { freeItems: 0, paidQuantity: quantity };
  const sets = Math.floor(quantity / promo.buy_quantity);
  const freeItems = sets * promo.free_quantity;
  return { freeItems, paidQuantity: quantity };
}

export default function Shop() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [promotions, setPromotions] = useState<Record<string, ActivePromotion>>({});
  const [inventory, setInventory] = useState<Record<string, InventoryInfo>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const masonryColumns = useMasonryColumns();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('shop-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_inventory' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_promotions' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    try {
      const [productsRes, profileRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            product_prices!inner (price)
          `)
          .eq('is_active', true)
          .order('product_type', { ascending: true }),
        supabase.from('profiles').select('*').eq('id', user?.id).single()
      ]);

      if (productsRes.data) {
        const visibleProducts = productsRes.data.map((product) => ({
          ...product,
          image_url: isValidImageUrl(product.image_url)
            ? product.image_url
            : buildInternetProductImageUrl(),
        })).filter((product) => Boolean(product.name));

        setProducts(visibleProducts);
      }

      if (profileRes.data) {
        setProfile(profileRes.data);

        const [pricesRes, promosRes, inventoryRes] = await Promise.all([
          supabase
            .from('product_prices')
            .select('product_id, price')
            .eq('country_code', 'CA'),
          supabase
            .from('product_promotions')
            .select('id, product_id, title, buy_quantity, free_quantity, country_code')
            .eq('is_active', true)
            .lte('starts_at', new Date().toISOString())
            .gt('ends_at', new Date().toISOString()),
          supabase
            .from('product_inventory')
            .select('product_id, quantity, reserved_quantity, low_stock_threshold')
            .eq('region', 'CA'),
        ]);

        if (pricesRes.data) {
          const priceMap: Record<string, number> = {};
          pricesRes.data.forEach((p: ProductPrice) => {
            priceMap[p.product_id] = p.price;
          });
          setPrices(priceMap);
        }

        if (promosRes.data) {
          const promoMap: Record<string, ActivePromotion> = {};
          promosRes.data.forEach((p: any) => {
            if (!p.country_code || p.country_code === 'CA') {
              if (!promoMap[p.product_id]) {
                promoMap[p.product_id] = p;
              }
            }
          });
          setPromotions(promoMap);
        }

        if (inventoryRes.data) {
          const inventoryMap: Record<string, InventoryInfo> = {};
          inventoryRes.data.forEach((inv: InventoryInfo) => {
            inventoryMap[inv.product_id] = inv;
          });
          setInventory(inventoryMap);
        }
      }
    } catch (error) {
      console.error('Error loading shop data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getCardQty = (productId: string) => cardQuantities[productId] || 1;

  const setCardQty = (productId: string, qty: number, maxStock: number) => {
    const clamped = Math.max(1, Math.min(qty, maxStock));
    setCardQuantities(prev => ({ ...prev, [productId]: clamped }));
  };

  const openOrderModal = (product: Product) => {
    setSelectedProduct(product);
    setOrderQuantity(getCardQty(product.id));
    setShowOrderModal(true);
  };

  async function addToCart(product: Product) {
    const qty = getCardQty(product.id);
    setAddingToCart(product.id);
    setMessage(null);

    try {
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user?.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + qty })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user?.id,
            product_id: product.id,
            quantity: qty,
          });

        if (error) throw error;
      }

      setCardQuantities(prev => ({ ...prev, [product.id]: 1 }));
      setMessage({
        type: 'success',
        text: t('shop.addedToCart', { qty, name: getLocalizedProductName(product, language) })
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      setMessage({ type: 'error', text: error.message || t('shop.failedAddToCart') });
    } finally {
      setAddingToCart(null);
    }
  }

  async function handlePlaceOrder() {
    if (!profile || !selectedProduct) return;

    const originalPrice = prices[selectedProduct.id];
    if (!originalPrice) {
      setMessage({ type: 'error', text: t('shop.priceNotAvailable') });
      return;
    }

    const promo = promotions[selectedProduct.id];
    const { freeItems } = promo
      ? getPromoBonusInfo(promo, orderQuantity)
      : { freeItems: 0 };
    const totalQuantity = orderQuantity + freeItems;
    const totalPrice = originalPrice * orderQuantity;

    setPurchasing(selectedProduct.id);
    setMessage(null);

    try {
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user?.id,
          product_id: selectedProduct.id,
          quantity: totalQuantity,
          unit_price: originalPrice,
          total_amount: totalPrice,
          currency_code: 'CAD',
          region: 'CA',
          status: 'pending',
          items_count: 1,
        })
        .select()
        .single();

      if (orderError || !orderData) throw orderError || new Error('Failed to create order');

      const { error: itemError } = await supabase.from('order_items').insert({
        order_id: orderData.id,
        product_id: selectedProduct.id,
        quantity: orderQuantity,
        free_quantity: freeItems,
        unit_price: originalPrice,
        subtotal: totalPrice,
        pv_value: selectedProduct.pv_value,
        promotion_id: promo?.id || null,
      });

      if (itemError) throw itemError;

      await sendOrderPlacedNotification({
        orderNumber,
        productName: selectedProduct.name,
        quantity: totalQuantity,
        totalAmount: formatCurrency(totalPrice),
        userName: profile.full_name || user?.email || 'Customer',
        userEmail: user?.email || '',
      }, user?.id);

      setShowOrderModal(false);
      setSelectedProduct(null);
      setMessage({
        type: 'success',
        text: t('shop.orderPlacedSuccess', { orderNumber }) + (freeItems > 0 ? t('shop.freeItemsIncludedSuffix', { n: freeItems }) : '')
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Order error:', error);
      setMessage({ type: 'error', text: error.message || t('shop.failedPlaceOrder') });
    } finally {
      setPurchasing(null);
    }
  }

  const productTypes = ['All', ...new Set(products.map(p => p.product_type))];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasActiveFilters = selectedType !== 'All' || normalizedQuery.length > 0;
  const filteredProducts = products.filter((p) => {
    if (selectedType !== 'All' && p.product_type !== selectedType) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      getLocalizedProductName(p, language),
      getLocalizedProductDescription(p, language),
      getLocalizedProductType(p, language),
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const getStockStatus = (productId: string) => {
    const inv = inventory[productId];
    if (!inv) return { available: 0, status: 'unavailable', text: t('shop.notAvailable'), dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600' };
    const available = inv.quantity - inv.reserved_quantity;
    if (available <= 0) return { available: 0, status: 'out', text: t('shop.outOfStock'), dot: 'bg-red-500', pill: 'bg-red-50 text-red-600' };
    if (available <= inv.low_stock_threshold) return { available, status: 'low', text: t('shop.lowStock'), dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' };
    return { available, status: 'in', text: t('common.inStock'), dot: 'bg-green-500', pill: 'bg-green-50 text-green-700' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="space-y-2">
            <div className="skeleton h-7 w-40 rounded-lg" />
            <div className="skeleton h-4 w-56 rounded-lg" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 space-y-3">
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-9 w-24 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="skeleton h-36 w-full" />
              <div className="p-3 sm:p-4 space-y-2.5">
                <div className="skeleton h-3.5 w-20 rounded-full" />
                <div className="skeleton h-4 w-3/4 rounded-lg" />
                <div className="skeleton h-3.5 w-full rounded-lg" />
                <div className="skeleton h-6 w-20 rounded-lg" />
                <div className="skeleton h-9 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-brand-600" />
            </span>
            {t('shop.title')}
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">{t('shop.subtitle')}</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 animate-fade-in ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('shop.searchPlaceholder')}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-transparent rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition"
              aria-label={t('shop.clearFilters')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap overflow-x-auto pb-1 -mx-1 px-1">
          {productTypes.map(type => {
            const productOfType = products.find(p => p.product_type === type);
            const label = type === 'All'
              ? t('shop.allCategories')
              : productOfType ? getLocalizedProductType(productOfType, language) : type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-full font-medium transition-all text-sm whitespace-nowrap flex-shrink-0 ${
                  selectedType === type
                    ? 'bg-brand-700 text-white shadow-sm shadow-brand-700/30'
                    : 'bg-gray-50 text-gray-600 border border-transparent hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between text-sm text-gray-500 px-1">
          <span>{t('shop.resultsCount', { n: filteredProducts.length })}</span>
          <button
            onClick={() => { setSearchQuery(''); setSelectedType('All'); }}
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            {t('shop.clearFilters')}
          </button>
        </div>
      )}

      <MasonryGrid
        items={filteredProducts}
        getKey={(product) => product.id}
        columns={masonryColumns}
        gap={16}
        renderItem={(product) => {
          const originalPrice = prices[product.id];
          const promo = promotions[product.id];
          const cardQty = getCardQty(product.id);
          const { freeItems } = promo ? getPromoBonusInfo(promo, cardQty) : { freeItems: 0 };
          const stock = getStockStatus(product.id);
          const isAvailable = stock.status === 'in' || stock.status === 'low';

          return (
            <div
              className={`group bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-200 relative flex flex-col ${!isAvailable ? 'opacity-75' : ''}`}
            >
              {promo && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm">
                  <Gift className="w-3 h-3" />
                  {getPromoBuyGetFreeText(promo.buy_quantity, promo.free_quantity, language)}
                </div>
              )}

              {product.image_url && (
                <div className="relative w-full bg-gray-50">
                  <img
                    src={product.image_url}
                    alt={getLocalizedProductName(product, language)}
                    className="w-full h-auto block"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `${import.meta.env.BASE_URL}logo.webp`;
                    }}
                  />
                  <div className="absolute top-1.5 right-1.5 bg-orange-600 text-white px-1.5 py-0.5 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    {product.pv_value} PV
                  </div>
                </div>
              )}

              <div className="p-3 sm:p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                    {getLocalizedProductType(product, language)}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${stock.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stock.dot}`} />
                    {stock.text}
                  </span>
                </div>

                <h3 className="font-bold text-sm sm:text-base text-gray-900 mb-1 leading-snug">{getLocalizedProductName(product, language)}</h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{getLocalizedProductDescription(product, language)}</p>

                {promo && (
                  <div className="mb-2 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-[11px] font-semibold text-red-700">
                      {getPromoLabel(promo, language)}
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-gray-100">
                  <div className="mb-2.5">
                    {originalPrice ? (
                      <div className="text-lg sm:text-xl font-bold text-gray-900">
                        {formatCurrency(originalPrice)}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">{t('shop.priceNotSet')}</div>
                    )}
                  </div>

                  {isAvailable && originalPrice && (
                    <div className="mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCardQty(product.id, cardQty - 1, stock.available)}
                          disabled={cardQty <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={stock.available}
                          value={cardQty}
                          onChange={(e) => setCardQty(product.id, parseInt(e.target.value) || 1, stock.available)}
                          className="w-12 h-7 text-center text-xs font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => setCardQty(product.id, cardQty + 1, stock.available)}
                          disabled={cardQty >= stock.available}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        {cardQty > 1 && originalPrice && (
                          <span className="ml-1.5 text-[11px] text-gray-500 font-medium">
                            = {formatCurrency(originalPrice * cardQty)}
                          </span>
                        )}
                      </div>
                      {promo && cardQty < promo.buy_quantity && (
                        <p className="text-[11px] text-amber-600 font-medium mt-1">
                          {t('shop.addMoreToGetFree', { n: promo.buy_quantity - cardQty, free: promo.free_quantity })}
                        </p>
                      )}
                      {freeItems > 0 && (
                        <p className="text-[11px] text-green-600 font-medium mt-1 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          {t('shop.freeItemsIncluded', { n: freeItems })}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!originalPrice || !isAvailable || addingToCart === product.id}
                      className={`flex-1 px-2.5 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 text-xs active:scale-[0.98] ${
                        originalPrice && isAvailable && addingToCart !== product.id
                          ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {addingToCart === product.id ? t('common.adding') : t('shop.addToCart')}
                    </button>
                    <button
                      onClick={() => openOrderModal(product)}
                      disabled={!originalPrice || !isAvailable || purchasing === product.id}
                      className={`flex-1 px-2.5 py-2 rounded-xl font-medium transition-all text-xs active:scale-[0.98] ${
                        originalPrice && isAvailable && purchasing !== product.id
                          ? 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm hover:shadow'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {purchasing === product.id ? t('common.processing') : stock.status === 'out' ? t('shop.outOfStock') : t('common.orderNow')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />

      {filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            {hasActiveFilters ? (
              <Search className="w-8 h-8 text-gray-300" />
            ) : (
              <Package className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <p className="text-gray-500 mb-3">
            {hasActiveFilters ? t('shop.noSearchResults') : t('shop.noProducts')}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedType('All'); }}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              {t('shop.clearFilters')}
            </button>
          )}
        </div>
      )}

      {showOrderModal && selectedProduct && (
        <OrderModal
          product={selectedProduct}
          originalPrice={prices[selectedProduct.id]}
          promo={promotions[selectedProduct.id]}
          quantity={orderQuantity}
          maxStock={getStockStatus(selectedProduct.id).available}
          onQuantityChange={setOrderQuantity}
          purchasing={purchasing === selectedProduct.id}
          onPlaceOrder={handlePlaceOrder}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
}

function OrderModal({
  product,
  originalPrice,
  promo,
  quantity,
  maxStock,
  onQuantityChange,
  purchasing,
  onPlaceOrder,
  onClose,
}: {
  product: Product;
  originalPrice: number;
  promo?: ActivePromotion;
  quantity: number;
  maxStock: number;
  onQuantityChange: (q: number) => void;
  purchasing: boolean;
  onPlaceOrder: () => void;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const { freeItems } = promo
    ? getPromoBonusInfo(promo, quantity)
    : { freeItems: 0 };
  const totalPrice = originalPrice * quantity;
  const totalPV = product.pv_value * (quantity + freeItems);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-900">{t('common.placeOrder')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={getLocalizedProductName(product, language)}
                className="w-20 h-20 object-contain rounded-lg bg-white flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `${import.meta.env.BASE_URL}logo.webp`;
                }}
              />
            )}
            <div className="min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{getLocalizedProductName(product, language)}</h4>
              <p className="text-xs text-gray-500 mb-1.5">{getLocalizedProductType(product, language)}</p>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(originalPrice)}
              </div>
              <div className="text-xs text-orange-600 font-medium">{t('shop.pvPerUnit', { pv: product.pv_value })}</div>
            </div>
          </div>

          {promo && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
              <Gift className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm font-medium text-red-700">
                {getPromoLabel(promo, language)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('shop.quantity')}</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="1"
                max={maxStock}
                value={quantity}
                onChange={(e) => onQuantityChange(Math.max(1, Math.min(maxStock, parseInt(e.target.value) || 1)))}
                className="w-full text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => onQuantityChange(Math.min(maxStock, quantity + 1))}
                disabled={quantity >= maxStock}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {promo && quantity < promo.buy_quantity && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">
                {t('shop.addMoreToGetFree', { n: promo.buy_quantity - quantity, free: promo.free_quantity })}
              </p>
            </div>
          )}

          {freeItems > 0 && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                <Gift className="w-4 h-4" />
                {t('shop.freeItemsIncluded', { n: freeItems })} ({t('orders.total')}: {quantity + freeItems})
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('shop.totalAmount')}:</span>
              <span className="font-bold text-lg text-gray-900">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('shop.totalPVLabel')}</span>
              <span className="font-bold text-orange-600">
                {totalPV} PV
              </span>
            </div>
            {freeItems > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('shop.freeItemsLabel')}</span>
                <span className="font-bold text-green-600">
                  +{freeItems}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 text-center">
            {t('shop.orderPending')}
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onPlaceOrder}
              disabled={purchasing}
              className="flex-1 bg-brand-700 text-white py-3 rounded-xl hover:bg-brand-800 font-semibold shadow-sm hover:shadow transition disabled:bg-gray-300 disabled:shadow-none active:scale-[0.98]"
            >
              {purchasing ? t('common.processing') : t('common.placeOrder')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 font-semibold transition active:scale-[0.98]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
