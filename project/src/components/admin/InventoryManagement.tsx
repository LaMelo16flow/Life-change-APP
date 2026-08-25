import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName, getLocalizedProductType } from '../../utils/productLocale';
import { Package, Plus, CreditCard as Edit2, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { maybeAlertLowStock } from '../../utils/notifications';

interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
  product_type_en?: string | null;
  image_url: string | null;
}

interface InventoryItem {
  id: string;
  product_id: string;
  region: string;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  managed_by: string | null;
  product: Product;
}

export default function InventoryManagement() {
  const toast = useToast();
  const { language, t } = useLanguage();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState(100);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [formData, setFormData] = useState({
    product_id: '',
    region: 'CA',
    quantity: 0,
    reserved_quantity: 0,
    low_stock_threshold: 10,
  });

  useEffect(() => {
    loadInventory();
    loadProducts();
  }, []);

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('product_inventory')
        .select(`
          *,
          product:products(id, name, name_en, product_type, product_type_en, image_url)
        `)
        .eq('region', 'CA')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_en, product_type, product_type_en, image_url')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('product_inventory')
        .insert([{
          ...formData,
          managed_by: userData.user?.id,
        }]);

      if (error) throw error;

      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          product_id: formData.product_id,
          region: formData.region,
          action: 'restock',
          quantity_change: formData.quantity,
          quantity_after: formData.quantity,
          performed_by: userData.user?.id,
          notes: 'Initial inventory setup',
        }]);

      if (logError) console.error('Error logging inventory:', logError);

      setShowAddModal(false);
      setFormData({
        product_id: '',
        region: 'CA',
        quantity: 0,
        reserved_quantity: 0,
        low_stock_threshold: 10,
      });
      loadInventory();
      toast.success(t('inv.inventoryAdded'));
    } catch (error) {
      console.error('Error adding inventory:', error);
      toast.error(t('inv.failedAddInventory'));
    }
  };

  const handleUpdateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (formData.quantity - formData.reserved_quantity < 0) {
      toast.error(t('inv.stockReservedError'));
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const quantityChange = formData.quantity - selectedItem.quantity;
      const reservedChange = formData.reserved_quantity - selectedItem.reserved_quantity;

      const { error } = await supabase
        .from('product_inventory')
        .update({
          quantity: formData.quantity,
          reserved_quantity: formData.reserved_quantity,
          low_stock_threshold: formData.low_stock_threshold,
        })
        .eq('id', selectedItem.id);

      if (error) throw error;

      if (quantityChange !== 0) {
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert([{
            product_id: selectedItem.product_id,
            region: selectedItem.region,
            action: quantityChange > 0 ? 'restock' : 'adjustment',
            quantity_change: quantityChange,
            quantity_after: formData.quantity,
            reference_id: selectedItem.id,
            performed_by: userData.user?.id,
            notes: 'Manual inventory adjustment',
          }]);

        if (logError) console.error('Error logging inventory:', logError);
      }

      if (reservedChange !== 0) {
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert([{
            product_id: selectedItem.product_id,
            region: selectedItem.region,
            action: 'adjustment',
            quantity_change: reservedChange,
            quantity_after: formData.reserved_quantity,
            reference_id: selectedItem.id,
            performed_by: userData.user?.id,
            notes: 'Manual reserved-stock correction',
          }]);

        if (logError) console.error('Error logging inventory:', logError);
      }

      const oldAvailable = selectedItem.quantity - selectedItem.reserved_quantity;
      const newAvailable = formData.quantity - formData.reserved_quantity;
      maybeAlertLowStock(
        getLocalizedProductName(selectedItem.product, language),
        selectedItem.region,
        oldAvailable,
        newAvailable,
        formData.low_stock_threshold
      ).catch((err) => console.error('Error sending low stock alert:', err));

      setShowEditModal(false);
      setSelectedItem(null);
      loadInventory();
      toast.success(t('inv.inventoryUpdated'));
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error(t('inv.failedUpdateInventory'));
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      product_id: item.product_id,
      region: item.region,
      quantity: item.quantity,
      reserved_quantity: item.reserved_quantity,
      low_stock_threshold: item.low_stock_threshold,
    });
    setShowEditModal(true);
  };

  const handleBulkUpdate = async () => {
    setBulkUpdating(true);
    try {
      const { error } = await supabase
        .from('product_inventory')
        .update({
          quantity: bulkQuantity,
        })
        .eq('region', 'CA');

      if (error) throw error;

      toast.success(t('inv.stockUpdatedToAll', { n: bulkQuantity }));
      setShowBulkModal(false);
      loadInventory();
    } catch (error) {
      console.error('Error bulk updating inventory:', error);
      toast.error(t('inv.failedUpdateInventory'));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleInitializeAllStock = async () => {
    setBulkUpdating(true);
    try {
      const { data: activeProducts, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('is_active', true);

      if (productsError) throw productsError;

      const inserts = (activeProducts || []).map((product) => ({
        product_id: product.id,
        region: 'CA',
        quantity: bulkQuantity,
        low_stock_threshold: 10,
      }));

      const batchSize = 500;
      for (let i = 0; i < inserts.length; i += batchSize) {
        const batch = inserts.slice(i, i + batchSize);
        const { error } = await supabase
          .from('product_inventory')
          .upsert(batch, { onConflict: 'product_id,region' });
        if (error) throw error;
      }

      toast.success(t('inv.initializedRecords', { n: inserts.length, qty: bulkQuantity }));
      setShowBulkModal(false);
      loadInventory();
    } catch (error) {
      console.error('Error initializing stock:', error);
      toast.error(t('inv.failedInitializeStock'));
    } finally {
      setBulkUpdating(false);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const term = searchTerm.toLowerCase();
    return item.product.name.toLowerCase().includes(term)
      || (item.product.name_en || '').toLowerCase().includes(term);
  });

  const getStockStatus = (item: InventoryItem) => {
    const available = item.quantity - item.reserved_quantity;
    if (available <= 0) return { text: t('shop.outOfStock'), color: 'text-red-600', bg: 'bg-red-100' };
    if (available <= item.low_stock_threshold) return { text: t('inv.lowStock'), color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: t('common.inStock'), color: 'text-green-600', bg: 'bg-green-100' };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{t('admin.loadingInventory')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('inv.title')}</h2>
          <p className="text-gray-600">{t('inv.subtitle')}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            <RefreshCw size={20} />
            {t('inv.setDefaultStock')}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg hover:bg-brand-800"
          >
            <Plus size={20} />
            {t('inv.addInventory')}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('inv.searchProducts')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {filteredInventory.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">{t('inv.noItemsFound')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv.product')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv.available')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inv.reserved')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.map((item) => {
                const available = item.quantity - item.reserved_quantity;
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.product.image_url && (
                          <img
                            src={item.product.image_url}
                            alt={getLocalizedProductName(item.product, language)}
                            className="w-10 h-10 rounded object-cover mr-3"
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{getLocalizedProductName(item.product, language)}</div>
                          <div className="text-sm text-gray-500">{getLocalizedProductType(item.product, language)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {available}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.reserved_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${status.bg} ${status.color}`}>
                        {status.text}
                      </span>
                      {available <= item.low_stock_threshold && available > 0 && (
                        <AlertTriangle size={16} className="inline ml-2 text-yellow-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                      >
                        <Edit2 size={16} />
                        {t('admin.edit')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredInventory.length > 0 && (
        <div className="md:hidden space-y-3">
          {filteredInventory.map((item) => {
            const available = item.quantity - item.reserved_quantity;
            const status = getStockStatus(item);
            return (
              <div key={item.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {item.product.image_url && (
                    <img
                      src={item.product.image_url}
                      alt={getLocalizedProductName(item.product, language)}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{getLocalizedProductName(item.product, language)}</div>
                    <div className="text-sm text-gray-500 truncate">{getLocalizedProductType(item.product, language)}</div>
                  </div>
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 text-sm font-medium flex-shrink-0"
                  >
                    <Edit2 size={16} />
                    {t('admin.edit')}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-100 pt-3">
                  <div>
                    <div className="text-xs text-gray-500">{t('inv.available')}</div>
                    <div className="text-gray-900">{available}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{t('inv.reserved')}</div>
                    <div className="text-gray-600">{item.reserved_quantity}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${status.bg} ${status.color}`}>
                    {status.text}
                  </span>
                  {available <= item.low_stock_threshold && available > 0 && (
                    <AlertTriangle size={16} className="text-yellow-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{t('inv.addProductInventoryTitle')}</h3>
            <form onSubmit={handleAddInventory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.product')}</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">{t('inv.selectProduct')}</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {getLocalizedProductName(product, language)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.stockAvailable')}</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.lowStockThreshold')}</label>
                <input
                  type="number"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium"
                >
                  {t('inv.addInventory')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-1">{t('inv.refreshStock')}</h3>
            <p className="text-sm text-gray-500 mb-4">{getLocalizedProductName(selectedItem.product, language)}</p>
            <form onSubmit={handleUpdateInventory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.stockAvailable')}</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">{t('inv.reservedHeldByOrders')}</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, reserved_quantity: 0 })}
                    className="text-xs font-medium text-brand-600 hover:text-brand-800"
                  >
                    {t('inv.resetToZero')}
                  </button>
                </div>
                <input
                  type="number"
                  value={formData.reserved_quantity}
                  onChange={(e) => setFormData({ ...formData, reserved_quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('inv.reservedHint')}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{t('inv.availableForSale')}</span>
                <span className={`text-lg font-bold ${formData.quantity - formData.reserved_quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formData.quantity - formData.reserved_quantity}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.lowStockThreshold')}</label>
                <input
                  type="number"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium"
                >
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">{t('inv.setDefaultStock')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('inv.updateAcrossProducts')}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inv.stockAvailable')}</label>
                <input
                  type="number"
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>{t('mgr.warningLabel')}</strong> {t('inv.overwriteWarning')}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdating}
                  className="w-full bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bulkUpdating ? t('inv.updating') : t('inv.updateExistingStock')}
                </button>
                <button
                  onClick={handleInitializeAllStock}
                  disabled={bulkUpdating}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bulkUpdating ? t('inv.initializing') : t('inv.initializeAllProducts')}
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  disabled={bulkUpdating}
                  className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
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
