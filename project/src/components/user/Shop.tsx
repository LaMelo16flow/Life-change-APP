import { useState, useEffect } from 'react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/currency';
import { ShoppingCart, Package, Check, AlertCircle, X, ShoppingBag, Minus, Plus, Gift } from 'lucide-react';
import { sendOrderPlacedNotification } from '../../utils/notifications';

interface Product {
  id: string;
  name: string;
  product_type: string;
  pv_value: number;
  description: string;
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

function getPromoBonusInfo(promo: ActivePromotion, quantity: number) {
  if (quantity < promo.buy_quantity) return { freeItems: 0, paidQuantity: quantity };
  const sets = Math.floor(quantity / promo.buy_quantity);
  const freeItems = sets * promo.free_quantity;
  return { freeItems, paidQuantity: quantity };
}

export default function Shop() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [promotions, setPromotions] = useState<Record<string, ActivePromotion>>({});
  const [inventory, setInventory] = useState<Record<string, InventoryInfo>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [lifeChangerCode, setLifeChangerCode] = useState('');
  const [codeValidation, setCodeValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [productsRes, profileRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('product_type', { ascending: true }),
        supabase.from('profiles').select('*, countries(currency_code, currency_symbol)').eq('id', user?.id).single()
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);
      }

      if (profileRes.data) {
        setProfile(profileRes.data);

        const region = profileRes.data.region || profileRes.data.country_code;
        if (region) {
          const [pricesRes, promosRes, inventoryRes] = await Promise.all([
            supabase
              .from('product_prices')
              .select('product_id, price')
              .eq('country_code', profileRes.data.country_code),
            supabase
              .from('product_promotions')
              .select('id, product_id, title, buy_quantity, free_quantity, country_code')
              .eq('is_active', true)
              .lte('starts_at', new Date().toISOString())
              .gt('ends_at', new Date().toISOString()),
            supabase
              .from('product_inventory')
              .select('product_id, quantity, reserved_quantity, low_stock_threshold')
              .eq('region', region),
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
              if (!p.country_code || p.country_code === profileRes.data.country_code) {
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
    setLifeChangerCode('');
    setCodeValidation(null);
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
        text: `${qty}x ${product.name} added to cart!`
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to add to cart' });
    } finally {
      setAddingToCart(null);
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

  async function handlePlaceOrder() {
    if (!profile || !selectedProduct) return;

    const originalPrice = prices[selectedProduct.id];
    if (!originalPrice) {
      setMessage({ type: 'error', text: 'Price not available for your country' });
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
      const region = profile.region || profile.country_code;
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('product_inventory')
        .select('quantity, reserved_quantity')
        .eq('product_id', selectedProduct.id)
        .eq('region', region)
        .single();

      if (inventoryError || !inventoryData) {
        throw new Error('Product not available in your country');
      }

      const availableStock = inventoryData.quantity - inventoryData.reserved_quantity;
      if (availableStock < totalQuantity) {
        throw new Error(`Only ${availableStock} units available (need ${totalQuantity} including ${freeItems} free)`);
      }

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
          currency_code: profile.countries?.currency_code || 'USD',
          region,
          status: 'pending',
          life_changer_code: lifeChangerCode.trim().toUpperCase() || null,
          items_count: 1,
        })
        .select()
        .single();

      if (orderError || !orderData) throw orderError || new Error('Failed to create order');

      await supabase.from('order_items').insert({
        order_id: orderData.id,
        product_id: selectedProduct.id,
        quantity: orderQuantity,
        free_quantity: freeItems,
        unit_price: originalPrice,
        subtotal: totalPrice,
        pv_value: selectedProduct.pv_value,
        promotion_id: promo?.id || null,
      });

      await supabase
        .from('product_inventory')
        .update({
          reserved_quantity: inventoryData.reserved_quantity + totalQuantity,
        })
        .eq('product_id', selectedProduct.id)
        .eq('region', region);

      await supabase
        .from('inventory_logs')
        .insert({
          product_id: selectedProduct.id,
          region,
          action: 'reservation',
          quantity_change: -totalQuantity,
          quantity_after: inventoryData.quantity,
          performed_by: user?.id,
          notes: `Order ${orderNumber} - pending approval${freeItems > 0 ? ` (includes ${freeItems} free)` : ''}`,
        });

      await sendOrderPlacedNotification({
        orderNumber,
        productName: selectedProduct.name,
        quantity: totalQuantity,
        totalAmount: formatCurrency(totalPrice, profile.countries?.currency_code || 'USD'),
        userName: profile.full_name || user?.email || 'Customer',
        userEmail: user?.email || '',
      });

      setShowOrderModal(false);
      setSelectedProduct(null);
      setMessage({
        type: 'success',
        text: `Order placed successfully! Order #${orderNumber} is pending approval.${freeItems > 0 ? ` (${freeItems} free items included!)` : ''}`
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Order error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to place order' });
    } finally {
      setPurchasing(null);
    }
  }

  const productTypes = ['All', ...new Set(products.map(p => p.product_type))];
  const filteredProducts = selectedType === 'All'
    ? products
    : products.filter(p => p.product_type === selectedType);

  const getStockStatus = (productId: string) => {
    const inv = inventory[productId];
    if (!inv) return { available: 0, status: 'unavailable', text: 'Not available', color: 'text-gray-500', bg: 'bg-gray-100' };
    const available = inv.quantity - inv.reserved_quantity;
    if (available <= 0) return { available: 0, status: 'out', text: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-100' };
    if (available <= inv.low_stock_threshold) return { available, status: 'low', text: `Only ${available} left`, color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { available, status: 'in', text: 'In Stock', color: 'text-green-600', bg: 'bg-green-100' };
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  const currencyCode = profile?.countries?.currency_code || 'USD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600" />
            Shop
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Purchase products and earn PV points</p>
        </div>
        {profile && (
          <div className="text-left sm:text-right bg-green-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none">
            <div className="text-xs sm:text-sm text-gray-600">Wallet Balance</div>
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {formatCurrency(profile.balance, currencyCode)}
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

      <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 -mx-1 px-1">
        {productTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap flex-shrink-0 ${
              selectedType === type
                ? 'bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredProducts.map(product => {
          const originalPrice = prices[product.id];
          const promo = promotions[product.id];
          const cardQty = getCardQty(product.id);
          const { freeItems } = promo ? getPromoBonusInfo(promo, cardQty) : { freeItems: 0 };
          const stock = getStockStatus(product.id);
          const isAvailable = stock.status === 'in' || stock.status === 'low';

          return (
            <div key={product.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow relative ${!isAvailable ? 'opacity-75' : ''}`}>
              {promo && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-red-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                  <Gift className="w-3 h-3" />
                  Buy {promo.buy_quantity} Get {promo.free_quantity} Free
                </div>
              )}

              {product.image_url && (
                <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-orange-600 text-white px-2 py-1 rounded-lg text-xs font-bold">
                    {product.pv_value} PV
                  </div>
                  <div className={`absolute bottom-2 right-2 ${stock.bg} ${stock.color} px-2 py-1 rounded-lg text-xs font-semibold`}>
                    {stock.text}
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand-600 hidden sm:block" />
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded">
                      {product.product_type}
                    </span>
                  </div>
                  {!product.image_url && (
                    <span className={`text-xs font-semibold ${stock.bg} ${stock.color} px-2 py-1 rounded`}>
                      {stock.text}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2">{product.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>

                {promo && (
                  <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs font-semibold text-red-700">
                      {promo.title || `Buy ${promo.buy_quantity} Get ${promo.free_quantity} Free`}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <div className="mb-3">
                    {originalPrice ? (
                      <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {formatCurrency(originalPrice, currencyCode)}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Price not set</div>
                    )}
                  </div>

                  {isAvailable && originalPrice && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCardQty(product.id, cardQty - 1, stock.available)}
                          disabled={cardQty <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={stock.available}
                          value={cardQty}
                          onChange={(e) => setCardQty(product.id, parseInt(e.target.value) || 1, stock.available)}
                          className="w-14 h-8 text-center text-sm font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => setCardQty(product.id, cardQty + 1, stock.available)}
                          disabled={cardQty >= stock.available}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        {cardQty > 1 && originalPrice && (
                          <span className="ml-2 text-xs text-gray-500 font-medium">
                            = {formatCurrency(originalPrice * cardQty, currencyCode)}
                          </span>
                        )}
                      </div>
                      {promo && cardQty < promo.buy_quantity && (
                        <p className="text-xs text-amber-600 font-medium mt-1.5">
                          Add {promo.buy_quantity - cardQty} more to get {promo.free_quantity} free!
                        </p>
                      )}
                      {freeItems > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          +{freeItems} free item{freeItems > 1 ? 's' : ''} included!
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!originalPrice || !isAvailable || addingToCart === product.id}
                      className={`flex-1 px-3 py-2.5 sm:py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
                        originalPrice && isAvailable && addingToCart !== product.id
                          ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {addingToCart === product.id ? 'Adding...' : 'Add to Cart'}
                    </button>
                    <button
                      onClick={() => openOrderModal(product)}
                      disabled={!originalPrice || !isAvailable || purchasing === product.id}
                      className={`flex-1 px-3 py-2.5 sm:py-2 rounded-lg font-medium transition-colors text-sm ${
                        originalPrice && isAvailable && purchasing !== product.id
                          ? 'bg-brand-700 text-white hover:bg-brand-800'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {purchasing === product.id ? 'Processing...' : stock.status === 'out' ? 'Out of Stock' : 'Order Now'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No products available in this category</p>
        </div>
      )}

      {showOrderModal && selectedProduct && (
        <OrderModal
          product={selectedProduct}
          originalPrice={prices[selectedProduct.id]}
          promo={promotions[selectedProduct.id]}
          currencyCode={currencyCode}
          quantity={orderQuantity}
          onQuantityChange={setOrderQuantity}
          lifeChangerCode={lifeChangerCode}
          onCodeChange={(code) => {
            setLifeChangerCode(code);
            if (code.trim()) {
              validateLifeChangerCode(code);
            } else {
              setCodeValidation(null);
            }
          }}
          codeValidation={codeValidation}
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
  currencyCode,
  quantity,
  onQuantityChange,
  lifeChangerCode,
  onCodeChange,
  codeValidation,
  purchasing,
  onPlaceOrder,
  onClose,
}: {
  product: Product;
  originalPrice: number;
  promo?: ActivePromotion;
  currencyCode: string;
  quantity: number;
  onQuantityChange: (q: number) => void;
  lifeChangerCode: string;
  onCodeChange: (code: string) => void;
  codeValidation: { valid: boolean; message: string } | null;
  purchasing: boolean;
  onPlaceOrder: () => void;
  onClose: () => void;
}) {
  const { freeItems } = promo
    ? getPromoBonusInfo(promo, quantity)
    : { freeItems: 0 };
  const totalPrice = originalPrice * quantity;
  const totalPV = product.pv_value * (quantity + freeItems);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Place Order</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-lg">{product.name}</h4>
            <p className="text-sm text-gray-600">{product.product_type}</p>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-20 h-20 object-cover rounded"
              />
            )}
            <div>
              <div className="text-sm text-gray-600">Unit Price</div>
              <div className="text-xl font-bold">
                {formatCurrency(originalPrice, currencyCode)}
              </div>
              <div className="text-sm text-orange-600 font-medium">{product.pv_value} PV per unit</div>
            </div>
          </div>

          {promo && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
              <Gift className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                {promo.title || `Buy ${promo.buy_quantity} Get ${promo.free_quantity} Free`}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {promo && quantity < promo.buy_quantity && (
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">
                Add {promo.buy_quantity - quantity} more to get {promo.free_quantity} free!
              </p>
            </div>
          )}

          {freeItems > 0 && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                <Gift className="w-4 h-4" />
                +{freeItems} free item{freeItems > 1 ? 's' : ''} included! (Total: {quantity + freeItems})
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Life Changer Code (Optional)
            </label>
            <input
              type="text"
              value={lifeChangerCode}
              onChange={(e) => onCodeChange(e.target.value)}
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
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-bold text-lg">
                {formatCurrency(totalPrice, currencyCode)}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Total PV:</span>
              <span className="font-bold text-orange-600">
                {totalPV} PV
              </span>
            </div>
            {freeItems > 0 && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Free items:</span>
                <span className="font-bold text-green-600">
                  +{freeItems}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Your order will be pending until approved by the stockist.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onPlaceOrder}
              disabled={purchasing}
              className="flex-1 bg-brand-700 text-white py-3 rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400"
            >
              {purchasing ? 'Processing...' : 'Place Order'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
