import { useEffect, useState, useRef } from 'react';
import { supabase, Product } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { getLocalizedProductType } from '../../utils/productLocale';
import { Upload, Plus, CreditCard as Edit2, Save, X, Image } from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizedProductName = (value: string) => {
  if (!value) return '';

  const aliases: Record<string, string> = {
    savon: 'soap',
    soap: 'soap',
    gel: 'gel',
    shampoo: 'shampoo',
    shampooing: 'shampoo',
    toothpaste: 'toothpaste',
    dentifrice: 'toothpaste',
    cream: 'cream',
    creme: 'cream',
    cremee: 'cream',
    crème: 'cream',
    lotion: 'lotion',
    lait: 'milk',
    milk: 'milk',
    huile: 'oil',
    oil: 'oil',
    tea: 'tea',
    the: 'tea',
    thé: 'tea',
    white: 'white',
    blanc: 'white',
    black: 'black',
    noir: 'black',
    body: 'body',
    corps: 'body',
    face: 'face',
    visage: 'face',
    vitamin: 'vitamin',
    vitamine: 'vitamin',
    guard: 'guard',
    protect: 'protect',
    anti: 'anti',
    acne: 'acne',
  };

  const cleaned = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => aliases[token] || token)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
};

const isValidImageUrl = (value?: string | null) => {
  if (!value) return false;

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;

  return true;
};

const buildInternetProductImageUrl = () => `${import.meta.env.BASE_URL}logo.webp`;

const chooseBestProductImage = (values: Array<string | null | undefined>) => {
  const validValues = values.filter(isValidImageUrl);
  if (validValues.length > 0) {
    return validValues[0];
  }

  return buildInternetProductImageUrl();
};

const mergeProductData = (existing: Partial<Product>, incoming: Partial<Product>) => {
  const merged: Partial<Product> = { ...existing };

  const fields: Array<keyof Product> = ['name', 'name_en', 'product_type', 'product_type_en', 'description', 'description_en', 'image_url', 'pv_value', 'is_active'];

  for (const field of fields) {
    const existingValue = existing[field];
    const incomingValue = incoming[field];

    if (incomingValue === undefined || incomingValue === null || incomingValue === '') {
      continue;
    }

    if (field === 'pv_value') {
      const parsedIncoming = Number(incomingValue);
      if (!Number.isNaN(parsedIncoming) && parsedIncoming > 0) {
        merged[field] = parsedIncoming;
      }
      continue;
    }

    if (field === 'is_active') {
      merged[field] = Boolean(incomingValue) || Boolean(existingValue);
      continue;
    }

    if (field === 'image_url') {
      const candidate = String(incomingValue).trim();
      const currentImage = typeof existingValue === 'string' ? existingValue.trim() : '';

      if (!currentImage || (candidate && candidate.length >= currentImage.length)) {
        merged[field] = candidate || currentImage || chooseBestProductImage([currentImage, candidate]);
      }
      continue;
    }

    if (typeof incomingValue === 'string') {
      const incomingText = incomingValue.trim();
      const existingText = typeof existingValue === 'string' ? existingValue.trim() : '';

      if (!existingText || incomingText.length >= existingText.length) {
        merged[field] = incomingValue;
      }
    }
  }

  if (!isValidImageUrl(merged.image_url as string | null | undefined)) {
    merged.image_url = chooseBestProductImage([existing.image_url, incoming.image_url]);
  }

  return merged;
};

const mergeDuplicateProducts = (items: Product[]) => {
  const groups = new Map<string, Product[]>();

  for (const item of items) {
    const key = normalizedProductName(item.name);
    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  const merged: Product[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      const product = group[0];
      product.image_url = isValidImageUrl(product.image_url)
        ? product.image_url
        : buildInternetProductImageUrl();
      merged.push(product);
      continue;
    }

    const primary = group.reduce((best, current) => {
      const bestScore = Number(Boolean(best.image_url)) + Number(Boolean(best.description)) + Number(best.is_active ? 1 : 0);
      const currentScore = Number(Boolean(current.image_url)) + Number(Boolean(current.description)) + Number(current.is_active ? 1 : 0);
      return currentScore > bestScore ? current : best;
    });

    const mergedProduct = group.reduce((result, current) => mergeProductData(result, current) as Product, { ...primary });
    mergedProduct.image_url = isValidImageUrl(mergedProduct.image_url as string | null | undefined)
      ? String(mergedProduct.image_url)
      : buildInternetProductImageUrl();
    mergedProduct.name = mergedProduct.name || primary.name;
    mergedProduct.product_type = mergedProduct.product_type || primary.product_type;
    mergedProduct.pv_value = Number(mergedProduct.pv_value ?? primary.pv_value) || 0;
    mergedProduct.description = mergedProduct.description ?? primary.description ?? '';
    mergedProduct.is_active = Boolean(mergedProduct.is_active ?? primary.is_active);

    merged.push(mergedProduct);
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
};

export function ProductManagement() {
  const toast = useToast();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    name_en: '',
    product_type: '',
    product_type_en: '',
    pv_value: 0,
    price: 0,
    description: '',
    description_en: '',
    image_url: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('product-management-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        await fetchProducts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices' }, async () => {
        await fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const dedupedProducts = mergeDuplicateProducts(data as Product[]);

      const cleanedProducts = dedupedProducts.map((product) => ({
        ...product,
        image_url: isValidImageUrl(product.image_url) ? product.image_url : buildInternetProductImageUrl(),
      }));

      setProducts(cleanedProducts);

      const pricesMap: Record<string, number> = {};
      for (const product of cleanedProducts) {
        const { data: price } = await supabase
          .from('product_prices')
          .select('price')
          .eq('product_id', product.id)
          .eq('country_code', 'CA')
          .maybeSingle();

        pricesMap[product.id] = price?.price ?? 0;
      }
      setProductPrices(pricesMap);
    }
    setLoading(false);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      name_en: product.name_en || '',
      product_type: product.product_type,
      product_type_en: product.product_type_en || '',
      pv_value: product.pv_value,
      description: product.description || '',
      description_en: product.description_en || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
      price: productPrices[product.id] ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('delete_product_cascade', {
        p_product_id: productId,
      });

      if (error) {
        console.error('deleteProduct failed:', error);
        return false;
      }

      setProducts((current) => current.filter((product) => product.id !== productId));
      return true;
    } catch (error) {
      console.error('deleteProduct failed:', error);
      return false;
    }
  };

  const deleteSelectedProducts = async () => {
    if (selectedProductIds.length === 0) return;

    const productIds = [...selectedProductIds];
    let deletedCount = 0;
    let failedCount = 0;

    for (const productId of productIds) {
      const success = await deleteProduct(productId);
      if (success) deletedCount++;
      else failedCount++;
    }

    setSelectedProductIds([]);
    await fetchProducts();

    if (failedCount === 0) {
      toast.success(t('admin.productsDeleted', { n: deletedCount }));
    } else {
      toast.error(t('admin.productsDeleteFailed', { failed: failedCount, deleted: deletedCount }));
    }
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;

    const finalImageUrl = isValidImageUrl(editForm.image_url)
      ? editForm.image_url.trim()
      : buildInternetProductImageUrl();

    const { error: productError } = await supabase
      .from('products')
      .update({
        name: editForm.name,
        name_en: editForm.name_en || null,
        product_type: editForm.product_type,
        product_type_en: editForm.product_type_en || null,
        pv_value: parseFloat(editForm.pv_value),
        description: editForm.description,
        description_en: editForm.description_en || null,
        image_url: finalImageUrl,
        is_active: editForm.is_active,
      })
      .eq('id', editingId);

    if (productError) {
      toast.error(t('admin.failedUpdateProduct'));
      return;
    }

    await supabase
      .from('product_prices')
      .upsert({
        product_id: editingId,
        country_code: 'CA',
        price: parseFloat(editForm.price) || 0,
      }, {
        onConflict: 'product_id,country_code',
      });

    toast.success(t('admin.productUpdated'));
    setEditingId(null);
    setEditForm(null);
    await fetchProducts();
  };

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
      toast.error(t('profile.failedUploadImage'));
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
    const cleanedName = newProduct.name.trim();
    if (!cleanedName) {
      toast.error(t('admin.productNameRequired'));
      return;
    }

    const finalImageUrl = isValidImageUrl(newProduct.image_url)
      ? newProduct.image_url.trim()
      : buildInternetProductImageUrl();

    const matchedProduct = products.find((product) => {
      const normalizedExisting = normalizedProductName(product.name);
      const normalizedIncoming = normalizedProductName(cleanedName);
      return normalizedExisting && normalizedIncoming && normalizedExisting === normalizedIncoming;
    });

    if (matchedProduct) {
      const merged = mergeProductData(matchedProduct, {
        name: cleanedName,
        name_en: newProduct.name_en || matchedProduct.name_en,
        product_type: newProduct.product_type || matchedProduct.product_type,
        product_type_en: newProduct.product_type_en || matchedProduct.product_type_en,
        pv_value: Number(newProduct.pv_value) || matchedProduct.pv_value,
        description: newProduct.description || matchedProduct.description,
        description_en: newProduct.description_en || matchedProduct.description_en,
        image_url: finalImageUrl || matchedProduct.image_url,
        is_active: true,
      });

      const { error } = await supabase
        .from('products')
        .update({
          name: merged.name || matchedProduct.name,
          name_en: merged.name_en ?? matchedProduct.name_en ?? null,
          product_type: merged.product_type || matchedProduct.product_type,
          product_type_en: merged.product_type_en ?? matchedProduct.product_type_en ?? null,
          pv_value: Number(merged.pv_value ?? matchedProduct.pv_value),
          description: merged.description ?? matchedProduct.description,
          description_en: merged.description_en ?? matchedProduct.description_en ?? null,
          image_url: merged.image_url ?? matchedProduct.image_url,
          is_active: Boolean(merged.is_active ?? matchedProduct.is_active),
        })
        .eq('id', matchedProduct.id);

      if (error) {
        toast.error(t('admin.failedUpdateMatchingProduct'));
        return;
      }

      await supabase
        .from('product_prices')
        .upsert({
          product_id: matchedProduct.id,
          country_code: 'CA',
          price: parseFloat(newProduct.price.toString()) || 0,
        }, {
          onConflict: 'product_id,country_code',
        });

      toast.success(t('admin.productUpdatedLatest'));
      setShowAdd(false);
      setNewProduct({ name: '', name_en: '', product_type: '', product_type_en: '', pv_value: 0, price: 0, description: '', description_en: '', image_url: '' });
      await fetchProducts();
      return;
    }

    const { data: createdProduct, error } = await supabase
      .from('products')
      .insert({
        name: cleanedName,
        name_en: newProduct.name_en || null,
        product_type: newProduct.product_type,
        product_type_en: newProduct.product_type_en || null,
        pv_value: parseFloat(newProduct.pv_value.toString()),
        description: newProduct.description,
        description_en: newProduct.description_en || null,
        image_url: finalImageUrl,
        is_active: true,
      })
      .select()
      .single();

    if (error || !createdProduct) {
      toast.error(t('admin.failedAddProduct'));
      return;
    }

    await supabase
      .from('product_prices')
      .upsert({
        product_id: createdProduct.id,
        country_code: 'CA',
        price: parseFloat(newProduct.price.toString()) || 0,
      }, {
        onConflict: 'product_id,country_code',
      });

    toast.success(t('admin.productAdded'));
    setShowAdd(false);
    setNewProduct({ name: '', name_en: '', product_type: '', product_type_en: '', pv_value: 0, price: 0, description: '', description_en: '', image_url: '' });
    await fetchProducts();
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

      const rawProducts = jsonData.map((row: any) => ({
        name: row['Product Name'] || row['name'] || row['Name'] || row['PRODUCT NAME'] || '',
        name_en: row['Product Name (English)'] || row['name_en'] || row['English Name'] || row['NAME_EN'] || row['Name EN'] || '',
        product_type: row['Type'] || row['type'] || row['Product Type'] || row['CATEGORY'] || 'General',
        product_type_en: row['Type (English)'] || row['product_type_en'] || row['English Type'] || row['Category (English)'] || row['TYPE_EN'] || '',
        pv_value: parseFloat(row['PV'] || row['pv'] || row['PV Value'] || row['pv_value'] || row['PV VALUE'] || 0),
        description: row['Description'] || row['description'] || row['DESCRIPTION'] || '',
        description_en: row['Description (English)'] || row['description_en'] || row['English Description'] || row['DESCRIPTION_EN'] || '',
        is_active: true,
      })).filter((product) => product.name && String(product.name).trim());

      if (rawProducts.length === 0) {
        toast.warning(t('admin.noValidProductsExcel'));
        setImporting(false);
        return;
      }

      const dedupedProducts: Array<{ name: string; name_en: string; product_type: string; product_type_en: string; pv_value: number; description: string; description_en: string; is_active: boolean }> = [];
      const seenProductKeys = new Set<string>();

      for (const row of rawProducts) {
        const normalizedName = normalizedProductName(row.name);
        if (!normalizedName) continue;

        const existingIndex = dedupedProducts.findIndex((product) => normalizedProductName(product.name) === normalizedName);
        if (existingIndex >= 0) {
          const existing = dedupedProducts[existingIndex];
          const merged = mergeProductData(existing as Partial<Product>, row as Partial<Product>);
          dedupedProducts[existingIndex] = {
            name: String(merged.name || existing.name),
            name_en: String(merged.name_en ?? existing.name_en ?? ''),
            product_type: String(merged.product_type || existing.product_type),
            product_type_en: String(merged.product_type_en ?? existing.product_type_en ?? ''),
            pv_value: Number(merged.pv_value ?? existing.pv_value),
            description: String(merged.description ?? existing.description),
            description_en: String(merged.description_en ?? existing.description_en ?? ''),
            is_active: Boolean(merged.is_active ?? existing.is_active),
          };
          continue;
        }

        seenProductKeys.add(normalizedName);
        dedupedProducts.push({
          name: String(row.name).trim(),
          name_en: String(row.name_en || '').trim(),
          product_type: String(row.product_type || 'General'),
          product_type_en: String(row.product_type_en || '').trim(),
          pv_value: Number(row.pv_value) || 0,
          description: String(row.description || ''),
          description_en: String(row.description_en || ''),
          is_active: true,
        });
      }

      let importedCount = 0;

      for (const product of dedupedProducts) {
        const matchedProduct = products.find((existingProduct) => {
          const normalizedExisting = normalizedProductName(existingProduct.name);
          return normalizedExisting && normalizedExisting === normalizedProductName(product.name);
        });

        if (matchedProduct) {
          const merged = mergeProductData(matchedProduct, product as Partial<Product>);
          const { error } = await supabase
            .from('products')
            .update({
              name: String(merged.name || matchedProduct.name),
              name_en: merged.name_en ?? matchedProduct.name_en ?? null,
              product_type: String(merged.product_type || matchedProduct.product_type),
              product_type_en: merged.product_type_en ?? matchedProduct.product_type_en ?? null,
              pv_value: Number(merged.pv_value ?? matchedProduct.pv_value),
              description: String(merged.description ?? matchedProduct.description),
              description_en: merged.description_en ?? matchedProduct.description_en ?? null,
              image_url: merged.image_url ?? matchedProduct.image_url,
              is_active: Boolean(merged.is_active ?? matchedProduct.is_active),
            })
            .eq('id', matchedProduct.id);

          if (error) {
            throw error;
          }

          importedCount += 1;
          continue;
        }

        const { error } = await supabase
          .from('products')
          .insert({
            name: product.name,
            name_en: product.name_en || null,
            product_type: product.product_type,
            product_type_en: product.product_type_en || null,
            pv_value: product.pv_value,
            description: product.description,
            description_en: product.description_en || null,
            image_url: null,
            is_active: product.is_active,
          });

        if (error) {
          throw error;
        }

        importedCount += 1;
      }

      toast.success(t('admin.processedProducts', { n: importedCount }));
      await fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error(t('admin.errorProcessingExcel'));
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('admin.productManagementTitle')}</h2>
          <p className="text-slate-600 mt-1">{t('admin.productManagementSubtitle')}</p>
        </div>
        <div className="flex gap-3 flex-wrap sm:justify-end">
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
            {importing ? t('admin.importing') : t('admin.importExcel')}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            {t('admin.addProduct')}
          </button>
          <button
            onClick={deleteSelectedProducts}
            disabled={selectedProductIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:bg-red-300 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
            {t('admin.deleteSelected', { n: selectedProductIds.length })}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('admin.addProduct')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder={t('admin.productName')}
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder={t('admin.productType')}
              value={newProduct.product_type}
              onChange={(e) => setNewProduct({ ...newProduct, product_type: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <input
              type="number"
              step="0.01"
              placeholder={t('admin.pvValue')}
              value={newProduct.pv_value || ''}
              onChange={(e) => setNewProduct({ ...newProduct, pv_value: parseFloat(e.target.value) || 0 })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <input
              type="number"
              step="0.01"
              placeholder={t('admin.priceCAD')}
              value={newProduct.price || ''}
              onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('admin.productImage')}</label>
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
                  {uploadingImage ? t('common.uploading') : t('admin.uploadImage')}
                </button>
                <span className="text-slate-500 self-center">{t('admin.or')}</span>
                <input
                  type="text"
                  placeholder={t('admin.enterImageUrl')}
                  value={newProduct.image_url}
                  onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder={t('admin.description')}
              value={newProduct.description}
              onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent col-span-2"
            />
            <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('admin.englishTranslationOptional')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder={`${t('admin.productNameEnglish')} — ${t('admin.optional').toLowerCase()}`}
                  value={newProduct.name_en}
                  onChange={(e) => setNewProduct({ ...newProduct, name_en: e.target.value })}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder={`${t('admin.productTypeEnglish')} — ${t('admin.optional').toLowerCase()}`}
                  value={newProduct.product_type_en}
                  onChange={(e) => setNewProduct({ ...newProduct, product_type_en: e.target.value })}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder={`${t('admin.descriptionEnglish')} — ${t('admin.optional').toLowerCase()}`}
                  value={newProduct.description_en}
                  onChange={(e) => setNewProduct({ ...newProduct, description_en: e.target.value })}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent col-span-1 sm:col-span-2"
                />
              </div>
            </div>
          </div>
          {newProduct.image_url && (
            <div className="mt-4">
              <p className="text-sm text-slate-600 mb-2">{t('admin.imagePreview')}</p>
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
              {t('admin.addProduct')}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition font-medium"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product) => {
          const isEditing = editingId === product.id;
          const price = productPrices[product.id] ?? 0;

          if (isEditing && editForm) {
            return (
              <div key={product.id} className="bg-white p-6 rounded-xl border-2 border-brand-500 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('admin.editProduct')}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.productName')}</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.productType')}</label>
                      <input
                        type="text"
                        value={editForm.product_type}
                        onChange={(e) => setEditForm({ ...editForm, product_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.pvValue')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.pv_value}
                      onChange={(e) => setEditForm({ ...editForm, pv_value: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.productImage')}</label>
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
                        {uploadingImage ? t('common.uploading') : t('admin.uploadImage')}
                      </button>
                      <span className="text-slate-500 self-center text-sm">{t('admin.or')}</span>
                      <input
                        type="text"
                        placeholder={t('admin.enterImageUrl')}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.description')}</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('admin.englishTranslationOptional')}</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.productNameEnglish')}</label>
                        <input
                          type="text"
                          placeholder={t('admin.optional')}
                          value={editForm.name_en}
                          onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.productTypeEnglish')}</label>
                        <input
                          type="text"
                          placeholder={t('admin.optional')}
                          value={editForm.product_type_en}
                          onChange={(e) => setEditForm({ ...editForm, product_type_en: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.descriptionEnglish')}</label>
                        <textarea
                          placeholder={t('admin.optional')}
                          value={editForm.description_en}
                          onChange={(e) => setEditForm({ ...editForm, description_en: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.priceCAD')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.price || ''}
                      onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
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
                      {t('admin.activeProduct')}
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                    >
                      <Save className="w-4 h-4" />
                      {t('profile.save')}
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
              className={`bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition ${selectedProductIds.includes(product.id) ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex gap-4 flex-1">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `${import.meta.env.BASE_URL}logo.webp`;
                    }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Image className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    {product.name_en && (
                      <p className="text-xs text-slate-400">EN: {product.name_en}</p>
                    )}
                    <p className="text-sm text-slate-600">{getLocalizedProductType(product, language)}</p>
                    <div className="mt-2">
                      <span className="text-lg font-bold text-green-600">{product.pv_value} PV</span>
                    </div>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product.id)}
                    onChange={() => toggleProductSelection(product.id)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  {t('admin.select')}
                </label>
              </div>

              {product.description && (
                <p className="text-sm text-slate-600 mb-1 line-clamp-2">{product.description}</p>
              )}
              {product.description_en && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">EN: {product.description_en}</p>
              )}

              <div className="mb-3 pb-3 border-b border-slate-200">
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">
                  {formatCurrency(price)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    product.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {product.is_active ? t('common.active') : t('common.inactive')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(product)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition text-sm font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {t('admin.edit')}
                  </button>
                  <button
                    onClick={async () => {
                      const success = await deleteProduct(product.id);

                      if (!success) {
                        toast.error(t('admin.failedDeleteProduct'));
                        return;
                      }

                      toast.success(t('admin.productDeleted'));
                      await fetchProducts();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t('admin.delete')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
