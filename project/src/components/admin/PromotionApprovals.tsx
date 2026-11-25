import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName, getLocalizedProductType } from '../../utils/productLocale';
import { getPromoBuyGetFreeText, getPromoLabel } from '../../utils/promoLocale';
import { sendPromotionNotification } from '../../utils/notifications';
import { toLocalInput } from '../../utils/datetime';
import { Tag, Plus, Calendar, Trash2, Ban, Package, X, Power, CheckCircle2, Pencil } from 'lucide-react';
import { getCountryName, loadCountryNames } from '../../utils/countries';
import { SectionSkeleton } from '../SectionSkeleton';

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
  product?: { name: string; name_en?: string | null; product_type: string; product_type_en?: string | null; image_url: string | null };
  country?: { name: string } | null;
}

interface ProductOption {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
  product_type_en?: string | null;
}

interface CountryOption {
  code: string;
  name: string;
}

export function PromotionApprovals() {
  const toast = useToast();
  const { language, t } = useLanguage();
  const [productPromotions, setProductPromotions] = useState<ProductPromotion[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryMap, setCountryMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    product_id: '',
    title: '',
    buy_quantity: 3,
    free_quantity: 1,
    country_code: '',
    starts_at: toLocalInput(new Date()),
    ends_at: toLocalInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
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
      .select('*, product:products(name, name_en, product_type, product_type_en, image_url), country:countries(name)')
      .order('created_at', { ascending: false });

    if (data) setProductPromotions(data);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, name_en, product_type, product_type_en')
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
      toast.warning(t('promo.pleaseAllFieldsSimple'));
      return;
    }

    if (new Date(formData.ends_at) <= new Date(formData.starts_at)) {
      toast.warning(t('promo.endAfterStart'));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      const { error: updateError } = await supabase
        .from('product_promotions')
        .update({
          product_id: formData.product_id,
          title: formData.title.trim(),
          buy_quantity: formData.buy_quantity,
          free_quantity: formData.free_quantity,
          country_code: formData.country_code || null,
          starts_at: new Date(formData.starts_at).toISOString(),
          ends_at: new Date(formData.ends_at).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (updateError) {
        toast.error(t('promo.failedUpdate'));
        return;
      }
      toast.success(t('promo.updated'));
      closeForm();
      fetchProductPromotions();
      return;
    }

    const { error } = await supabase.from('product_promotions').insert({
      product_id: formData.product_id,
      title: formData.title.trim(),
      buy_quantity: formData.buy_quantity,
      free_quantity: formData.free_quantity,
      country_code: formData.country_code || null,
      starts_at: new Date(formData.starts_at).toISOString(),
      ends_at: new Date(formData.ends_at).toISOString(),
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      toast.error(t('promo.failedCreate'));
      return;
    }

    notifyPromotion({
      product_id: formData.product_id,
      title: formData.title.trim(),
      buy_quantity: formData.buy_quantity,
      free_quantity: formData.free_quantity,
      starts_at: new Date(formData.starts_at).toISOString(),
      ends_at: new Date(formData.ends_at).toISOString(),
    });

    toast.success(t('promo.created'));
    closeForm();
    fetchProductPromotions();
  };

  const emptyForm = () => ({
    product_id: '',
    title: '',
    buy_quantity: 3,
    free_quantity: 1,
    country_code: '',
    starts_at: toLocalInput(new Date()),
    ends_at: toLocalInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  });

  const closeForm = () => {
    setShowAddModal(false);
    setEditingId(null);
    setFormData(emptyForm());
  };

  const openEdit = (promo: ProductPromotion) => {
    setEditingId(promo.id);
    setFormData({
      product_id: promo.product_id,
      title: promo.title || '',
      buy_quantity: promo.buy_quantity,
      free_quantity: promo.free_quantity,
      country_code: promo.country_code || '',
      starts_at: toLocalInput(new Date(promo.starts_at)),
      ends_at: toLocalInput(new Date(promo.ends_at)),
    });
    setShowAddModal(true);
  };

  const notifyPromotion = (p: { product_id: string; title: string; buy_quantity: number; free_quantity: number; starts_at: string; ends_at: string }) => {
    const product = products.find((pr) => pr.id === p.product_id) ||
      productPromotions.find((pr) => pr.product_id === p.product_id)?.product;
    sendPromotionNotification({
      productName: product ? getLocalizedProductName(product, language) : t('promo.selectedProductFallback'),
      title: getPromoLabel({ title: p.title, buy_quantity: p.buy_quantity, free_quantity: p.free_quantity }, language),
      buyQuantity: p.buy_quantity,
      freeQuantity: p.free_quantity,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
    }).catch((err) => console.error('Error sending promotion notifications:', err));
  };

  const toggleProductPromotion = async (id: string, currentActive: boolean) => {
    const promo = productPromotions.find((p) => p.id === id);
    if (!currentActive && promo && new Date(promo.ends_at) <= new Date()) {
      toast.warning(t('promo.expiredEditDates'));
      return;
    }
    const { error } = await supabase
      .from('product_promotions')
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(t('promo.failedUpdate'));
      return;
    }
    if (!currentActive && promo) notifyPromotion(promo);
    toast.success(currentActive ? t('promo.paused') : t('promo.activatedToast'));
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
      toast.error(t('promo.failedCancel'));
      return;
    }
    toast.success(t('promo.cancelled'));
    fetchProductPromotions();
  };

  const deleteProductPromotion = async (id: string) => {
    const { error } = await supabase
      .from('product_promotions')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(t('promo.failedDelete'));
      return;
    }
    toast.success(t('promo.deleted'));
    fetchProductPromotions();
  };

  const isPromotionActive = (promo: ProductPromotion) => {
    const now = new Date();
    return promo.is_active && new Date(promo.starts_at) <= now && new Date(promo.ends_at) > now;
  };

  if (loading) {
    return <SectionSkeleton variant="list" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('promo.pageTitle')}</h2>
        <p className="text-slate-600 mt-1">{t('promo.manageDeals')}</p>
      </div>

      <ProductPromotionsSection
        promotions={productPromotions}
        countryMap={countryMap}
        onAdd={() => { setEditingId(null); setFormData(emptyForm()); setShowAddModal(true); }}
        onEdit={openEdit}
        onToggle={toggleProductPromotion}
        onCancel={cancelProductPromotion}
        onDelete={deleteProductPromotion}
        isActive={isPromotionActive}
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900">{editingId ? t('admin.editPromotion') : t('promo.newProductPromotionTitle')}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddProductPromotion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.product')}</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">{t('inv.selectProduct')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{getLocalizedProductName(p, language)} ({getLocalizedProductType(p, language)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.promotionTitle')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('promo.titlePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.buyQuantity')}</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.freeQuantity')}</label>
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
                    {t('promo.previewText', { buy: formData.buy_quantity, free: formData.free_quantity, total: formData.buy_quantity + formData.free_quantity })}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('promo.countryOptional')}
                </label>
                <select
                  value={formData.country_code}
                  onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">{t('promo.allCountriesOption')}</option>
                  {countries.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.startsAt')}</label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('promo.endsAt')}</label>
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
                  {editingId ? t('profile.save') : t('admin.createPromotion')}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
                >
                  {t('common.cancel')}
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
  onEdit,
  onToggle,
  onCancel,
  onDelete,
  isActive,
}: {
  promotions: ProductPromotion[];
  countryMap: Record<string, string>;
  onAdd: () => void;
  onEdit: (promo: ProductPromotion) => void;
  onToggle: (id: string, currentActive: boolean) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  isActive: (promo: ProductPromotion) => boolean;
}) {
  const { t } = useLanguage();
  const activePromos = promotions.filter(p => isActive(p));
  const inactivePromos = promotions.filter(p => !isActive(p));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-gray-600">
          {t('promo.activePromotionsCount', { n: activePromos.length })}
        </p>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg hover:bg-brand-800 font-medium transition"
        >
          <Plus className="w-4 h-4" />
          {t('promo.newPromotion')}
        </button>
      </div>

      {activePromos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('promo.activePromotionsHeading')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {activePromos.map(promo => (
              <PromoRow key={promo.id} promo={promo} countryMap={countryMap} onEdit={onEdit} onToggle={onToggle} onCancel={onCancel} onDelete={onDelete} active />
            ))}
          </div>
        </div>
      )}

      {activePromos.length === 0 && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('promo.noActivePromotions')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('promo.createOneHint')}</p>
        </div>
      )}

      {inactivePromos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('promo.expiredInactiveHeading')}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {inactivePromos.slice(0, 20).map(promo => (
              <PromoRow key={promo.id} promo={promo} countryMap={countryMap} onEdit={onEdit} onToggle={onToggle} onCancel={onCancel} onDelete={onDelete} active={false} />
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
  onEdit,
  onToggle,
  onCancel,
  onDelete,
  active,
}: {
  promo: ProductPromotion;
  countryMap: Record<string, string>;
  onEdit: (promo: ProductPromotion) => void;
  onToggle: (id: string, currentActive: boolean) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  active: boolean;
}) {
  const { language, t } = useLanguage();
  const expired = new Date(promo.ends_at) <= new Date();
  // is_active=true with a future start date is SCHEDULED, not paused. It used
  // to show "Paused" with an "Activate" button that actually switched it OFF.
  const scheduled = promo.is_active && !expired && new Date(promo.starts_at) > new Date();
  const paused = !promo.is_active && !expired;
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const productName = promo.product ? getLocalizedProductName(promo.product, language) : undefined;

  return (
    <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {promo.product?.image_url && (
        <img loading="lazy" decoding="async"
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
              {t('common.active')}
            </span>
          )}
          {expired && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500">
              {t('admin.expired')}
            </span>
          )}
          {scheduled && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
              {t('promo.scheduled')}
            </span>
          )}
          {paused && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
              {t('promo.pausedBadge')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            {getPromoBuyGetFreeText(promo.buy_quantity, promo.free_quantity, language)}
          </span>
          {promo.title && (
            <>
              <span className="text-gray-400">|</span>
              <span>{promo.title}</span>
            </>
          )}
          <span className="text-gray-400">|</span>
          <span>{promo.country_code ? getCountryName(promo.country_code, countryMap) : t('promo.allCountriesOption')}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
          <Calendar className="w-3 h-3" />
          {new Date(promo.starts_at).toLocaleDateString()} &mdash; {new Date(promo.ends_at).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        {(active || scheduled) && (
          <>
            <button
              onClick={() => onToggle(promo.id, promo.is_active)}
              aria-pressed="true"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('promo.activeDeactivate')}
            </button>
            {showConfirmCancel ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onCancel(promo.id); setShowConfirmCancel(false); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition bg-red-600 text-white hover:bg-red-700"
                >
                  {t('promo.confirmCancel')}
                </button>
                <button
                  onClick={() => setShowConfirmCancel(false)}
                  className="px-2 py-1.5 text-xs font-medium rounded-lg transition bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  {t('promo.no')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmCancel(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Ban className="w-3.5 h-3.5" />
                {t('common.cancel')}
              </button>
            )}
          </>
        )}
        {paused && (
          <button
            onClick={() => onToggle(promo.id, promo.is_active)}
            aria-pressed="false"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition bg-white text-green-700 border border-green-300 hover:bg-green-50"
          >
            <Power className="w-3.5 h-3.5" />
            {t('promo.activate')}
          </button>
        )}
        <button
          onClick={() => onEdit(promo)}
          className="p-1.5 text-gray-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition"
          title={t('admin.edit')}
          aria-label={t('admin.edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(promo.id)}
          title={t('admin.delete')}
          aria-label={t('admin.delete')}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
