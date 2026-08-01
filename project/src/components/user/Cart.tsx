import { useState, useEffect } from 'react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/currency';
import { ShoppingCart, Trash2, Plus, Minus, AlertCircle, Check, X, Tag, Wallet } from 'lucide-react';
import { sendOrderPlacedNotification } from '../../utils/notifications';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    product_type: string;
    pv_value: number;
    description: string;
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [profile, setProfile] = useState<Profile & { countries?: { currency_code: string; currency_symbol: string } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [lifeChangerCode, setLifeChangerCode] = useState('');
  const [codeValidation, setCodeValidation] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    loadCartData();
  }, []);

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
          .select('*, countries(currency_code, currency_symbol)')
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

        if (profileRes.data.country_code) {
          const pricesRes = await supabase
            .from('product_prices')
            .select('product_id, price')
            .eq('country_code', profileRes.data.country_code);

          if (pricesRes.data) {
            const priceMap: Record<string, number> = {};
            pricesRes.data.forEach((p: ProductPrice) => {
              priceMap[p.product_id] = p.price;
            });
            setPrices(priceMap);
          }
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
        (!p.country_code || p.country_code === profile?.country_code)
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
      setMessage({ type: 'error', text: 'Failed to update quantity' });
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
      setMessage({ type: 'success', text: 'Item removed from cart' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error removing item:', error);
      setMessage({ type: 'error', text: 'Failed to remove item' });
    } finally {
      setUpdating(null);
    }
  }

  const validateLifeChangerCode = async (code: string) => {
    if (!code.trim()) {
      setCodeValidation(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('life_changer_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setCodeValidation({ valid: false, message: 'Invalid code' });
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setCodeValidation({ valid: false, message: 'Code has expired' });
        return;
      }

      if (data.usage_limit && data.times_used >= data.usage_limit) {
        setCodeValidation({ valid: false, message: 'Code usage limit reached' });
        return;
      }

      setCodeValidation({
        valid: true,
        message: `Valid! You'll receive ${data.bonus_pv} bonus PV`
      });
    } catch (error) {
      console.error('Error validating code:', error);
      setCodeValidation({ valid: false, message: 'Error validating code' });
    }
  };

  async function handleCheckout() {
    if (!profile || cartItems.length === 0) return;

    setProcessing(true);
    setMessage(null);

    try {
      const region = profile.region || profile.country_code;
      let totalFreeItems = 0;
      let orderTotal = 0;

      for (const item of cartItems) {
        const price = prices[item.product_id];
        if (!price) {
          throw new Error(`Price not available for ${item.products.name}`);
        }

        const promo = getPromoForProduct(item.product_id);
        const { freeItems } = promo
          ? getPromoBonusInfo(promo, item.quantity)
          : { freeItems: 0 };

        const totalQuantity = item.quantity + freeItems;

        const { data: inventoryData, error: inventoryError } = await supabase
          .from('product_inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', item.product_id)
          .eq('region', region)
          .maybeSingle();

        if (inventoryError) {
          throw new Error(`Error checking inventory for ${item.products.name}`);
        }

        if (!inventoryData) {
          throw new Error(`${item.products.name} not available in your region`);
        }

        const availableStock = inventoryData.quantity - inventoryData.reserved_quantity;
        if (availableStock < totalQuantity) {
          throw new Error(`Only ${availableStock} units of ${item.products.name} available`);
        }

        orderTotal += price * item.quantity;
        totalFreeItems += freeItems;
      }

      const walletBalance = profile.balance || 0;
      if (walletBalance < orderTotal) {
        throw new Error(`Insufficient wallet balance. You have ${formatCurrency(walletBalance, profile.countries?.currency_code || 'USD')} but need ${formatCurrency(orderTotal, profile.countries?.currency_code || 'USD')}`);
      }

      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

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
          currency_code: profile.countries?.currency_code || 'USD',
          region: region,
          status: 'pending',
          life_changer_code: lifeChangerCode.trim().toUpperCase() || null,
          items_count: cartItems.length,
          metadata: { items_count: cartItems.length },
        })
        .select()
        .single();

      if (orderError || !orderData) throw orderError || new Error('Failed to create order');

      const newBalance = walletBalance - orderTotal;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user?.id);

      if (balanceError) throw balanceError;

      await supabase.from('wallet_transactions').insert({
        user_id: user?.id,
        type: 'debit',
        amount: orderTotal,
        balance_after: newBalance,
        description: `Payment for order ${orderNumber}`,
        reference_id: orderData.id,
      });

      setProfile((prev: any) => ({ ...prev, balance: newBalance }));

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

        productNames.push(`${item.products.name} x${totalQuantity}`);

        const { data: inventoryData } = await supabase
          .from('product_inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', item.product_id)
          .eq('region', region)
          .single();

        if (inventoryData) {
          await supabase
            .from('product_inventory')
            .update({
              reserved_quantity: inventoryData.reserved_quantity + totalQuantity,
            })
            .eq('product_id', item.product_id)
            .eq('region', region);

          await supabase
            .from('inventory_logs')
            .insert({
              product_id: item.product_id,
              region: region,
              action: 'reservation',
              quantity_change: -totalQuantity,
              quantity_after: inventoryData.quantity,
              performed_by: user?.id,
              notes: `Order ${orderNumber} - pending approval${freeItems > 0 ? ` (includes ${freeItems} free)` : ''}`,
            });
        }
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
      }

      await sendOrderPlacedNotification({
        orderNumber,
        productName: productNames.join(', '),
        quantity: cartItems.reduce((sum, item) => {
          const promo = getPromoForProduct(item.product_id);
          const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };
          return sum + item.quantity + freeItems;
        }, 0),
        totalAmount: formatCurrency(orderTotal, profile.countries?.currency_code || 'USD'),
        userName: profile.full_name || user?.email || 'Customer',
        userEmail: user?.email || '',
      });

      const { error: clearCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user?.id);

      if (clearCartError) console.error('Error clearing cart:', clearCartError);

      setCartItems([]);
      setShowCheckoutModal(false);
      setLifeChangerCode('');
      setCodeValidation(null);
      setMessage({
        type: 'success',
        text: `Order ${orderNumber} placed successfully!${totalFreeItems > 0 ? ` (${totalFreeItems} free items included!)` : ''}`
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Checkout error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to place order' });
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
    return <div className="text-center py-8">Loading cart...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600" />
            Shopping Cart
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Review and checkout your selected items</p>
        </div>
        {profile && (
          <div className="text-left sm:text-right bg-green-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none">
            <div className="text-xs sm:text-sm text-gray-600">Wallet Balance</div>
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {formatCurrency(profile.balance, profile.countries?.currency_code || 'USD')}
            </div>
          </div>
        )}
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
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h3>
          <p className="text-gray-500">Start shopping to add products to your cart</p>
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
                            alt={item.products.name}
                            className="w-full sm:w-24 h-32 sm:h-24 object-cover rounded-lg"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{item.products.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">{item.products.product_type}</p>
                            {promo && (
                              <div className="flex items-center gap-1 mt-1">
                                <Tag className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                                <span className="text-xs font-bold text-red-600">
                                  {promo.title || `Buy ${promo.buy_quantity} Get ${promo.free_quantity} Free`}
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
                              Add {promo.buy_quantity - item.quantity} more to get {promo.free_quantity} free!
                            </p>
                          </div>
                        )}

                        {freeItems > 0 && (
                          <div className="mb-2 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-700 font-medium">
                              +{freeItems} free item{freeItems > 1 ? 's' : ''} included! (Total: {item.quantity + freeItems})
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
                              <span className="text-gray-600">Unit: </span>
                              <span className="font-semibold">
                                {price ? formatCurrency(price, profile?.countries?.currency_code || 'USD') : 'N/A'}
                              </span>
                              <span className="text-orange-600 ml-2">{item.products.pv_value} PV</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right pt-3 sm:pt-0 border-t sm:border-0 border-gray-200">
                            <div className="text-xs sm:text-sm text-gray-600">Subtotal</div>
                            <div className="text-lg sm:text-xl font-bold text-gray-900">
                              {formatCurrency(subtotal, profile?.countries?.currency_code || 'USD')}
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
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">Order Summary</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Items ({cartItems.length})</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(cartTotal, profile?.countries?.currency_code || 'USD')}
                </span>
              </div>
              {totalFreeItemsInCart > 0 && (
                <div className="flex justify-between text-green-700">
                  <span className="font-medium flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    Free Items
                  </span>
                  <span className="font-bold">+{totalFreeItemsInCart}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Total PV</span>
                <span className="font-semibold text-orange-600">{totalPV} PV</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-brand-600">
                  {formatCurrency(cartTotal, profile?.countries?.currency_code || 'USD')}
                </span>
              </div>
            </div>

            {profile && (profile.balance || 0) < cartTotal && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">Insufficient wallet balance</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  You need {formatCurrency(cartTotal - (profile.balance || 0), profile.countries?.currency_code || 'USD')} more to place this order. Please top up your wallet first.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowCheckoutModal(true)}
              disabled={processing || cartItems.length === 0 || (profile && (profile.balance || 0) < cartTotal)}
              className="w-full bg-brand-700 text-white py-4 rounded-lg hover:bg-brand-800 font-semibold text-lg transition-colors disabled:bg-gray-400"
            >
              Proceed to Checkout
            </button>

            <p className="text-xs text-gray-500 mt-3 text-center">
              {(profile?.balance || 0) >= cartTotal
                ? 'Order amount will be deducted from your wallet'
                : 'Top up your wallet to place an order'}
            </p>
          </div>
        </>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Checkout</h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Order Summary ({cartItems.length} items)</h4>
                <div className="space-y-2 text-sm">
                  {cartItems.map(item => {
                    const promo = getPromoForProduct(item.product_id);
                    const { freeItems } = promo ? getPromoBonusInfo(promo, item.quantity) : { freeItems: 0 };
                    return (
                      <div key={item.id}>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {item.products.name} x {item.quantity}
                          </span>
                          <span className="font-semibold">
                            {formatCurrency(
                              (prices[item.product_id] || 0) * item.quantity,
                              profile?.countries?.currency_code || 'USD'
                            )}
                          </span>
                        </div>
                        {freeItems > 0 && (
                          <div className="flex justify-between text-green-600 ml-2">
                            <span className="text-xs">+{freeItems} free</span>
                            <span className="text-xs font-medium">({item.quantity + freeItems} total)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Life Changer Code (Optional)
                </label>
                <input
                  type="text"
                  value={lifeChangerCode}
                  onChange={(e) => {
                    setLifeChangerCode(e.target.value);
                    if (e.target.value.trim()) {
                      validateLifeChangerCode(e.target.value);
                    } else {
                      setCodeValidation(null);
                    }
                  }}
                  placeholder="Enter code for bonus PV"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 uppercase"
                />
                {codeValidation && (
                  <div className={`mt-2 text-sm flex items-center gap-1 ${
                    codeValidation.valid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {codeValidation.valid ? <Check size={16} /> : <AlertCircle size={16} />}
                    {codeValidation.message}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-bold text-lg text-brand-600">
                    {formatCurrency(cartTotal, profile?.countries?.currency_code || 'USD')}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Total PV:</span>
                  <span className="font-bold text-orange-600">{totalPV} PV</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  className="flex-1 bg-brand-700 text-white py-3 rounded-lg hover:bg-brand-800 font-semibold disabled:bg-gray-400"
                >
                  {processing ? 'Processing...' : 'Place Order'}
                </button>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
