import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName } from '../../utils/productLocale';
import { Tag, Plus, Calendar, Trash2, Ban, Package, X } from 'lucide-react';
import { getCountryName, loadCountryNames } from '../../utils/countries';

interface ProductPromotion {
  id: string;
  product_id: string;
  title: string;
  buy_quantity: number;
  free_quantity: number;
  country_code: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  product?: { name: string; name_en?: string | null; product_type: string; image_url: string | null };
  country?: { name: string } | null;
}

interface ProductOption {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
}

interface CountryOption {
  code: string;
  name: string;
}

export function PromotionApprovals() {
  const toast = useToast();
  const { language } = useLanguage();
  const [productPromotions, setProductPromotions] = useState<ProductPromotion[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryMap, setCountryMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    title: '',
    buy_quantity: 3,
    free_quantity: 1,
    country_code: '',
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  });

  useEffect(() => {
    fetchProductPromotions();
    fetchProducts();
    fetchCountries();
    loadCountryNames().then(setCountryMap);
  }, []);

  const fetchProductPromotions = async () => {
    const { data } = await supabase
      .from('product_promotions')
      .select('*, product:products(name, name_en, product_type, image_url), country:countries(name)')
      .order('created_at', { ascending: false });

    if (data) setProductPromotions(data);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, name_en, product_type')
      .eq('is_active', true)
      .order('name');
    if (data) setProducts(data);
  };

  const fetchCountries = async () => {
    const { data } = await supabase
      .from('countries')
      .select('code, name')
      .eq('is_active', true)
      .order('name');
    if (data) setCountries(data);
  };

  const handleAddProductPromotion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_id || formData.buy_quantity < 1 || formData.free_quantity < 1) {
      toast.warning('Please fill in all required fields.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('product_promotions').insert({
      product_id: formData.product_id,
      title: formData.title || `Buy ${formData.buy_quantity} Get ${formData.free_quantity} Free`,
      buy_quantity: formData.buy_quantity,
      free_quantity: formData.free_quantity,
      country_code: formData.country_code || null,
      starts_at: new Date(formData.starts_at).toISOString(),
      ends_at: new Date(formData.ends_at).toISOString(),
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      toast.error('Failed to create promotion');
      return;
    }

    toast.success('Promotion created successfully');
    setShowAddModal(false);
    setFormData({
      product_id: '',
      title: '',
      buy_quantity: 3,
      free_quantity: 1,
      country_code: '',
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    });
    fetchProductPromotions();
  };

  const toggleProductPromotion = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('product_promotions')
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update promotion');
      return;
    }
    toast.success(currentActive ? 'Promotion paused' : 'Promotion activated');
    fetchProductPromotions();
  };

  const cancelProductPromotion = async (id: string) => {
    const { error } = await supabase
      .from('product_promotions')
      .update({
        is_active: false,
        ends_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to cancel promotion');
      return;
    }
    toast.success('Promotion cancelled and ended');
    fetchProductPromotions();
  };

  const deleteProductPromotion = async (id: string) => {
    const { error } = await supabase
      .from('product_promotions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete promotion');
      return;
    }
    toast.success('Promotion deleted');
    fetchProductPromotions();
  };

  const isPromotionActive = (promo: ProductPromotion) => {
    const now = new Date();
    return promo.is_active && new Date(promo.starts_at) <= now && new Date(promo.ends_at) > now;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Promotions</h2>
        <p className="text-slate-600 mt-1">Manage product deals</p>
      </div>

      <ProductPromotionsSection
        promotions={productPromotions}
        countryMap={countryMap}
        onAdd={() => setShowAddModal(true)}
        onToggle={toggleProductPromotion}
        onCancel={cancelProductPromotion}
        onDelete={deleteProductPromotion}
        isActive={isPromotionActive}
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900">New Product Promotion</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddProductPromotion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Select a product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{getLocalizedProductName(p, language)} ({p.product_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Buy 3 Get 1 Free"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buy Quantity</label>
                  <input
                    type="number"
                    value={formData.buy_quantity}
                    onChange={(e) => setFormData({ ...formData, buy_quantity: parseInt(e.target.value) || 1 })}
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Free Quantity</label>
                  <input
                    type="number"
                    value={formData.free_quantity}
                    onChange={(e) => setFormData({ ...formData, free_quantity: parseInt(e.target.value) || 0 })}
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              {formData.buy_quantity > 0 && formData.free_quantity > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">
                    Preview: Buy {formData.buy_quantity}, get {formData.free_quantity} free
                    (customer pays for {formData.buy_quantity}, receives {formData.buy_quantity + formData.free_quantity} total)
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country (leave empty for all countries)
                </label>
                <select
                  value={formData.country_code}
                  onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">All Countries</option>
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ends At</label>
                  <input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-700 text-white py-2.5 rounded-lg hover:bg-brand-800 font-medium"
                >
                  Create Promotion
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductPromotionsSection({
  promotions,
  countryMap,
  onAdd,
  onToggle,
  onCancel,
  onDelete,
  isActive,
}: {
  promotions: ProductPromotion[];
  countryMap: Record<string, string>;
  onAdd: () => void;
  onToggle: (id: string, currentActive: boolean) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  isActive: (promo: ProductPromotion) => boolean;
}) {
  const activePromos = promotions.filter(p => isActive(p));
  const inactivePromos = promotions.filter(p => !isActive(p));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-gray-600">
          {activePromos.length} active promotion{activePromos.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg hover:bg-brand-800 font-medium transition"
        >
          <Plus className="w-4 h-4" />
          New Promotion
        </button>
      </div>

      {activePromos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Active Promotions</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {activePromos.map(promo => (
              <PromoRow key={promo.id} promo={promo} countryMap={countryMap} onToggle={onToggle} onCancel={onCancel} onDelete={onDelete} active />
            ))}
          </div>
        </div>
      )}

      {activePromos.length === 0 && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No active product promotions</p>
          <p className="text-sm text-gray-400 mt-1">Create one to offer deals in the shop</p>
        </div>
      )}

      {inactivePromos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Expired / Inactive Promotions</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {inactivePromos.slice(0, 20).map(promo => (
              <PromoRow key={promo.id} promo={promo} countryMap={countryMap} onToggle={onToggle} onCancel={onCancel} onDelete={onDelete} active={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PromoRow({
  promo,
  countryMap,
  onToggle,
  onCancel,
  onDelete,
  active,
}: {
  promo: ProductPromotion;
  countryMap: Record<string, string>;
  onToggle: (id: string, currentActive: boolean) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  active: boolean;
}) {
  const { language } = useLanguage();
  const expired = new Date(promo.ends_at) <= new Date();
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const productName = promo.product ? getLocalizedProductName(promo.product, language) : undefined;

  return (
    <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {promo.product?.image_url && (
        <img
          src={promo.product.image_url}
          alt={productName}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-gray-900 truncate">{productName}</p>
          {active && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
              Active
            </span>
          )}
          {expired && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500">
              Expired
            </span>
          )}
          {!active && !expired && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
              Paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            Buy {promo.buy_quantity}, Get {promo.free_quantity} Free
          </span>
          {promo.title && (
            <>
              <span className="text-gray-400">|</span>
              <span>{promo.title}</span>
            </>
          )}
          <span className="text-gray-400">|</span>
          <span>{promo.country_code ? getCountryName(promo.country_code, countryMap) : 'All Countries'}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
          <Calendar className="w-3 h-3" />
          {new Date(promo.starts_at).toLocaleDateString()} &mdash; {new Date(promo.ends_at).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        {active && (
          <>
            <button
              onClick={() => onToggle(promo.id, promo.is_active)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            >
              Pause
            </button>
            {showConfirmCancel ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onCancel(promo.id); setShowConfirmCancel(false); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition bg-red-600 text-white hover:bg-red-700"
                >
                  Confirm Cancel
                </button>
                <button
                  onClick={() => setShowConfirmCancel(false)}
                  className="px-2 py-1.5 text-xs font-medium rounded-lg transition bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmCancel(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}
          </>
        )}
        {!active && !expired && (
          <button
            onClick={() => onToggle(promo.id, promo.is_active)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition bg-green-100 text-green-700 hover:bg-green-200"
          >
            Activate
          </button>
        )}
        <button
          onClick={() => onDelete(promo.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
