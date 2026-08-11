import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedProductName } from '../../utils/productLocale';
import { Package, Plus, CreditCard as Edit2, AlertTriangle, Search, RefreshCw } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
  image_url: string | null;
}

interface InventoryItem {
  id: string;
  product_id: string;
  region: string;
  quantity: number;
  reserved_quantity: number;
  max_quantity: number;
  low_stock_threshold: number;
  managed_by: string | null;
  product: Product;
}

export default function InventoryManagement() {
  const toast = useToast();
  const { language } = useLanguage();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState(100);
  const [bulkMaxQuantity, setBulkMaxQuantity] = useState(200);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [formData, setFormData] = useState({
    product_id: '',
    region: 'CA',
    quantity: 0,
    max_quantity: 100,
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
          product:products(id, name, name_en, product_type, image_url)
        `)
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
        .select('id, name, name_en, product_type, image_url')
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
        max_quantity: 100,
        low_stock_threshold: 10,
      });
      loadInventory();
      toast.success('Inventory added successfully');
    } catch (error) {
      console.error('Error adding inventory:', error);
      toast.error('Failed to add inventory');
    }
  };

  const handleUpdateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const quantityChange = formData.quantity - selectedItem.quantity;

      const { error } = await supabase
        .from('product_inventory')
        .update({
          quantity: formData.quantity,
          max_quantity: formData.max_quantity,
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

      setShowEditModal(false);
      setSelectedItem(null);
      loadInventory();
      toast.success('Inventory updated successfully');
    } catch (error) {
      console.error('Error updating inventory:', error);
      toast.error('Failed to update inventory');
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      product_id: item.product_id,
      region: item.region,
      quantity: item.quantity,
      max_quantity: item.max_quantity,
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
          max_quantity: bulkMaxQuantity,
        })
        .eq('region', 'CA');

      if (error) throw error;

      toast.success(`Stock updated to ${bulkQuantity} for all products`);
      setShowBulkModal(false);
      loadInventory();
    } catch (error) {
      console.error('Error bulk updating inventory:', error);
      toast.error('Failed to update inventory');
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
        max_quantity: bulkMaxQuantity,
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

      toast.success(`Initialized ${inserts.length} inventory records with ${bulkQuantity} stock each`);
      setShowBulkModal(false);
      loadInventory();
    } catch (error) {
      console.error('Error initializing stock:', error);
      toast.error('Failed to initialize stock');
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
    if (available <= 0) return { text: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-100' };
    if (available <= item.low_stock_threshold) return { text: 'Low Stock', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'In Stock', color: 'text-green-600', bg: 'bg-green-100' };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading inventory...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-gray-600">Manage product stock levels</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            <RefreshCw size={20} />
            Set Default Stock
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg hover:bg-brand-800"
          >
            <Plus size={20} />
            Add Inventory
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {filteredInventory.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No inventory items found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Available
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reserved
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Max
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                          <div className="text-sm text-gray-500">{item.product.product_type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {available}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.reserved_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.max_quantity}
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
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Add Product Inventory</h3>
            <form onSubmit={handleAddInventory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Select a product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {getLocalizedProductName(product, language)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
                <input
                  type="number"
                  value={formData.max_quantity}
                  onChange={(e) => setFormData({ ...formData, max_quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Threshold</label>
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
                  Add Inventory
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Update Inventory</h3>
            <form onSubmit={handleUpdateInventory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <input
                  type="text"
                  value={getLocalizedProductName(selectedItem.product, language)}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity (Reserved: {selectedItem.reserved_quantity})
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  min={selectedItem.reserved_quantity}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
                <input
                  type="number"
                  value={formData.max_quantity}
                  onChange={(e) => setFormData({ ...formData, max_quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Threshold</label>
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
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-2">Set Default Stock</h3>
            <p className="text-sm text-gray-600 mb-4">
              Update stock levels across all products.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
                <input
                  type="number"
                  value={bulkMaxQuantity}
                  onChange={(e) => setBulkMaxQuantity(parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This will overwrite current stock levels for the selected scope.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdating}
                  className="w-full bg-brand-700 text-white py-2 rounded-lg hover:bg-brand-800 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bulkUpdating ? 'Updating...' : 'Update Existing Stock'}
                </button>
                <button
                  onClick={handleInitializeAllStock}
                  disabled={bulkUpdating}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bulkUpdating ? 'Initializing...' : 'Initialize All Products'}
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  disabled={bulkUpdating}
                  className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-medium"
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
