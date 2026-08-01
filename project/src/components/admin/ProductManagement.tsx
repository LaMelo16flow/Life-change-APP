import { useEffect, useState, useRef } from 'react';
import { supabase, Product } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { loadCountryNames, getCountryName } from '../../utils/countries';
import { Upload, Plus, CreditCard as Edit2, Save, X, Image } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProductPrice {
  country_code: string;
  price: number;
}

export function ProductManagement() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productPrices, setProductPrices] = useState<Record<string, ProductPrice[]>>({});
  const [countryMap, setCountryMap] = useState<Record<string, string>>({});
  const [countryList, setCountryList] = useState<[string, string][]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    product_type: '',
    pv_value: 0,
    description: '',
    image_url: '',
  });

  useEffect(() => {
    const loadData = async () => {
      const countries = await loadCountryNames();
      setCountryMap(countries);
      setCountryList(Object.entries(countries).sort((a, b) => a[1].localeCompare(b[1])));
      await fetchProducts();
    };
    loadData();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setProducts(data);

      const pricesMap: Record<string, ProductPrice[]> = {};
      for (const product of data) {
        const { data: prices } = await supabase
          .from('product_prices')
          .select('country_code, price')
          .eq('product_id', product.id);

        if (prices) {
          pricesMap[product.id] = prices;
        }
      }
      setProductPrices(pricesMap);
    }
    setLoading(false);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      product_type: product.product_type,
      pv_value: product.pv_value,
      description: product.description || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
      prices: productPrices[product.id] || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;

    const { error: productError } = await supabase
      .from('products')
      .update({
        name: editForm.name,
        product_type: editForm.product_type,
        pv_value: parseFloat(editForm.pv_value),
        description: editForm.description,
        image_url: editForm.image_url,
        is_active: editForm.is_active,
      })
      .eq('id', editingId);

    if (productError) {
      toast.error('Failed to update product');
      return;
    }

    for (const price of editForm.prices) {
      await supabase
        .from('product_prices')
        .upsert({
          product_id: editingId,
          country_code: price.country_code,
          price: parseFloat(price.price),
        }, {
          onConflict: 'product_id,country_code',
        });
    }

    toast.success('Product updated successfully');
    setEditingId(null);
    setEditForm(null);
    fetchProducts();
  };

  const updatePriceForCountry = (countryCode: string, newPrice: string) => {
    const prices = [...editForm.prices];
    const existingIndex = prices.findIndex(p => p.country_code === countryCode);

    if (existingIndex >= 0) {
      prices[existingIndex].price = parseFloat(newPrice) || 0;
    } else {
      prices.push({ country_code: countryCode, price: parseFloat(newPrice) || 0 });
    }

    setEditForm({ ...editForm, prices });
  };

  const getCountryDisplayName = (code: string) => getCountryName(code, countryMap);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const imageUrl = await uploadImage(file);
    setUploadingImage(false);

    if (imageUrl) {
      setNewProduct({ ...newProduct, image_url: imageUrl });
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleEditImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const imageUrl = await uploadImage(file);
    setUploadingImage(false);

    if (imageUrl && editForm) {
      setEditForm({ ...editForm, image_url: imageUrl });
    }

    if (editImageInputRef.current) {
      editImageInputRef.current.value = '';
    }
  };

  const handleAddProduct = async () => {
    const { error } = await supabase
      .from('products')
      .insert({
        name: newProduct.name,
        product_type: newProduct.product_type,
        pv_value: parseFloat(newProduct.pv_value.toString()),
        description: newProduct.description,
        image_url: newProduct.image_url,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add product');
      return;
    }

    toast.success('Product added successfully');
    setShowAdd(false);
    setNewProduct({ name: '', product_type: '', pv_value: 0, description: '', image_url: '' });
    fetchProducts();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const productsToImport = jsonData.map((row: any) => ({
        name: row['Product Name'] || row['name'] || row['Name'] || '',
        product_type: row['Type'] || row['type'] || row['Product Type'] || 'General',
        pv_value: parseFloat(row['PV'] || row['pv'] || row['PV Value'] || row['pv_value'] || 0),
        description: row['Description'] || row['description'] || '',
        is_active: true,
      })).filter(p => p.name);

      if (productsToImport.length === 0) {
        toast.warning('No valid products found in Excel file. Please ensure columns are named: Product Name, Type, PV, Description');
        setImporting(false);
        return;
      }

      const { error } = await supabase.from('products').insert(productsToImport);

      if (error) {
        toast.error('Failed to import products');
        setImporting(false);
        return;
      }

      toast.success(`Successfully imported ${productsToImport.length} products`);
      fetchProducts();
    } catch (error) {
      toast.error('Error processing Excel file');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
          <h2 className="text-2xl font-bold text-slate-900">Product Management</h2>
          <p className="text-slate-600 mt-1">Manage products and PV values</p>
        </div>
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:bg-green-400 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            {importing ? 'Importing...' : 'Import Excel'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New Product</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Product Name"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Product Type"
              value={newProduct.product_type}
              onChange={(e) => setNewProduct({ ...newProduct, product_type: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <input
              type="number"
              step="0.01"
              placeholder="PV Value"
              value={newProduct.pv_value || ''}
              onChange={(e) => setNewProduct({ ...newProduct, pv_value: parseFloat(e.target.value) || 0 })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Product Image</label>
              <div className="flex gap-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium disabled:bg-slate-400"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </button>
                <span className="text-slate-500 self-center">or</span>
                <input
                  type="text"
                  placeholder="Enter Image URL"
                  value={newProduct.image_url}
                  onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Description"
              value={newProduct.description}
              onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent col-span-2"
            />
          </div>
          {newProduct.image_url && (
            <div className="mt-4">
              <p className="text-sm text-slate-600 mb-2">Image Preview:</p>
              <img
                src={newProduct.image_url}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg border border-slate-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAddProduct}
              className="px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition font-medium"
            >
              Add Product
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product) => {
          const isEditing = editingId === product.id;
          const prices = productPrices[product.id] || [];

          if (isEditing && editForm) {
            return (
              <div key={product.id} className="bg-white p-6 rounded-xl border-2 border-brand-500 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Product</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Product Type</label>
                      <input
                        type="text"
                        value={editForm.product_type}
                        onChange={(e) => setEditForm({ ...editForm, product_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">PV Value</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.pv_value}
                      onChange={(e) => setEditForm({ ...editForm, pv_value: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product Image</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        ref={editImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => editImageInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition text-sm font-medium disabled:bg-slate-400"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingImage ? 'Uploading...' : 'Upload'}
                      </button>
                      <span className="text-slate-500 self-center text-sm">or</span>
                      <input
                        type="text"
                        placeholder="Enter URL"
                        value={editForm.image_url}
                        onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    {editForm.image_url && (
                      <img
                        src={editForm.image_url}
                        alt="Preview"
                        className="mt-2 w-24 h-24 object-cover rounded-lg border border-slate-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Prices by Country</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {countryList.map(([countryCode, countryName]) => {
                        const countryPrice = editForm.prices.find((p: ProductPrice) => p.country_code === countryCode);
                        return (
                          <div key={countryCode} className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 flex-shrink-0 max-w-32 truncate" title={countryName}>{countryName}:</span>
                            <input
                              type="number"
                              step="0.01"
                              value={countryPrice?.price || ''}
                              onChange={(e) => updatePriceForCountry(countryCode, e.target.value)}
                              placeholder="0.00"
                              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`active-${product.id}`}
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <label htmlFor={`active-${product.id}`} className="text-sm font-medium text-slate-700">
                      Active Product
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition font-medium"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={product.id}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition"
            >
              <div className="flex gap-4 mb-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23e2e8f0" width="80" height="80"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Image className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600">{product.product_type}</p>
                  <div className="mt-2">
                    <span className="text-lg font-bold text-green-600">{product.pv_value} PV</span>
                  </div>
                </div>
              </div>

              {product.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{product.description}</p>
              )}

              {prices.length > 0 && (
                <div className="mb-3 pb-3 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Prices:</p>
                  <div className="flex flex-wrap gap-2">
                    {prices.map((price) => (
                      <span key={price.country_code} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded" title={price.country_code}>
                        {getCountryDisplayName(price.country_code)}: {price.price}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    product.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {product.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => startEdit(product)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
