import { useState, useEffect } from 'react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { getLocalizedProductName, getLocalizedProductType } from '../../utils/productLocale';
import { getPromoLabel } from '../../utils/promoLocale';
import { ShoppingCart, Trash2, Plus, Minus, AlertCircle, Check, X, Tag } from 'lucide-react';
import { sendOrderPlacedNotification, maybeAlertLowStock } from '../../utils/notifications';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    name_en?: string | null;
    product_type: string;
    product_type_en?: string | null;
    pv_value: number;
    description: string;
    description_en?: string | null;
    image_url: string | null;
  };
}

interface ProductPrice {
  product_id: string;
  price: number;
}

interface ProductPromotion {
  id: string;
  product_id: string;
  title: string;
  buy_quantity: number;
  free_quantity: number;
  country_code: string | null;
}

export default function Cart() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  useEffect(() => {
    loadCartData();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('cart-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices' }, () => loadCartData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_inventory' }, () => loadCartData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_promotions' }, () => loadCartData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${user.id}` }, () => loadCartData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadCartData() {
    try {
      const [cartRes, profileRes, promosRes] = await Promise.all([
        supabase
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user?.id)
          .single(),
        supabase
          .from('product_promotions')
          .select('id, product_id, title, buy_quantity, free_quantity, country_code'),
      ]);

      if (cartRes.data) setCartItems(cartRes.data);
      if (promosRes.data) setPromotions(promosRes.data);

      if (profileRes.data) {
        setProfile(profileRes.data);

        const pricesRes = await supabase
          .from('product_prices')
          .select('product_id, price')
          .eq('country_code', 'CA');

        if (pricesRes.data) {
          const priceMap: Record<string, number> = {};
          pricesRes.data.forEach((p: ProductPrice) => {
            priceMap[p.product_id] = p.price;
          });
          setPrices(priceMap);
        }
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  }

  function getPromoForProduct(productId: string): ProductPromotion | null {
    return promotions.find(
      (p) =>
        p.product_id === productId &&
        (!p.country_code || p.country_code === 'CA')
    ) || null;
  }

  function getPromoBonusInfo(promo: ProductPromotion, quantity: number) {
    if (quantity < promo.buy_quantity) return { freeItems: 0, paidQuantity: quantity };
    const sets = Math.floor(quantity / promo.buy_quantity);
    const freeItems = sets * promo.free_quantity;
    return { freeItems, paidQuantity: quantity };
  }

  async function updateQuantity(itemId: string, _productId: string, newQuantity: number) {
    if (newQuantity < 1) return;

    setUpdating(itemId);

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (error) throw error;

      setCartItems(items =>
        items.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (error) {
      console.error('Error updating quantity:', error);
      setMessage({ type: 'error', text: t('cart.failedUpdateQty') });
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(itemId: string) {
    setUpdating(itemId);

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setCartItems(items => items.filter(item => item.id !== itemId));
      setMessage({ type: 'success', text: t('cart.itemRemoved') });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error removing item:', error);
      setMessage({ type: 'error', text: t('cart.failedRemoveItem') });
    } finally {
      setUpdating(null);
    }
  }

  async function handleCheckout() {
    if (!profile || cartItems.length === 0) return;

    setProcessing(true);
    setMessage(null);

    const reservedSoFar: string[] = [];

    const rollbackReservations = async () => {
      for (const token of reservedSoFar) {
        await supabase.rpc('release_inventory', {
          p_token: token,
          p_notes: 'Rollback: checkout failed partway through',
        });
      }
    };

    try {
      let totalFreeItems = 0;
      let orderTotal = 0;
      const itemsToReserve: { product_id: string; name: string; totalQuantity: number; freeItems: number; availableBefore: number; lowStockThreshold: number }[] = [];

      for (const item of cartItems) {
        const price = prices[item.product_id];
        if (!price) {
          throw new Error(t('cart.priceNotAvailableFor', { name: getLocalizedProductName(item.products, language) }));
        }

        const promo = getPromoForProduct(item.product_id);
        const { freeItems } = promo
          ? getPromoBonusInfo(promo, item.quantity)
          : { freeItems: 0 };

        const totalQuantity = item.quantity + freeItems;

        const { data: inventoryData, error: inventoryError } = await supabase
          .from('product_inventory')
          .select('quantity, reserved_quantity, low_stock_threshold')
          .eq('product_id', item.product_id)
          .eq('region', 'CA')
          .maybeSingle();

        if (inventoryError) {
          throw new Error(t('cart.errorCheckingInventory', { name: getLocalizedProductName(item.products, language) }));
        }

        if (!inventoryData) {
          throw new Error(t('cart.notAvailableRegion', { name: getLocalizedProductName(item.products, language) }));
        }

        const availableStock = inventoryData.quantity - inventoryData.reserved_quantity;
        if (availableStock < totalQuantity) {
          throw new Error(t('cart.onlyUnitsOfAvailable', { available: availableStock, name: getLocalizedProductName(item.products, language) }));
        }

        orderTotal += price * item.quantity;
        totalFreeItems += freeItems;
        itemsToReserve.push({
          product_id: item.product_id,
          name: getLocalizedProductName(item.products, language),
          totalQuantity,
          freeItems,
          availableBefore: availableStock,
          lowStockThreshold: inventoryData.low_stock_threshold,
        });
      }

      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      for (const item of itemsToReserve) {
        const { data: reservationToken, error: reserveError } = await supabase.rpc('reserve_inventory', {
          p_product_id: item.product_id,
          p_region: 'CA',
          p_quantity: item.totalQuantity,
          p_notes: `Order ${orderNumber} - pending approval${item.freeItems > 0 ? ` (includes ${item.freeItems} free)` : ''}`,
        });

        if (reserveError) {
          await rollbackReservations();
          throw new Error(t('cart.failedReserveStockFor', { name: item.name, message: reserveError.message }));
        }

        maybeAlertLowStock(
          item.name,
          'CA',
          item.availableBefore,
          item.availableBefore - item.totalQuantity,
          item.lowStockThreshold
        ).catch((err) => console.error('Error sending low stock alert:', err));

        reservedSoFar.push(reservationToken);
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user?.id,
          product_id: null,
          quantity: cartItems.reduce((sum, item) => {
            const promo = getPromoForProduct(item.product_id);
            const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };
            return sum + item.quantity + freeItems;
          }, 0),
          unit_price: 0,
          total_amount: orderTotal,
          currency_code: 'CAD',
          region: 'CA',
          status: 'pending',
          items_count: cartItems.length,
          metadata: { items_count: cartItems.length },
        })
        .select()
        .single();

      if (orderError || !orderData) {
        await rollbackReservations();
        throw orderError || new Error('Failed to create order');
      }

      const orderItems = [];
      const productNames: string[] = [];

      for (const item of cartItems) {
        const price = prices[item.product_id];
        const promo = getPromoForProduct(item.product_id);
        const { freeItems } = promo
          ? getPromoBonusInfo(promo, item.quantity)
          : { freeItems: 0 };
        const totalQuantity = item.quantity + freeItems;

        orderItems.push({
          order_id: orderData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          free_quantity: freeItems,
          unit_price: price,
          subtotal: price * item.quantity,
          pv_value: item.products.pv_value,
          promotion_id: promo?.id || null,
        });

        productNames.push(`${getLocalizedProductName(item.products, language)} x${totalQuantity}`);
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        await rollbackReservations();
        throw new Error(t('cart.failedSaveOrderItems', { message: itemsError.message }));
      }

      await sendOrderPlacedNotification({
        orderNumber,
        productName: productNames.join(', '),
        quantity: cartItems.reduce((sum, item) => {
          const promo = getPromoForProduct(item.product_id);
          const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };
          return sum + item.quantity + freeItems;
        }, 0),
        totalAmount: formatCurrency(orderTotal),
        userName: profile.full_name || user?.email || 'Customer',
        userEmail: user?.email || '',
      }, user?.id);

      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user?.id);

      if (clearCartError) console.error('Error clearing cart:', clearCartError);

      setCartItems([]);
      setShowCheckoutModal(false);
      setMessage({
        type: 'success',
        text: t('cart.orderPlacedSuccessSimple', { orderNumber }) + (totalFreeItems > 0 ? t('shop.freeItemsIncludedSuffix', { n: totalFreeItems }) : '')
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Checkout error:', error);
      setMessage({ type: 'error', text: error.message || t('shop.failedPlaceOrder') });
    } finally {
      setProcessing(false);
    }
  }

  const cartTotal = cartItems.reduce((total, item) => {
    const price = prices[item.product_id] || 0;
    return total + (price * item.quantity);
  }, 0);

  const totalFreeItemsInCart = cartItems.reduce((total, item) => {
    const promo = getPromoForProduct(item.product_id);
    if (!promo) return total;
    const { freeItems } = getPromoBonusInfo(promo, item.quantity);
    return total + freeItems;
  }, 0);

  const totalPV = cartItems.reduce((total, item) => {
    const promo = getPromoForProduct(item.product_id);
    const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };
    return total + (item.products.pv_value * (item.quantity + freeItems));
  }, 0);

  if (loading) {
    return <div className="text-center py-8">{t('cart.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600" />
            {t('cart.title')}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{t('cart.subtitle')}</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('cart.empty')}</h3>
          <p className="text-gray-500">{t('cart.emptySubtitle')}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {cartItems.map(item => {
                const price = prices[item.product_id];
                const subtotal = price ? price * item.quantity : 0;
                const promo = getPromoForProduct(item.product_id);
                const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };

                return (
                  <div key={item.id} className="p-4 sm:p-6 hover:bg-gray-50 transition">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-shrink-0">
                        {item.products.image_url && (
                          <img
                            src={item.products.image_url}
                            alt={getLocalizedProductName(item.products, language)}
                            className="w-full sm:w-24 h-32 sm:h-24 object-cover rounded-lg"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{getLocalizedProductName(item.products, language)}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">{getLocalizedProductType(item.products, language)}</p>
                            {promo && (
                              <div className="flex items-center gap-1 mt-1">
                                <Tag className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                <span className="text-xs font-bold text-red-600">
                                  {getPromoLabel(promo, language)}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            disabled={updating === item.id}
                            className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        {promo && item.quantity < promo.buy_quantity && (
                          <div className="mb-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs text-amber-700 font-medium">
                              {t('shop.addMoreToGetFree', { n: promo.buy_quantity - item.quantity, free: promo.free_quantity })}
                            </p>
                          </div>
                        )}

                        {freeItems > 0 && (
                          <div className="mb-2 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-700 font-medium">
                              {t('shop.freeItemsIncluded', { n: freeItems })} {t('cart.totalCount', { n: item.quantity + freeItems })}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-2 border border-gray-300 rounded-lg self-start">
                              <button
                                onClick={() => updateQuantity(item.id, item.product_id, item.quantity - 1)}
                                disabled={updating === item.id || item.quantity <= 1}
                                className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-semibold text-gray-900 min-w-[2rem] text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.product_id, item.quantity + 1)}
                                disabled={updating === item.id}
                                className="p-2 hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="text-xs sm:text-sm">
                              <span className="text-gray-600">{t('cart.unitLabel')} </span>
                              <span className="font-semibold">
                                {price ? formatCurrency(price) : t('common.na')}
                              </span>
                              <span className="text-orange-600 ml-2">{item.products.pv_value} PV</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right pt-3 sm:pt-0 border-t sm:border-0 border-gray-200">
                            <div className="text-xs sm:text-sm text-gray-600">{t('cart.subtotal')}</div>
                            <div className="text-lg sm:text-xl font-bold text-gray-900">
                              {formatCurrency(subtotal)}
                            </div>
                            <div className="text-xs sm:text-sm text-orange-600 font-medium">
                              {item.products.pv_value * (item.quantity + freeItems)} PV
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">{t('cart.orderSummary')}</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>{t('cart.itemsCount', { n: cartItems.length })}</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              {totalFreeItemsInCart > 0 && (
                <div className="flex justify-between text-green-700">
                  <span className="font-medium flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    {t('cart.freeItems')}
                  </span>
                  <span className="font-bold">+{totalFreeItemsInCart}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>{t('pv.total')}</span>
                <span className="font-semibold text-orange-600">{totalPV} PV</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>{t('cart.total')}</span>
                <span className="text-brand-600">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowCheckoutModal(true)}
              disabled={processing || cartItems.length === 0}
              className="w-full bg-brand-700 text-white py-4 rounded-lg hover:bg-brand-800 font-semibold text-lg transition-colors disabled:bg-gray-400"
            >
              {t('cart.proceedCheckout')}
            </button>
          </div>
        </>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{t('cart.checkoutModalTitle')}</h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">{t('cart.orderSummaryWithCount', { n: cartItems.length })}</h4>
                <div className="space-y-2 text-sm">
                  {cartItems.map(item => {
                    const promo = getPromoForProduct(item.product_id);
                    const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };
                    return (
                      <div key={item.id}>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {getLocalizedProductName(item.products, language)} x {item.quantity}
                          </span>
                          <span className="font-semibold">
                            {formatCurrency((prices[item.product_id] || 0) * item.quantity)}
                          </span>
                        </div>
                        {freeItems > 0 && (
                          <div className="flex justify-between text-green-600 ml-2">
                            <span className="text-xs">{t('cart.freeShort', { n: freeItems })}</span>
                            <span className="text-xs font-medium">{t('cart.totalCount', { n: item.quantity + freeItems })}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">{t('shop.totalAmount')}:</span>
                  <span className="font-bold text-lg text-brand-600">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">{t('shop.totalPVLabel')}</span>
                  <span className="font-bold text-orange-600">{totalPV} PV</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  className="flex-1 bg-brand-700 text-white py-3 rounded-lg hover:bg-brand-800 font-semibold disabled:bg-gray-400"
                >
                  {processing ? t('common.processing') : t('common.placeOrder')}
                </button>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
