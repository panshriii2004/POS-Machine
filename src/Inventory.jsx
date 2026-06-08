import React, { useState, useRef } from 'react';
import Barcode from 'react-barcode';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js'; // 🔥 NEW: AI Image Reader!

export default function Inventory({ products, setProducts, storeDetails }) {
  const [search, setSearch] = useState('');
  
  // --- Filter States ---
  const [stockFilter, setStockFilter] = useState('all'); 
  const [categoryFilter, setCategoryFilter] = useState('all');
  const categories = ['Saree', 'Jeans', 'T-Shirt', 'Shirt', 'Kurta', 'Trouser', 'Other'];
  
  // --- Product Form State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Saree'); 
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [stock, setStock] = useState('');
  const [barcodeStr, setBarcodeStr] = useState('');

  // --- Print Studio State ---
  const [showPrintStudio, setShowPrintStudio] = useState(false);
  const [printQueue, setPrintQueue] = useState([]);
  const [labelFormat, setLabelFormat] = useState('thermal'); 
  const printRef = useRef(null);

  // --- Image Scanning State ---
  const [isScanningImage, setIsScanningImage] = useState(false);

  // Refs
  const nameRef = useRef(null);
  const mrpRef = useRef(null);
  const priceRef = useRef(null);
  const stockRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const submitBtnRef = useRef(null);
  const fileImportRef = useRef(null); 
  const imageImportRef = useRef(null); // 🔥 NEW: Ref for Image Upload

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) nextRef.current.focus();
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search));
    const matchesStock = 
      stockFilter === 'all' ? true :
      stockFilter === 'low' ? (p.stock > 0 && p.stock <= 5) :
      stockFilter === 'out' ? (p.stock <= 0) : true;
    const matchesCategory = categoryFilter === 'all' ? true : p.category === categoryFilter;
    return matchesSearch && matchesStock && matchesCategory;
  });

  // --- Smart Excel & CSV Importer ---
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
      console.error("Error reading file:", error);
      alert("❌ Failed to read the Excel file.");
    }
    
    e.target.value = null; 
  };

  // 🔥 NEW: AI Image Text Extraction
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
        
        // Only process lines that have a decent length (avoids random stray letters)
        if (cleanLine.length > 3) {
          
          // AI Regex: Tries to find a price formatted like 199.99 or 500 in the line
          const priceMatch = cleanLine.match(/[\d]+(\.\d{1,2})?/);
          const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
          
          // AI Regex: Strips out numbers and symbols to guess the Product Name
          let name = cleanLine.replace(/[\d]+(\.\d{1,2})?/, '').replace(/[^a-zA-Z\s-]/g, '').trim();

          // Only save if it actually looks like a real word/product name
          if (name.length > 2) {
            newProducts.push({
              id: Date.now() + index,
              name: name,
              category: 'Other',
              price: price,
              mrp: price,
              stock: 0, // Hard to reliably extract stock from photos, set to 0 for manual review
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
      console.error("Image Scan Error:", error);
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

  // --- Advanced Drag-and-Drop Print Settings ---
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
    <div className="p-6 h-full flex flex-col gap-6 overflow-hidden bg-slate-50 font-sans relative">
      
      {/* OVERLAY: AI Scanning Loading Screen */}
      {isScanningImage && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Reading Image...</h2>
          <p className="text-slate-400 mt-2">The AI is extracting product names and prices. This may take a few seconds.</p>
        </div>
      )}

      {/* HEADER & TOP BUTTONS */}
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Total Unique Items: {products.length}</p>
        </div>
        
        <div className="flex gap-3">
          
          {/* File Inputs (Hidden) */}
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={fileImportRef} onChange={handleImportFile} className="hidden" />
          <input type="file" accept="image/*" ref={imageImportRef} onChange={handleImageImport} className="hidden" />
          
          {/* 🔥 NEW: Image Scan Button */}
          <button 
            onClick={() => imageImportRef.current.click()} 
            className="bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm flex items-center gap-2"
          >
            📷 Scan Image
          </button>

          <button 
            onClick={() => fileImportRef.current.click()} 
            className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm flex items-center gap-2"
          >
            📥 Import Excel
          </button>

          <button 
            onClick={() => setShowPrintStudio(true)} 
            className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold py-2.5 px-5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            🖨️ Print Studio
            {printQueue.length > 0 && (
              <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">{printQueue.reduce((sum, item) => sum + item.qty, 0)}</span>
            )}
          </button>
        </div>
      </div>

      {/* INVENTORY FORM */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">{isEditing ? '✏️ Edit Product' : '📦 Add New Product'}</h2>
          {isEditing && <button onClick={resetForm} className="text-sm font-bold text-blue-600 hover:text-blue-800 underline">Cancel Edit</button>}
        </div>
        
        <form onSubmit={handleSaveProduct} className="flex flex-wrap gap-4 items-end">
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name *</label>
            <input ref={nameRef} onKeyDown={e => handleKeyDown(e, mrpRef)} required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" autoFocus />
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          
          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MRP (₹)</label>
            <input ref={mrpRef} onKeyDown={e => handleKeyDown(e, priceRef)} type="number" step="0.01" value={mrp} onChange={e => setMrp(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>

          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sale Price *</label>
            <input ref={priceRef} onKeyDown={e => handleKeyDown(e, stockRef)} required type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2.5 border border-emerald-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-700 font-bold" />
          </div>

          <div className="flex-1 min-w-[80px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock</label>
            <input ref={stockRef} onKeyDown={e => handleKeyDown(e, barcodeInputRef)} type="number" value={stock} onChange={e => setStock(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>

          <div className="flex-[1.5] min-w-[180px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode (SKU) *</label>
            <div className="flex gap-1">
              <input ref={barcodeInputRef} onKeyDown={e => handleKeyDown(e, submitBtnRef)} required type="text" value={barcodeStr} onChange={e => setBarcodeStr(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono" />
              <button type="button" onClick={() => { setBarcodeStr(Date.now().toString().slice(-10)); if(barcodeInputRef.current) barcodeInputRef.current.focus(); }} className="bg-slate-200 hover:bg-slate-300 px-3 rounded-lg font-bold" title="Generate New Barcode">↻</button>
            </div>
          </div>

          <button ref={submitBtnRef} type="submit" className={`${isEditing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold px-8 py-2.5 rounded-lg transition-colors h-[46px] shadow-sm`}>
            {isEditing ? 'Update' : '+ Add'}
          </button>
        </form>
      </div>

      {/* INVENTORY LIST WITH FILTERS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
          <h3 className="font-bold text-slate-800 shrink-0">Product Database</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="all">All Stock Levels</option>
              <option value="low">⚠️ Low Stock (1-5)</option>
              <option value="out">🚫 Out of Stock (0)</option>
            </select>

            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="all">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 text-sm">🔍</span>
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-48 md:w-64 text-sm" />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <tr className="text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="p-4 font-bold">Product & Category</th>
                <th className="p-4 font-bold text-center">Stock</th>
                <th className="p-4 font-bold text-right">MRP</th>
                <th className="p-4 font-bold text-right text-emerald-600">Sale Price</th>
                <th className="p-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                let rowBg = "hover:bg-slate-50";
                if (p.stock <= 0) rowBg = "bg-red-50 hover:bg-red-100";
                else if (p.stock <= 5) rowBg = "bg-yellow-50 hover:bg-yellow-100";

                return (
                  <tr key={p.id} className={`${rowBg} transition-colors`}>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="bg-blue-100 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">{p.category || 'Other'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">#{p.barcode}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        p.stock <= 0 ? 'bg-red-600 text-white' : 
                        p.stock <= 5 ? 'bg-yellow-500 text-white' : 
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-400 line-through text-sm">₹{p.mrp || p.price}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">₹{p.price.toFixed(2)}</td>
                    <td className="p-4 text-center space-x-2">
                      <button onClick={() => { addToPrintQueue(p); setShowPrintStudio(true); }} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded transition-colors" title="Print Labels">🖨️</button>
                      <button onClick={() => editProduct(p)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-colors" title="Edit">✏️</button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-colors" title="Delete">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* 🖨️ MODAL: MASTER LABEL PRINT STUDIO        */}
      {/* ========================================= */}
      {showPrintStudio && (
        <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col p-4 md:p-8">
          <div className="bg-white flex-1 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300 relative animate-fade-in-down">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-indigo-50 shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">🖨️ Label Print Studio</h2>
                <p className="text-indigo-700 text-sm mt-1">Design and print barcode stickers for your physical store shelves.</p>
              </div>
              <button onClick={() => setShowPrintStudio(false)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white rounded-full text-slate-600 font-bold transition-colors shadow-sm">✕</button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              
              <div className="w-full md:w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 shrink-0">
                  <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">1. Select Products</h3>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-sm">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Search to add..." 
                      value={search} 
                      onChange={(e) => setSearch(e.target.value)} 
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 transition-colors">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 text-sm truncate">{product.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{product.barcode}</p>
                      </div>
                      <button onClick={() => addToPrintQueue(product)} className="bg-indigo-100 hover:bg-indigo-600 hover:text-white text-indigo-700 w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors shrink-0 text-xl leading-none">
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-2/3 flex flex-col bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-bold text-slate-600 uppercase">Printer Format:</label>
                    <select value={labelFormat} onChange={(e) => setLabelFormat(e.target.value)} className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 cursor-pointer outline-none shadow-sm">
                      <option value="thermal">Thermal Roll (50mm x 25mm)</option>
                      <option value="a4">Standard A4 Sheet (Grid)</option>
                    </select>
                  </div>
                  
                  <button 
                    onClick={handlePrintLabels}
                    disabled={printQueue.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    🖨️ Print {printQueue.reduce((sum, item) => sum + item.qty, 0)} Labels
                  </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  <div className="w-1/2 p-4 overflow-y-auto border-r border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">2. Label Design</h3>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex gap-2">
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Width (mm)</label><input type="number" value={labelWidth} onChange={e => setLabelWidth(Number(e.target.value))} className="w-full p-2 text-sm border rounded focus:ring-2 outline-none" /></div>
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Height (mm)</label><input type="number" value={labelHeight} onChange={e => setLabelHeight(Number(e.target.value))} className="w-full p-2 text-sm border rounded focus:ring-2 outline-none" /></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grid Columns</label><input type="number" min="1" value={labelColumns} onChange={e => setLabelColumns(Number(e.target.value))} className="w-full p-2 text-sm border rounded focus:ring-2 outline-none" /></div>
                        <div className="flex-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gap (mm)</label><input type="number" step="0.5" value={colGap} onChange={e => setColGap(Number(e.target.value))} className="w-full p-2 text-sm border rounded focus:ring-2 outline-none" /></div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-5">
                      <div>
                        <p className="text-[11px] font-bold text-blue-800 uppercase mb-1 flex items-center justify-between"><span>📝 Product Name</span><span>{titleFontSize}px</span></p>
                        <input type="range" min="6" max="30" value={titleFontSize} onChange={e => setTitleFontSize(Number(e.target.value))} className="w-full mb-2" />
                        <div className="flex gap-2">
                          <label className="flex-1 text-[9px] text-slate-500">Left: <input type="range" min="0" max={labelWidth} step="0.5" value={titleX} onChange={e => setTitleX(Number(e.target.value))} className="w-full" /></label>
                          <label className="flex-1 text-[9px] text-slate-500">Top: <input type="range" min="0" max={labelHeight} step="0.5" value={titleY} onChange={e => setTitleY(Number(e.target.value))} className="w-full" /></label>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-blue-800 uppercase mb-1 flex items-center justify-between"><span>🦓 Barcode</span></p>
                        <div className="flex gap-2">
                          <label className="flex-1 text-[9px] text-slate-500">Left: <input type="range" min="0" max={labelWidth} step="0.5" value={barcodeX} onChange={e => setBarcodeX(Number(e.target.value))} className="w-full" /></label>
                          <label className="flex-1 text-[9px] text-slate-500">Top: <input type="range" min="0" max={labelHeight} step="0.5" value={barcodeY} onChange={e => setBarcodeY(Number(e.target.value))} className="w-full" /></label>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-blue-800 uppercase mb-1 flex items-center justify-between"><span>💰 Price</span><span>{priceFontSize}px</span></p>
                        <input type="range" min="6" max="30" value={priceFontSize} onChange={e => setPriceFontSize(Number(e.target.value))} className="w-full mb-2" />
                        <div className="flex gap-2">
                          <label className="flex-1 text-[9px] text-slate-500">Left: <input type="range" min="0" max={labelWidth} step="0.5" value={priceX} onChange={e => setPriceX(Number(e.target.value))} className="w-full" /></label>
                          <label className="flex-1 text-[9px] text-slate-500">Top: <input type="range" min="0" max={labelHeight} step="0.5" value={priceY} onChange={e => setPriceY(Number(e.target.value))} className="w-full" /></label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-1/2 flex flex-col bg-slate-100">
                    <div className="p-4 border-b border-slate-200">
                       <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">3. Adjust Quantities</h3>
                       <div className="max-h-32 overflow-y-auto space-y-2">
                         {printQueue.map(item => (
                           <div key={item.product.id} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded shadow-sm text-sm">
                             <span className="font-bold text-slate-800 truncate pr-2">{item.product.name}</span>
                             <div className="flex items-center gap-2 shrink-0">
                               <button onClick={() => updatePrintQty(item.product.id, -1)} className="w-6 h-6 rounded bg-slate-100 font-bold">-</button>
                               <span className="w-4 text-center font-bold">{item.qty}</span>
                               <button onClick={() => updatePrintQty(item.product.id, 1)} className="w-6 h-6 rounded bg-slate-100 font-bold">+</button>
                               <button onClick={() => removeFromPrintQueue(item.product.id)} className="ml-2 text-red-500 font-bold">✕</button>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto flex justify-center items-start">
                      {printQueue.length > 0 && (
                        <div 
                          className="bg-white p-4 shadow-md" 
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: `repeat(${labelColumns}, max-content)`, 
                            rowGap: `${rowGap}mm`,
                            columnGap: `${colGap}mm`,
                            justifyContent: 'center' 
                          }}
                        >
                          {printQueue.flatMap(item => 
                            Array.from({ length: item.qty }).map((_, i) => (
                              <div 
                                key={`${item.product.id}-${i}`} 
                                style={{ width: `${labelWidth}mm`, height: `${labelHeight}mm`, position: 'relative', overflow: 'hidden', backgroundColor: 'white', border: '1px dashed #ccc' }} 
                              >
                                <div style={{ position: 'absolute', left: `${titleX}mm`, top: `${titleY}mm`, fontSize: `${titleFontSize}px`, fontWeight: 'bold', color: '#000', lineHeight: '1.1', width: `${labelWidth - titleX}mm`, whiteSpace: 'nowrap' }}>
                                  {item.product.name}
                                </div>
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

      {/* 👻 HIDDEN REAL PRINT TEMPLATES */}
      <div className="hidden">
        <div ref={printRef} className="print-container">
          <style type="text/css" media="print">
            {`
              @page { 
                size: ${labelFormat === 'thermal' ? `${labelWidth}mm ${labelHeight}mm` : 'A4'}; 
                margin: ${labelFormat === 'thermal' ? '0' : '10mm'}; 
              }
              body { margin: 0; padding: 0; font-family: sans-serif; }
              * { box-sizing: border-box; }
            `}
          </style>

          <div style={labelFormat === 'a4' ? { display: 'grid', gridTemplateColumns: `repeat(${labelColumns}, max-content)`, rowGap: `${rowGap}mm`, columnGap: `${colGap}mm`, justifyContent: 'center' } : {}}>
            {printQueue.flatMap(item => 
              Array.from({ length: item.qty }).map((_, i) => (
                <div 
                  key={`${item.product.id}-${i}`} 
                  style={{ 
                    width: `${labelWidth}mm`, 
                    height: `${labelHeight}mm`, 
                    position: 'relative',
                    overflow: 'hidden', 
                    backgroundColor: 'white',
                    pageBreakAfter: labelFormat === 'thermal' ? 'always' : 'auto',
                    border: labelFormat === 'a4' ? '1px dashed #ccc' : 'none'
                  }} 
                >
                  <div style={{ position: 'absolute', left: `${titleX}mm`, top: `${titleY}mm`, fontSize: `${titleFontSize}px`, fontWeight: 'bold', color: '#000', lineHeight: '1.1', width: `${labelWidth - titleX}mm`, whiteSpace: 'nowrap' }}>
                    {item.product.name}
                  </div>
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
        </div>
      </div>

    </div>
  );
}