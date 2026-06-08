import React, { useState, useRef } from 'react';
import Barcode from 'react-barcode';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js'; 

export default function Inventory({ products, setProducts, storeDetails, isSidebarHidden, showSidebar }) { // 🔥 The new props!
  const [search, setSearch] = useState('');
  
  const [stockFilter, setStockFilter] = useState('all'); 
  const [categoryFilter, setCategoryFilter] = useState('all');
  const categories = ['Saree', 'Jeans', 'T-Shirt', 'Shirt', 'Kurta', 'Trouser', 'Other'];
  
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Saree'); 
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('');
  const [barcodeStr, setBarcodeStr] = useState('');

  const [showPrintStudio, setShowPrintStudio] = useState(false);
  const [printQueue, setPrintQueue] = useState([]);
  const [labelFormat, setLabelFormat] = useState('thermal'); 
  const printRef = useRef(null);

  const [isScanningImage, setIsScanningImage] = useState(false);

  const nameRef = useRef(null);
  const mrpRef = useRef(null);
  const priceRef = useRef(null);
  const stockRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const submitBtnRef = useRef(null);
  const fileImportRef = useRef(null); 
  const imageImportRef = useRef(null); 

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) nextRef.current.focus();
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search));
    const matchesStock = stockFilter === 'all' ? true : stockFilter === 'low' ? (p.stock > 0 && p.stock <= 5) : stockFilter === 'out' ? (p.stock <= 0) : true;
    const matchesCategory = categoryFilter === 'all' ? true : p.category === categoryFilter;
    return matchesSearch && matchesStock && matchesCategory;
  });

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      const newProducts = [];

      jsonData.forEach((row, index) => {
        const keys = Object.keys(row);
        const getVal = (possibleNames) => {
          const key = keys.find(k => possibleNames.some(p => k.toLowerCase().includes(p)));
          return key ? row[key] : null;
        };

        const importedName = getVal(['name', 'product', 'item', 'title']);
        const importedStock = parseInt(getVal(['qty', 'quantity', 'stock', 'count'])) || 0;
        const importedPrice = parseFloat(getVal(['price', 'sale', 'rate', 'cost'])) || 0;
        const importedMrp = parseFloat(getVal(['mrp'])) || importedPrice;
        const importedCategory = getVal(['category', 'type']) || 'Other';

        if (importedName && importedName.toString().trim() !== '') {
          newProducts.push({
            id: Date.now() + index, 
            name: importedName.toString().trim(),
            category: importedCategory,
            price: importedPrice,
            mrp: importedMrp,
            stock: importedStock,
            barcode: Math.floor(1000000000 + Math.random() * 9000000000).toString() 
          });
        }
      });

      if (newProducts.length > 0) {
        setProducts(prev => [...newProducts, ...prev]);
        alert(`✅ Success! Imported ${newProducts.length} products and generated barcodes.`);
      } else {
        alert("❌ Could not find valid product data. Ensure your Excel file has a column named 'Product Name'.");
      }
    } catch (error) {
      alert("❌ Failed to read the Excel file.");
    }
    
    e.target.value = null; 
  };

  const handleImageImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanningImage(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const lines = result.data.text.split('\n');
      const newProducts = [];

      lines.forEach((line, index) => {
        const cleanLine = line.trim();
        if (cleanLine.length > 3) {
          const priceMatch = cleanLine.match(/[\d]+(\.\d{1,2})?/);
          const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
          let name = cleanLine.replace(/[\d]+(\.\d{1,2})?/, '').replace(/[^a-zA-Z\s-]/g, '').trim();

          if (name.length > 2) {
            newProducts.push({
              id: Date.now() + index,
              name: name,
              category: 'Other',
              price: price,
              mrp: price,
              stock: 0, 
              barcode: Math.floor(1000000000 + Math.random() * 9000000000).toString()
            });
          }
        }
      });

      if (newProducts.length > 0) {
        setProducts(prev => [...newProducts, ...prev]);
        alert(`✅ Scanned ${newProducts.length} items from the image!\n\nPlease review their names and update their stock quantities.`);
      } else {
        alert("❌ Could not read any valid products from this image. Try a clearer photo.");
      }
    } catch (error) {
      alert("❌ Failed to process the image.");
    }
    setIsScanningImage(false);
    e.target.value = null;
  };

  const handleGenerateBarcode = () => {
    setBarcodeStr(Math.floor(1000000000 + Math.random() * 9000000000).toString());
  };

  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (!name.trim() || !price || !barcodeStr.trim()) return alert("Name, Price, and Barcode are required!");

    const productData = {
      id: editId || Date.now(),
      name,
      category, 
      price: parseFloat(price),
      mrp: parseFloat(mrp) || parseFloat(price),
      stock: parseInt(stock) || 0,
      barcode: barcodeStr
    };

    if (isEditing) {
      setProducts(products.map(p => p.id === editId ? productData : p));
    } else {
      if (products.find(p => p.barcode === barcodeStr)) return alert("Barcode already exists!");
      setProducts([productData, ...products]);
    }
    resetForm();
  };

  const editProduct = (p) => {
    setIsEditing(true); setEditId(p.id); setName(p.name); 
    setCategory(p.category || 'Saree'); 
    setPrice(p.price); setMrp(p.mrp || p.price); setStock(p.stock); setBarcodeStr(p.barcode);
    if (nameRef.current) nameRef.current.focus();
  };

  const deleteProduct = (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      setProducts(products.filter(p => p.id !== id));
      setPrintQueue(printQueue.filter(item => item.product.id !== id));
    }
  };

  const resetForm = () => {
    setIsEditing(false); setEditId(null); setName(''); setCategory('Saree'); setPrice(''); setMrp(''); setStock(''); setBarcodeStr('');
  };

  // --- Print Settings ---
  const [labelWidth, setLabelWidth] = useState(50); 
  const [labelHeight, setLabelHeight] = useState(25); 
  const [labelColumns, setLabelColumns] = useState(1);
  const [colGap, setColGap] = useState(2); 
  const [rowGap, setRowGap] = useState(2); 
  const [titleFontSize, setTitleFontSize] = useState(12); 
  const [priceFontSize, setPriceFontSize] = useState(10); 
  const [barcodeWidth, setBarcodeWidth] = useState(1.2); 
  const [barcodeHeightPx, setBarcodeHeightPx] = useState(20); 
  const [titleX, setTitleX] = useState(2);
  const [titleY, setTitleY] = useState(2);
  const [barcodeX, setBarcodeX] = useState(2);
  const [barcodeY, setBarcodeY] = useState(8);
  const [priceX, setPriceX] = useState(2);
  const [priceY, setPriceY] = useState(18);

  const addToPrintQueue = (product) => {
    const existing = printQueue.find(item => item.product.id === product.id);
    if (existing) {
      setPrintQueue(printQueue.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setPrintQueue([...printQueue, { product, qty: 1 }]);
    }
  };

  const updatePrintQty = (productId, delta) => {
    setPrintQueue(printQueue.map(item => {
      if (item.product.id === productId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromPrintQueue = (productId) => {
    setPrintQueue(printQueue.filter(item => item.product.id !== productId));
  };

  const handlePrintLabels = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Barcode_Labels',
    onAfterPrint: () => {
      if(window.confirm("Did the labels print successfully? Click OK to clear the queue.")) {
        setPrintQueue([]);
      }
    }
  });

  return (
    <div className="p-4 pt-16 md:p-6 min-h-screen flex flex-col gap-6 overflow-y-auto bg-slate-50 font-sans w-full relative">
      
      {/* 🔥 THE DYNAMIC INVENTORY BUTTON: Uses absolute positioning so it scrolls up with the page! */}
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {isScanningImage && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase text-center">Reading Image...</h2>
          <p className="text-slate-400 mt-2 text-center text-sm md:text-base">The AI is extracting product names and prices.</p>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end shrink-0 gap-4">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold text-slate-800 ${isSidebarHidden ? 'ml-12 md:ml-16' : ''}`}>Inventory Management</h1>
          <p className={`text-slate-500 mt-1 text-sm md:text-base ${isSidebarHidden ? 'ml-12 md:ml-16' : ''}`}>Total Unique Items: {products.length}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={fileImportRef} onChange={handleImportFile} className="hidden" />
          <input type="file" accept="image/*" ref={imageImportRef} onChange={handleImageImport} className="hidden" />
          
          <button onClick={() => imageImportRef.current.click()} className="flex-1 lg:flex-none bg-purple-50 border border-purple-200 text-purple-700 font-bold py-2 px-3 md:px-5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm md:text-base whitespace-nowrap">
            📷 Scan
          </button>
          <button onClick={() => fileImportRef.current.click()} className="flex-1 lg:flex-none bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold py-2 px-3 md:px-5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm md:text-base whitespace-nowrap">
            📥 Import
          </button>
          <button onClick={() => setShowPrintStudio(true)} className="flex-1 lg:flex-none bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-2 px-3 md:px-5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm md:text-base whitespace-nowrap">
            🖨️ Studio
            {printQueue.length > 0 && <span className="bg-indigo-600 text-white text-[10px] md:text-xs px-2 py-0.5 rounded-full">{printQueue.reduce((sum, item) => sum + item.qty, 0)}</span>}
          </button>
        </div>
      </div>

      {/* FORM */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg md:text-xl font-bold text-slate-800">{isEditing ? '✏️ Edit Product' : '📦 Add New Product'}</h2>
          {isEditing && <button type="button" onClick={resetForm} className="text-xs md:text-sm font-bold text-blue-600 underline">Cancel Edit</button>}
        </div>
        
        <form onSubmit={handleSaveProduct} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-10 gap-3 md:gap-4 items-end">
          
          <div className="lg:col-span-2">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">Product Name *</label>
            <input ref={nameRef} onKeyDown={e => handleKeyDown(e, mrpRef)} required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 md:p-2.5 text-sm md:text-base border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 md:p-2.5 text-sm md:text-base border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          
          <div className="lg:col-span-1">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">MRP (₹)</label>
            <input ref={mrpRef} onKeyDown={e => handleKeyDown(e, priceRef)} type="number" step="0.01" value={mrp} onChange={e => setMrp(e.target.value)} className="w-full p-2 md:p-2.5 text-sm md:text-base border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>
          
          <div className="lg:col-span-1">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">Sale Price *</label>
            <input ref={priceRef} onKeyDown={e => handleKeyDown(e, stockRef)} required type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2 md:p-2.5 text-sm md:text-base border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-700 font-bold" />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">Stock</label>
            <input ref={stockRef} onKeyDown={e => handleKeyDown(e, barcodeInputRef)} type="number" value={stock} onChange={e => setStock(e.target.value)} className="w-full p-2 md:p-2.5 text-sm md:text-base border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-1">Barcode *</label>
            <div className="flex gap-1">
              <input ref={barcodeInputRef} onKeyDown={e => handleKeyDown(e, submitBtnRef)} required type="text" value={barcodeStr} onChange={e => setBarcodeStr(e.target.value)} className="w-full p-2 md:p-2.5 text-sm md:text-base border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono" />
              <button type="button" onClick={() => { setBarcodeStr(Date.now().toString().slice(-10)); if(barcodeInputRef.current) barcodeInputRef.current.focus(); }} className="bg-slate-200 hover:bg-slate-300 px-3 rounded-lg font-bold text-lg" title="Generate New Barcode">↻</button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col justify-end">
            <button ref={submitBtnRef} type="submit" className={`w-full ${isEditing ? 'bg-orange-500' : 'bg-blue-600'} text-white font-bold py-2 md:py-2.5 text-sm md:text-base rounded-lg transition-colors h-[38px] md:h-[46px] shadow-sm whitespace-nowrap`}>
              {isEditing ? 'Update' : '+ Add'}
            </button>
          </div>

        </form>
      </div>

      {/* INVENTORY LIST */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-3 md:items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-slate-800 hidden md:block">Product Database</h3>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 min-w-[150px]">
              <span className="absolute left-3 top-2 md:top-2.5 text-slate-400 text-sm">🔍</span>
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 md:py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="flex-1 min-w-[110px] px-2 py-1.5 md:py-2 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold outline-none bg-white">
              <option value="all">All Stock</option>
              <option value="low">⚠️ Low (1-5)</option>
              <option value="out">🚫 Out (0)</option>
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="flex-1 min-w-[110px] px-2 py-1.5 md:py-2 border border-slate-300 rounded-lg text-xs md:text-sm font-semibold outline-none bg-white">
              <option value="all">All Cats</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-white border-b border-slate-200">
              <tr className="text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="p-3 md:p-4 font-bold">Product & Category</th>
                <th className="p-3 md:p-4 font-bold text-center">Stock</th>
                <th className="p-3 md:p-4 font-bold text-right">MRP</th>
                <th className="p-3 md:p-4 font-bold text-right text-emerald-600">Sale Price</th>
                <th className="p-3 md:p-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                let rowBg = "hover:bg-slate-50";
                if (p.stock <= 0) rowBg = "bg-red-50 hover:bg-red-100";
                else if (p.stock <= 5) rowBg = "bg-yellow-50 hover:bg-yellow-100";

                return (
                  <tr key={p.id} className={`${rowBg} transition-colors text-sm md:text-base`}>
                    <td className="p-3 md:p-4">
                      <div className="font-bold text-slate-800 truncate max-w-[150px] md:max-w-xs">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="bg-blue-100 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">{p.category || 'Other'}</span>
                        <span className="text-[9px] md:text-[10px] text-slate-400 font-mono">#{p.barcode}</span>
                      </div>
                    </td>
                    <td className="p-3 md:p-4 text-center">
                      <span className={`px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold ${
                        p.stock <= 0 ? 'bg-red-600 text-white' : 
                        p.stock <= 5 ? 'bg-yellow-500 text-white' : 
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-3 md:p-4 text-right font-semibold text-slate-400 line-through text-xs md:text-sm">₹{p.mrp || p.price}</td>
                    <td className="p-3 md:p-4 text-right font-bold text-emerald-600">₹{p.price.toFixed(2)}</td>
                    <td className="p-3 md:p-4 text-center space-x-1 md:space-x-2 whitespace-nowrap">
                      <button onClick={() => { addToPrintQueue(p); setShowPrintStudio(true); }} className="p-1 md:p-1.5 bg-indigo-50 text-indigo-600 rounded transition-colors text-xs md:text-base" title="Print Labels">🖨️</button>
                      <button onClick={() => editProduct(p)} className="p-1 md:p-1.5 bg-blue-50 text-blue-600 rounded transition-colors text-xs md:text-base" title="Edit">✏️</button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1 md:p-1.5 bg-red-50 text-red-600 rounded transition-colors text-xs md:text-base" title="Delete">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT STUDIO MODAL */}
      {showPrintStudio && (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col p-2 md:p-8">
          <div className="bg-white flex-1 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300 relative animate-fade-in-down">
            
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-200 bg-indigo-50 shrink-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-indigo-900 flex items-center gap-2">🖨️ Label Print Studio</h2>
                <p className="text-indigo-700 text-xs md:text-sm mt-1 hidden sm:block">Design and print barcode stickers.</p>
              </div>
              <button onClick={() => setShowPrintStudio(false)} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white rounded-full text-slate-600 font-bold shadow-sm">✕</button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              
              <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden h-[30vh] lg:h-auto shrink-0 lg:shrink">
                <div className="p-3 md:p-4 border-b border-slate-200 shrink-0">
                  <h3 className="font-bold text-slate-700 mb-2 text-xs md:text-sm uppercase tracking-wider">1. Select Products</h3>
                  <div className="relative">
                    <span className="absolute left-3 top-1.5 md:top-2 text-slate-400 text-sm">🔍</span>
                    <input type="text" placeholder="Search to add..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 md:py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-400">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 text-xs md:text-sm truncate">{product.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{product.barcode}</p>
                      </div>
                      <button onClick={() => addToPrintQueue(product)} className="bg-indigo-100 text-indigo-700 w-6 h-6 md:w-8 md:h-8 rounded-md flex items-center justify-center font-bold text-lg leading-none">+</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full lg:w-2/3 flex flex-col bg-white overflow-hidden">
                <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <label className="text-xs md:text-sm font-bold text-slate-600 uppercase hidden sm:block">Format:</label>
                    <select value={labelFormat} onChange={(e) => setLabelFormat(e.target.value)} className="bg-white border border-slate-300 text-slate-700 text-xs md:text-sm rounded-lg p-1.5 md:p-2 outline-none">
                      <option value="thermal">Thermal Roll</option>
                      <option value="a4">Standard A4 Sheet</option>
                    </select>
                  </div>
                  <button onClick={handlePrintLabels} disabled={printQueue.length === 0} className="bg-indigo-600 text-white font-bold py-1.5 md:py-2.5 px-4 md:px-6 rounded-lg text-sm md:text-base disabled:opacity-50">
                    🖨️ Print {printQueue.reduce((sum, item) => sum + item.qty, 0)}
                  </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                  <div className="w-full md:w-1/2 p-3 md:p-4 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200 h-[40vh] md:h-auto">
                    <h3 className="font-bold text-slate-700 mb-3 text-xs md:text-sm uppercase tracking-wider">2. Label Design</h3>
                    
                    <div className="space-y-3 mb-4">
                      <div className="flex gap-2">
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 mb-1">Width (mm)</label><input type="number" value={labelWidth} onChange={e => setLabelWidth(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs" /></div>
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 mb-1">Height (mm)</label><input type="number" value={labelHeight} onChange={e => setLabelHeight(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs" /></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 mb-1">Grid Columns</label><input type="number" min="1" value={labelColumns} onChange={e => setLabelColumns(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs" /></div>
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 mb-1">Gap (mm)</label><input type="number" step="0.5" value={colGap} onChange={e => setColGap(Number(e.target.value))} className="w-full p-1.5 border rounded text-xs" /></div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-1 flex justify-between"><span>📝 Title</span><span>{titleFontSize}px</span></p>
                        <input type="range" min="6" max="30" value={titleFontSize} onChange={e => setTitleFontSize(Number(e.target.value))} className="w-full mb-1" />
                        <div className="flex gap-2">
                          <label className="flex-1 text-[9px] text-slate-500">Left: <input type="range" min="0" max={labelWidth} step="0.5" value={titleX} onChange={e => setTitleX(Number(e.target.value))} className="w-full" /></label>
                          <label className="flex-1 text-[9px] text-slate-500">Top: <input type="range" min="0" max={labelHeight} step="0.5" value={titleY} onChange={e => setTitleY(Number(e.target.value))} className="w-full" /></label>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-1"><span>🦓 Barcode</span></p>
                        <div className="flex gap-2">
                          <label className="flex-1 text-[9px] text-slate-500">Left: <input type="range" min="0" max={labelWidth} step="0.5" value={barcodeX} onChange={e => setBarcodeX(Number(e.target.value))} className="w-full" /></label>
                          <label className="flex-1 text-[9px] text-slate-500">Top: <input type="range" min="0" max={labelHeight} step="0.5" value={barcodeY} onChange={e => setBarcodeY(Number(e.target.value))} className="w-full" /></label>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-1 flex justify-between"><span>💰 Price</span><span>{priceFontSize}px</span></p>
                        <input type="range" min="6" max="30" value={priceFontSize} onChange={e => setPriceFontSize(Number(e.target.value))} className="w-full mb-1" />
                        <div className="flex gap-2">
                          <label className="flex-1 text-[9px] text-slate-500">Left: <input type="range" min="0" max={labelWidth} step="0.5" value={priceX} onChange={e => setPriceX(Number(e.target.value))} className="w-full" /></label>
                          <label className="flex-1 text-[9px] text-slate-500">Top: <input type="range" min="0" max={labelHeight} step="0.5" value={priceY} onChange={e => setPriceY(Number(e.target.value))} className="w-full" /></label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-1/2 flex flex-col bg-slate-100 h-[40vh] md:h-auto">
                    <div className="p-3 border-b border-slate-200 shrink-0">
                       <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">3. Quantities</h3>
                       <div className="max-h-24 overflow-y-auto space-y-1">
                         {printQueue.map(item => (
                           <div key={item.product.id} className="flex justify-between items-center p-1.5 bg-white border rounded text-xs">
                             <span className="font-bold text-slate-800 truncate pr-1">{item.product.name}</span>
                             <div className="flex items-center gap-1 shrink-0">
                               <button onClick={() => updatePrintQty(item.product.id, -1)} className="w-5 h-5 rounded bg-slate-100 font-bold">-</button>
                               <span className="w-4 text-center">{item.qty}</span>
                               <button onClick={() => updatePrintQty(item.product.id, 1)} className="w-5 h-5 rounded bg-slate-100 font-bold">+</button>
                               <button onClick={() => removeFromPrintQueue(item.product.id)} className="ml-1 text-red-500">✕</button>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                    
                    <div className="flex-1 p-2 overflow-y-auto flex justify-center items-start transform scale-75 md:scale-100 origin-top">
                      {printQueue.length > 0 && (
                        <div className="bg-white p-2 shadow-sm" style={{ display: 'grid', gridTemplateColumns: `repeat(${labelColumns}, max-content)`, rowGap: `${rowGap}mm`, columnGap: `${colGap}mm`, justifyContent: 'center' }}>
                          {printQueue.flatMap(item => 
                            Array.from({ length: item.qty }).map((_, i) => (
                              <div key={`${item.product.id}-${i}`} style={{ width: `${labelWidth}mm`, height: `${labelHeight}mm`, position: 'relative', overflow: 'hidden', backgroundColor: 'white', border: '1px dashed #ccc' }}>
                                <div style={{ position: 'absolute', left: `${titleX}mm`, top: `${titleY}mm`, fontSize: `${titleFontSize}px`, fontWeight: 'bold', color: '#000', lineHeight: '1.1', width: `${labelWidth - titleX}mm`, whiteSpace: 'nowrap' }}>{item.product.name}</div>
                                <div style={{ position: 'absolute', left: `${barcodeX}mm`, top: `${barcodeY}mm` }}>
                                  <Barcode value={item.product.barcode} width={barcodeWidth} height={barcodeHeightPx} fontSize={Math.max(6, priceFontSize - 4)} displayValue={true} margin={0} background="transparent" />
                                </div>
                                <div style={{ position: 'absolute', left: `${priceX}mm`, top: `${priceY}mm`, fontSize: `${priceFontSize}px`, fontWeight: 'bold', color: '#000', display: 'flex', gap: '4px' }}>
                                  <span style={{ textDecoration: 'line-through' }}>MRP: ₹{item.product.mrp || item.product.price}</span>
                                  <span>Sale: ₹{item.product.price}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT */}
      <div className="hidden"><div ref={printRef}><style type="text/css" media="print">{`@page { size: ${labelFormat === 'thermal' ? `${labelWidth}mm ${labelHeight}mm` : 'A4'}; margin: ${labelFormat === 'thermal' ? '0' : '10mm'}; } body { margin: 0; padding: 0; font-family: sans-serif; } * { box-sizing: border-box; }`}</style><div style={labelFormat === 'a4' ? { display: 'grid', gridTemplateColumns: `repeat(${labelColumns}, max-content)`, rowGap: `${rowGap}mm`, columnGap: `${colGap}mm`, justifyContent: 'center' } : {}}>{printQueue.flatMap(item => Array.from({ length: item.qty }).map((_, i) => (<div key={`${item.product.id}-${i}`} style={{ width: `${labelWidth}mm`, height: `${labelHeight}mm`, position: 'relative', overflow: 'hidden', backgroundColor: 'white', pageBreakAfter: labelFormat === 'thermal' ? 'always' : 'auto', border: labelFormat === 'a4' ? '1px dashed #ccc' : 'none' }}><div style={{ position: 'absolute', left: `${titleX}mm`, top: `${titleY}mm`, fontSize: `${titleFontSize}px`, fontWeight: 'bold', color: '#000', lineHeight: '1.1', width: `${labelWidth - titleX}mm`, whiteSpace: 'nowrap' }}>{item.product.name}</div><div style={{ position: 'absolute', left: `${barcodeX}mm`, top: `${barcodeY}mm` }}><Barcode value={item.product.barcode} width={barcodeWidth} height={barcodeHeightPx} fontSize={Math.max(6, priceFontSize - 4)} displayValue={true} margin={0} background="transparent" /></div><div style={{ position: 'absolute', left: `${priceX}mm`, top: `${priceY}mm`, fontSize: `${priceFontSize}px`, fontWeight: 'bold', color: '#000', display: 'flex', gap: '4px' }}><span style={{ textDecoration: 'line-through' }}>MRP: ₹{item.product.mrp || item.product.price}</span><span>Sale: ₹{item.product.price}</span></div></div>)))}</div></div></div>

    </div>
  );
}