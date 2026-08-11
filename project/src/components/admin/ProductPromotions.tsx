import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName } from '../../utils/productLocale';
import { Tag, Plus, Trash2, CreditCard as Edit2, Save, Package, Ban } from 'lucide-react';
import { sendPromotionNotification } from '../../utils/notifications';

interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
}

interface Promotion {
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
  product?: Product;
}

export default function ProductPromotions() {
  const toast = useToast();
  const { language } = useLanguage();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    product_id: '',
    title: '',
    buy_quantity: 3,
    free_quantity: 1,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [promoRes, productsRes] = await Promise.all([
      supabase
        .from('product_promotions')
        .select('*, product:products(id, name, name_en, product_type)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, name_en, product_type').eq('is_active', true).order('name'),
    ]);

    if (promoRes.data) setPromotions(promoRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      product_id: '',
      title: '',
      buy_quantity: 3,
      free_quantity: 1,
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      is_active: true,
    });
  };

  const handleAdd = async () => {
    if (!form.product_id || form.buy_quantity < 1 || form.free_quantity < 1) {
      toast.warning('Please fill in all required fields. Buy and free quantities must be at least 1.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('product_promotions').insert({
      product_id: form.product_id,
      title: form.title || `Buy ${form.buy_quantity} Get ${form.free_quantity} Free`,
      buy_quantity: form.buy_quantity,
      free_quantity: form.free_quantity,
      country_code: null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      is_active: form.is_active,
      created_by: userData.user?.id,
    });

    if (error) {
      toast.error('Failed to create promotion');
      return;
    }

    const productName = products.find((product) => product.id === form.product_id)?.name || 'Selected product';

    sendPromotionNotification({
      productName,
      title: form.title || `Buy ${form.buy_quantity} Get ${form.free_quantity} Free`,
      buyQuantity: form.buy_quantity,
      freeQuantity: form.free_quantity,
      startsAt: new Date(form.starts_at).toISOString(),
      endsAt: new Date(form.ends_at).toISOString(),
    }).catch((notifyError) => console.error('Error sending promotion notifications:', notifyError));

    toast.success('Promotion created successfully');
    setShowAdd(false);
    resetForm();
    await loadData();
  };

  const startEdit = (promo: Promotion) => {
    setEditingId(promo.id);
    setForm({
      product_id: promo.product_id,
      title: promo.title,
      buy_quantity: promo.buy_quantity,
      free_quantity: promo.free_quantity,
      starts_at: new Date(promo.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(promo.ends_at).toISOString().slice(0, 16),
      is_active: promo.is_active,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('product_promotions')
      .update({
        product_id: form.product_id,
        title: form.title,
        buy_quantity: form.buy_quantity,
        free_quantity: form.free_quantity,
        country_code: null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        is_active: form.is_active,
      })
      .eq('id', editingId);

    if (error) {
      toast.error('Failed to update promotion');
      return;
    }

    toast.success('Promotion updated successfully');
    setEditingId(null);
    resetForm();
    await loadData();
  };

  const handleCancel = async (id: string) => {
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
    await loadData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('product_promotions').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete promotion');
      return;
    }
    toast.success('Promotion deleted');
    await loadData();
  };

  const isPromoActive = (promo: Promotion) => {
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Promotions</h2>
          <p className="text-gray-600 mt-1">Create "Buy X Get Y Free" deals for products</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Promotion
        </button>
      </div>

      {(showAdd || editingId) && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Promotion' : 'Create Promotion'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{getLocalizedProductName(p, language)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Buy 3 Get 1 Free"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buy Quantity</label>
              <input
                type="number"
                min="1"
                value={form.buy_quantity}
                onChange={(e) => setForm({ ...form, buy_quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <p className="text-xs text-gray-500 mt-1">Customer must buy this many</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Free Quantity</label>
              <input
                type="number"
                min="0"
                value={form.free_quantity}
                onChange={(e) => setForm({ ...form, free_quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <p className="text-xs text-gray-500 mt-1">They get this many for free</p>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="promo-active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
              />
              <label htmlFor="promo-active" className="text-sm font-medium text-gray-700">Active</label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ends At</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>

          {form.buy_quantity > 0 && form.free_quantity > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                Preview: Buy {form.buy_quantity}, get {form.free_quantity} free
                (customer pays for {form.buy_quantity}, receives {form.buy_quantity + form.free_quantity} total)
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={editingId ? handleUpdate : handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 font-medium"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Save Changes' : 'Create Promotion'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {promotions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No promotions yet</h3>
          <p className="text-gray-500">Create your first "Buy X Get Y Free" deal</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {promotions.map((promo) => {
            const active = isPromoActive(promo);
            const expired = new Date(promo.ends_at) < new Date();

            return (
              <div
                key={promo.id}
                className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                  active ? 'border-green-200' : expired ? 'border-gray-200 opacity-70' : 'border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${active ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Package className={`w-5 h-5 ${active ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{promo.product ? getLocalizedProductName(promo.product, language) : 'Unknown Product'}</h4>
                      <p className="text-sm text-gray-500">{promo.product?.product_type}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    active ? 'bg-green-100 text-green-700' :
                    expired ? 'bg-gray-100 text-gray-500' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {active ? 'Active' : expired ? 'Expired' : 'Inactive'}
                  </span>
                </div>

                <div className="bg-brand-50 rounded-lg p-3 mb-3">
                  <p className="text-sm font-bold text-brand-800">
                    {promo.title || `Buy ${promo.buy_quantity} Get ${promo.free_quantity} Free`}
                  </p>
                  <p className="text-xs text-brand-600 mt-1">
                    Pay for {promo.buy_quantity}, receive {promo.buy_quantity + promo.free_quantity} total
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                  <div>
                    <span className="font-medium">Starts:</span>{' '}
                    {new Date(promo.starts_at).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Ends:</span>{' '}
                    {new Date(promo.ends_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => startEdit(promo)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {active && (
                    <button
                      onClick={() => handleCancel(promo.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(promo.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
