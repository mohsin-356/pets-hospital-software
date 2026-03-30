import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiPackage, FiX, FiCamera, FiUpload, FiDownload } from 'react-icons/fi';
import { productsAPI, suppliersAPI } from '../../services/api';
import * as XLSX from 'xlsx';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [showOtherSupplier, setShowOtherSupplier] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const scanRAF = useRef(null);
  const barcodeInputRef = useRef(null);
  const importFileRef = useRef(null);
  const scanTimerRef = useRef(null);
  const [showStickerDialog, setShowStickerDialog] = useState(false);
  const [stickerInfo, setStickerInfo] = useState({ itemName: '', salePrice: 0 });
  const [categories, setCategories] = useState(['Food', 'Toy', 'Collar', 'Shampoo', 'Accessory', 'Medicine', 'Grooming', 'Other']);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [showJsonImport, setShowJsonImport] = useState(false);
  const jsonFileRef = useRef(null);
  const [jsonCompany, setJsonCompany] = useState('Basit');
  const [companyOptions, setCompanyOptions] = useState(['Basit', 'Remu', 'Royal']);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState('');

  useEffect(() => {
    if (showScanner) {
      startScanner();
      return () => stopScanner();
    }
    // ensure stopped if toggled off
    stopScanner();
  }, [showScanner]);

  

  const [formData, setFormData] = useState({
    itemName: '',
    category: 'Food',
    barcode: '',
    quantity: 0,
    purchasePrice: 0,
    salePrice: 0,
    supplier: '',
    otherSupplier: '',
    description: '',
    lowStockThreshold: 10
  });

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, selectedCompany, products]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedCompany]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('Fetching products...');
      const response = await productsAPI.getAll();
      console.log('Products API response:', response);
      const list = response.data || [];
      setProducts(list);
      setCompanyOptions(buildCompanyOptions(list));
      console.log('Products set:', response.data?.length || 0);
    } catch (error) {
      showToast('Error fetching products');
      console.error('Fetch products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickJsonFile = () => {
    try { jsonFileRef.current?.click(); } catch {}
  };

  const toNum = (v, def = 0) => {
    if (v === undefined || v === null || String(v).trim() === '') return def;
    const n = Number(String(v).toString().replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : def;
  };

  const parseJsonRowsToProducts = (rows, companyName) => {
    const out = [];
    for (const r of rows || []) {
      if (!r || typeof r !== 'object') continue;
      const itemName = String(r.itemName || r.item_name || r.product || r.name || '').trim();
      if (!itemName) continue;

      const category = String(r.category || r.section || r.description || 'Other').trim() || 'Other';
      const barcode = r.barcode != null ? String(r.barcode).trim() : (r.code != null ? String(r.code).trim() : '');

      const quantity = toNum(r.quantity, 0);
      const purchasePrice = toNum(r.purchasePrice ?? r.purchase_price ?? r.wholesale_price ?? r.wholesalePrice ?? r.rate ?? 0, 0);
      const salePrice = toNum(r.salePrice ?? r.sale_price ?? r.retail_price ?? r.retailPrice ?? r.rate ?? 0, 0);

      const supplier = String(r.supplier || r.vendor || '').trim();
      const description = String(r.description || r.brand || '').trim();

      out.push({
        itemName,
        company: String(companyName || '').trim(),
        category,
        barcode,
        quantity,
        purchasePrice,
        salePrice,
        supplier,
        description,
        lowStockThreshold: toNum(r.lowStockThreshold ?? r.low_stock_threshold ?? 10, 10)
      });
    }
    return out;
  };

  const handleJsonImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    try {
      if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext !== 'json') {
        showToast('Invalid file. Please upload .json');
        return;
      }
      const companyName = (jsonCompany || '').trim();
      if (!companyName) {
        showToast('Please select a company');
        return;
      }
      setImporting(true);
      const text = await file.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error('Invalid JSON'); }
      const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      const items = parseJsonRowsToProducts(rows, companyName);
      if (!items.length) {
        showToast('No valid products found in JSON');
        return;
      }
      const res = await productsAPI.bulkUpsert(items);
      const serverCount = (res && (res.count != null ? res.count : (Array.isArray(res.data) ? res.data.length : items.length))) || items.length;
      showToast(`Imported ${serverCount} products (${companyName})`);
      setShowJsonImport(false);
      await fetchProducts();
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'JSON import failed');
    } finally {
      setImporting(false);
      try { if (jsonFileRef.current) jsonFileRef.current.value = ''; } catch {}
    }
  };

  const confirmAddCompany = () => {
    const val = (newCompany || '').trim();
    if (!val) { showToast('Enter company name'); return; }
    const existing = (companyOptions || []).find(c => c.toLowerCase() === val.toLowerCase());
    const chosen = existing || val;
    setCompanyOptions(prev => Array.from(new Set([...(prev || []), chosen])).sort());
    setJsonCompany(chosen);
    setNewCompany('');
    setShowAddCompany(false);
    showToast('Company added');
  };

  const handleClearAll = async () => {
    try {
      if ((products || []).length === 0) { showToast('No products to delete'); return; }
      const ok = window.confirm('Delete ALL products? This cannot be undone.');
      if (!ok) return;
      setClearing(true);
      await productsAPI.clearAll();
      showToast('All products deleted');
      await fetchProducts();
    } catch (err) {
      showToast(err?.message || 'Failed to clear products');
    } finally {
      setClearing(false);
    }
  };

  const handleAddCategory = () => {
    const val = (newCategory || '').trim();
    if (!val) { showToast('Enter category name'); return; }
    const existing = (categories || []).find(c => c.toLowerCase() === val.toLowerCase());
    const chosen = existing || val;
    setCategories(prev => Array.from(new Set([...(prev || []), chosen])).sort());
    setFormData(prev => ({ ...prev, category: chosen }));
    setShowAddCategory(false);
    setNewCategory('');
    showToast('Category added');
  };

  const fetchCategories = async () => {
    try {
      const res = await productsAPI.getCategories();
      const list = (res?.data || res || []).filter(Boolean);
      if (Array.isArray(list) && list.length) setCategories(list);
    } catch (error) {
      const derived = Array.from(new Set((products || []).map(p => p.category).filter(Boolean)));
      if (derived.length) setCategories(derived);
    }
  };

  // Start camera barcode scanner using BarcodeDetector API
  const startScanner = async () => {
    if (scanning) return;
    try {
      if (!('BarcodeDetector' in window)) {
        showToast('Barcode scanner not supported in this browser');
        return;
      }
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ['code_128','code_39','ean_13','ean_8','qr_code','upc_a','upc_e','itf'] });
      const loop = async () => {
        try {
          if (!videoRef.current) return;
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const value = codes[0].rawValue || codes[0].displayValue;
            setFormData(prev => ({ ...prev, barcode: value }));
            showToast('Barcode scanned');
            stopScanner();
            setShowScanner(false);
            return;
          }
        } catch {}
        scanRAF.current = requestAnimationFrame(loop);
      };
      scanRAF.current = requestAnimationFrame(loop);
    } catch (e) {
      showToast('Camera access failed');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    try {
      if (scanRAF.current) cancelAnimationFrame(scanRAF.current);
      const v = videoRef.current;
      const stream = v && v.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
      if (v) v.srcObject = null;
    } catch {}
    setScanning(false);
  };

  const fetchSuppliers = async () => {
    try {
      const response = await suppliersAPI.getAll('shop');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (selectedCompany !== 'All') {
      filtered = filtered.filter(p => (p.company || '') === selectedCompany);
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.itemName?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.supplier?.toLowerCase().includes(query) ||
        p.company?.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
  };

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil((filteredProducts?.length || 0) / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedProducts = (filteredProducts || []).slice(pageStart, pageEnd);

  const parseTags = (value) => {
    const s = String(value ?? '').trim();
    if (!s) return [];
    const parts = s
      .split(/[\n,|>/]+/g)
      .map(x => String(x || '').trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
    return [s];
  };

  const CategoryTags = ({ value }) => {
    const tags = parseTags(value);
    const visible = tags.slice(0, 2);
    const remaining = tags.length - visible.length;
    return (
      <div className="flex flex-wrap items-start gap-1 min-w-0 max-w-full">
        {visible.map((t, i) => (
          <span
            key={`${t}-${i}`}
            title={t}
            className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap max-w-full truncate"
          >
            {t}
          </span>
        ))}
        {remaining > 0 && (
          <span
            title={tags.join(', ')}
            className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 whitespace-nowrap"
          >
            +{remaining}
          </span>
        )}
      </div>
    );
  };

  const buildCompanyOptions = (list) => {
    const base = ['Basit', 'Remu', 'Royal'];
    const fromProducts = Array.isArray(list) ? list.map(p => p.company).filter(Boolean) : [];
    return Array.from(new Set([ ...base, ...fromProducts ])).sort();
  };

  const findByBarcode = (code) => {
    if (!code) return null;
    const q = String(code).trim().toLowerCase();
    return (products || []).find(p => (p.barcode || '').trim().toLowerCase() === q) || null;
  };

  const scheduleFilterByBarcode = (val) => {
    try { if (scanTimerRef.current) clearTimeout(scanTimerRef.current); } catch {}
    scanTimerRef.current = setTimeout(() => {
      const prod = findByBarcode(val);
      if (prod && prod.barcode) {
        setSearchQuery(String(prod.barcode));
      }
    }, 120);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const handleImportClick = () => {
    try { importFileRef.current?.click(); } catch {}
  };

  const resolveField = (row, names = []) => {
    for (const n of names) {
      const key = Object.keys(row).find(k => String(k).trim().toLowerCase() === String(n).trim().toLowerCase());
      if (key) return row[key];
    }
    return undefined;
  };

  const parseRowsToProducts = (rows) => {
    const out = [];
    for (const r of rows) {
      const isEmptyRow = !r || Object.values(r).every(v => (
        v === undefined || v === null || String(v).trim() === ''
      ));
      if (isEmptyRow) continue;

      const itemName = (resolveField(r, ['itemName','item_name','name','product','product name']) || '').toString().trim();
      const category = (resolveField(r, ['category','cat']) || '').toString().trim();
      const barcodeVal = resolveField(r, ['barcode','code','sku']);
      const barcode = barcodeVal == null ? '' : String(barcodeVal).trim();
      const toNum = (v, def=0) => {
        if (v === undefined || v === null || String(v).trim() === '') return def;
        const n = Number(String(v).toString().replace(/[^0-9.\-]/g,''));
        return Number.isFinite(n) ? n : def;
      };
      const quantity = toNum(resolveField(r, ['quantity','qty','stock']), 0);
      const purchasePrice = toNum(resolveField(r, ['purchasePrice','purchase_price','cost','buy price','buy']), 0);
      const salePrice = toNum(resolveField(r, ['salePrice','sale_price','price','sell price','mrp']), 0);
      const supplier = (resolveField(r, ['supplier','vendor']) || '').toString();
      const description = (resolveField(r, ['description','desc','details']) || '').toString();
      const lowStockThreshold = toNum(resolveField(r, ['lowStockThreshold','low_stock','reorder level','reorder']), 10) || 10;
      out.push({ itemName, category, barcode, quantity, purchasePrice, salePrice, supplier, description, lowStockThreshold });
    }
    return out;
  };

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    try {
      if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!['xlsx','csv','xls'].includes(ext)) {
        showToast('Invalid file. Please upload .xlsx or .csv');
        return;
      }
      setImporting(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      if (!ws) { showToast('No sheet found in file'); return; }
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const items = parseRowsToProducts(rows);
      if (!items.length) { showToast('No valid rows found'); return; }
      const res = await productsAPI.bulkUpsert(items);
      const serverCount = (res && (res.count != null ? res.count : (Array.isArray(res.data) ? res.data.length : items.length))) || items.length;
      showToast(`Imported ${serverCount} products`);
      fetchProducts();
    } catch (err) {
      showToast(err?.message || 'Import failed');
    } finally {
      setImporting(false);
      try { if (importFileRef.current) importFileRef.current.value = ''; } catch {}
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = (filteredProducts || []).map(p => ({
        'Item Name': p.itemName,
        'Category': p.category,
        'Barcode': p.barcode || '',
        'Quantity': p.quantity,
        'Purchase Price': p.purchasePrice,
        'Sale Price': p.salePrice,
        'Supplier': p.supplier || '',
        'Description': p.description || '',
        'Low Stock Threshold': p.lowStockThreshold || 10,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `products_export_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export started');
    } catch (err) {
      showToast(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      const isOtherSupplier = product.supplier && !suppliers.find(s => s.supplierName === product.supplier);
      setShowOtherSupplier(isOtherSupplier);
      setFormData({
        itemName: product.itemName,
        category: product.category,
        barcode: product.barcode || '',
        quantity: product.quantity,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        supplier: isOtherSupplier ? 'Other' : product.supplier || '',
        otherSupplier: isOtherSupplier ? product.supplier : '',
        description: product.description || '',
        lowStockThreshold: product.lowStockThreshold || 10
      });
      if (product.category && !categories.includes(product.category)) {
        setCategories(prev => Array.from(new Set([...(prev||[]), product.category])).sort());
      }
    } else {
      setEditingProduct(null);
      setShowOtherSupplier(false);
      setFormData({
        itemName: '',
        category: 'Food',
        barcode: '',
        quantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        supplier: '',
        otherSupplier: '',
        description: '',
        lowStockThreshold: 10
      });
    }
    setShowModal(true);
    // Focus barcode field when modal opens
    setTimeout(() => {
      try { barcodeInputRef.current?.focus(); } catch {}
    }, 50);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setShowOtherSupplier(false);
    if (scanning) stopScanner();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        supplier: formData.supplier === 'Other' ? formData.otherSupplier : formData.supplier
      };
      delete submitData.otherSupplier;
      if (editingProduct) {
        await productsAPI.update(editingProduct._id, submitData);
        showToast('Product updated successfully');
      } else {
        const resp = await productsAPI.create(submitData);
        const created = resp?.data || resp || submitData;
        showToast('Product added successfully');
        setStickerInfo({
          itemName: created.itemName || submitData.itemName,
          salePrice: (created.salePrice ?? submitData.salePrice) || 0
        });
        setShowStickerDialog(true);
      }

      setCategories(prev => Array.from(new Set([...(prev||[]), submitData.category])).sort());
      fetchProducts();
      closeModal();
    } catch (error) {
      showToast(error.message || 'Error saving product');
    }
  };

  const printSticker = ({ itemName = '', salePrice = 0 }) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const safeName = String(itemName).slice(0, 28);
      const priceText = `Rs${Number(salePrice || 0).toLocaleString()}`;
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 58mm 30mm; margin: 2mm; }
    body { width: 58mm; height: 30mm; margin: 0; font-family: Arial, sans-serif; }
    .label { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; padding: 2mm; }
    .name { font-size: 12pt; font-weight: 700; text-align: center; line-height: 1.1; }
    .price { font-size: 14pt; font-weight: 800; margin-top: 2mm; }
  </style>
  <title>Sticker</title>
  </head>
<body>
  <div class="label">
    <div class="name">${safeName}</div>
    <div class="price">${priceText}</div>
  </div>
</body>
</html>`;

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 200);
    } catch {}
  };

  const openDeleteModal = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    
    try {
      await productsAPI.delete(productToDelete._id);
      showToast('Product deleted successfully');
      fetchProducts();
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      showToast('Error deleting product');
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Sticker Print Dialog */}
      {showStickerDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div className="font-semibold">Print Sticker</div>
              <button onClick={() => setShowStickerDialog(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="text-center mb-3">
                <div className="font-bold text-lg text-slate-900">{stickerInfo.itemName}</div>
                <div className="text-2xl font-extrabold text-slate-900">Rs{Number(stickerInfo.salePrice||0).toLocaleString()}</div>
              </div>
              <div className="text-center text-xs text-slate-500">Label size: 58mm x 30mm</div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4 flex gap-3">
              <button
                onClick={() => setShowStickerDialog(false)}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold"
              >
                OK
              </button>
              <button
                onClick={() => { setShowStickerDialog(false); setTimeout(() => printSticker(stickerInfo), 10); }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Products
          </h1>
          <p className="text-slate-500 mt-1">Manage your shop inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={jsonFileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleJsonImportFile}
            className="hidden"
          />
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => setShowJsonImport(true)}
            disabled={importing}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiUpload /> Import JSON
          </button>
          <button
            onClick={handleImportClick}
            disabled={importing}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiUpload /> Import
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || filteredProducts.length === 0}
            className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiDownload /> Export
          </button>
          <button
            onClick={handleClearAll}
            disabled={clearing || (products || []).length === 0}
            className={`flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition-colors ${clearing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiTrash2 /> Clear All
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiPlus /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, barcode, or supplier..."
              value={searchQuery}
              onChange={(e) => { const v = e.target.value; setSearchQuery(v); scheduleFilterByBarcode(v); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'NumpadEnter') {
                  const exact = findByBarcode(searchQuery);
                  if (exact && exact.barcode) {
                    e.preventDefault();
                    setSearchQuery(String(exact.barcode));
                  }
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Companies</option>
            {(companyOptions || []).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All</option>
            {(categories || []).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div className="font-semibold">Import Products (JSON)</div>
              <button onClick={() => setShowJsonImport(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                  <select
                    value={jsonCompany}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__add__') {
                        setShowAddCompany(true);
                        return;
                      }
                      setJsonCompany(v);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(companyOptions || []).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__add__">Add Company</option>
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    onClick={pickJsonFile}
                    disabled={importing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60"
                  >
                    <FiUpload className="w-4 h-4" /> Upload JSON
                  </button>
                </div>
              </div>

              {showAddCompany && (
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Company Name</label>
                  <div className="flex gap-2">
                    <input
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. ABC Traders"
                    />
                    <button onClick={confirmAddCompany} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                      Add
                    </button>
                    <button onClick={() => { setShowAddCompany(false); setNewCompany(''); }} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="text-sm text-slate-600">
                - Select company first, then upload JSON.
                <br />
                - JSON can be an array of objects (like your Basit/Remu/Royal files).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-32" />
                <col className="w-44" />
                <col className="w-36" />
                <col className="w-20" />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-40" />
                <col className="w-28" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Barcode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Purchase Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sale Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedProducts.map((product, idx) => (
                  <tr key={product._id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-500">{pageStart + idx + 1}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{product.itemName}</p>
                        {product.description && (
                          <p className="text-sm text-slate-500 truncate max-w-xs">{product.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{product.company || '-'}</td>
                    <td className="px-6 py-4 align-top">
                      <CategoryTags value={product.category} />
                    </td>
                    <td className="px-6 py-4 text-slate-600">{product.barcode || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${
                        product.quantity <= product.lowStockThreshold 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">Rs{product.purchasePrice.toLocaleString()}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">Rs{product.salePrice.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-600">{product.supplier || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredProducts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Showing {Math.min(pageStart + 1, filteredProducts.length)}-{Math.min(pageEnd, filteredProducts.length)} of {filteredProducts.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <div className="text-sm font-medium text-slate-700">
              Page {safePage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.itemName}
                    onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category *
                  </label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(categories || []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setShowAddCategory(s => !s); setNewCategory(''); }}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Add New
                    </button>
                  </div>
                  {showAddCategory && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category name"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button" onClick={handleAddCategory} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">Save</button>
                      <button type="button" onClick={() => { setShowAddCategory(false); setNewCategory(''); }} className="px-3 py-2 border rounded-lg">Cancel</button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Scan or enter barcode"
                    />
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                      title="Scan Barcode"
                    >
                      <FiCamera className="w-4 h-4"/> Scan
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purchase Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sale Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({...formData, salePrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier
                  </label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({...formData, supplier: value, otherSupplier: ''});
                      setShowOtherSupplier(value === 'Other');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(supplier => (
                      <option key={supplier._id} value={supplier.supplierName}>
                        {supplier.supplierName}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>

                {showOtherSupplier && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Other Supplier Name
                    </label>
                    <input
                      type="text"
                      value={formData.otherSupplier}
                      onChange={(e) => setFormData({...formData, otherSupplier: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter supplier name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({...formData, lowStockThreshold: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">Scan Barcode</div>
              <button onClick={() => { setShowScanner(false); }} className="p-1 rounded hover:bg-slate-100"><FiX className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} playsInline style={{ width: '100%', height: 'auto' }} />
              </div>
              <p className="text-sm text-slate-600">Align the barcode within the frame. The code will auto-fill into the field.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={stopScanner} className="px-3 py-1.5 border rounded-lg">Stop</button>
                <button onClick={startScanner} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg">Start</button>
                <button onClick={() => setShowScanner(false)} className="px-3 py-1.5 border rounded-lg">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Product</h3>
                  <p className="text-sm text-red-100">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <span className="font-bold text-slate-900">{productToDelete.itemName}</span>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Warning:</p>
                    <p>Deleting this product will permanently remove it from your inventory and all associated records.</p>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Category:</span>
                    <span className="font-medium text-slate-800">{productToDelete.category}</span>
                  </div>
                  {productToDelete.barcode && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Barcode:</span>
                      <span className="font-medium text-slate-800">{productToDelete.barcode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Current Stock:</span>
                    <span className={`font-semibold ${
                      productToDelete.quantity <= productToDelete.lowStockThreshold 
                        ? 'text-orange-600' 
                        : 'text-green-600'
                    }`}>
                      {productToDelete.quantity} units
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Sale Price:</span>
                    <span className="font-semibold text-slate-900">Rs{productToDelete.salePrice.toLocaleString()}</span>
                  </div>
                  {productToDelete.supplier && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Supplier:</span>
                      <span className="font-medium text-slate-800">{productToDelete.supplier}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setProductToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Delete Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
