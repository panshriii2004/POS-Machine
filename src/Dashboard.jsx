import React, { useState, useRef, useEffect } from 'react';
import Barcode from 'react-barcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useReactToPrint } from 'react-to-print';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase'; 

const CameraScanner = ({ onScan, onClose }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 20, qrbox: { width: 300, height: 100 } }, false);
    scanner.render(
      (decodedText) => { 
        try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(e) {}
        onScan(decodedText); 
        scanner.clear(); 
      },
      (error) => { /* ignore */ }
    );
    return () => { scanner.clear().catch(e => console.error(e)); };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white p-4 rounded-xl shadow-2xl w-full max-w-lg flex flex-col border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl text-slate-800">📷 Scan Barcode</h3>
          <button onClick={onClose} className="text-white bg-red-500 font-bold hover:bg-red-600 px-4 py-2 rounded-lg transition-colors">Cancel</button>
        </div>
        <div id="reader" className="w-full overflow-hidden rounded-lg border-2 border-slate-300"></div>
      </div>
    </div>
  );
};

export default function Dashboard({ 
  currentUser, products, setProducts, billHistory = [], setBillHistory, storeDetails, printerSize,
  carts, setCarts, activeCartId, setActiveCartId, customers, setCustomers,
  isSidebarHidden, showSidebar // 🔥 The new props!
}) {
  const [search, setSearch] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [editItemModal, setEditItemModal] = useState(null);

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);

  const receiptRef = useRef(null);
  const scannerInputRef = useRef(null);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
  const discountRef = useRef(null);
  const gstRef = useRef(null);
  const reviewBtnRef = useRef(null);
  const doneBtnRef = useRef(null);

  const activeCart = carts.find(c => c.id === activeCartId) || carts[0];
  
  const updateCart = (key, value) => {
    setCarts(prevCarts => {
      const targetId = prevCarts.find(c => c.id === activeCartId) ? activeCartId : prevCarts[0].id;
      return prevCarts.map(c => c.id === targetId ? { ...c, [key]: value } : c);
    });
  };

  const subtotal = activeCart.invoice.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const safeDiscountRate = Number(activeCart.discountPercent) || 0;
  const safeGstRate = Number(activeCart.gstPercent) || 0;
  const discountAmount = subtotal * (safeDiscountRate / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const gstAmount = discountedSubtotal * (safeGstRate / 100);
  const total = discountedSubtotal + gstAmount;

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const handlePrintReceipt = useReactToPrint({ contentRef: receiptRef, content: () => receiptRef.current, documentTitle: 'Customer_Receipt' });

  const nameSuggestions = activeCart.customerName.trim().length > 0 
    ? customers.filter(c => c.name.toLowerCase().includes(activeCart.customerName.toLowerCase()))
    : [];

  const phoneSuggestions = activeCart.customerPhone.trim().length > 0 
    ? customers.filter(c => c.phone && c.phone !== 'N/A' && c.phone.includes(activeCart.customerPhone))
    : [];

  const handleSelectCustomer = (customer) => {
    setCarts(prevCarts => {
      const targetId = prevCarts.find(c => c.id === activeCartId) ? activeCartId : prevCarts[0].id;
      return prevCarts.map(c => {
        if (c.id === targetId) {
          return {
            ...c,
            customerName: customer.name,
            customerPhone: customer.phone === 'N/A' ? '' : customer.phone
          };
        }
        return c;
      });
    });
    
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
    setTimeout(() => discountRef.current?.focus(), 100); 
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (showReceiptModal || editItemModal || isCameraOpen) return;
      if (e.key === 'Enter') {
        if (document.activeElement === document.body) {
          e.preventDefault();
          if (activeCart.invoice.length === 0) {
            scannerInputRef.current?.focus();
          } else {
            customerNameRef.current?.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeCart.invoice.length, showReceiptModal, editItemModal, isCameraOpen]);

  useEffect(() => {
    if (showReceiptModal) {
      setTimeout(() => doneBtnRef.current?.focus(), 100);
    }
  }, [showReceiptModal]);

  const handleNextFocus = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowNameSuggestions(false);
      setShowPhoneSuggestions(false);
      nextRef.current?.focus();
    }
  };

  const addToInvoice = (product) => {
    if (product.stock <= 0) {
      alert(`Out of stock! You don't have any '${product.name}' left.`);
      return; 
    }

    const targetCartId = carts.find(c => c.id === activeCartId) ? activeCartId : carts[0].id;
    const currentCart = carts.find(c => c.id === targetCartId);
    const existingItem = currentCart.invoice.find(i => i.id === product.id);

    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: p.stock - 1 } : p));

    setCarts(prevCarts => {
      return prevCarts.map(c => {
        if (c.id === targetCartId) {
          if (existingItem) {
            return { ...c, invoice: c.invoice.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) };
          } else {
            return { ...c, invoice: [...c.invoice, { ...product, quantity: 1, basePrice: product.price }] };
          }
        }
        return c;
      });
    });
  };

  const updateQuantity = (id, delta) => {
    const cartItem = activeCart.invoice.find(i => i.id === id);
    if (!cartItem) return;
    if (delta === -1 && cartItem.quantity <= 1) return; 

    const inventoryProduct = products.find(p => p.id === id);

    if (delta === 1) {
      if (inventoryProduct.stock <= 0) {
        alert(`Out of stock!`);
        return; 
      }
    }

    setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: p.stock - delta } : p));

    setCarts(prevCarts => {
      const targetCartId = prevCarts.find(c => c.id === activeCartId) ? activeCartId : prevCarts[0].id;
      return prevCarts.map(c => {
        if (c.id === targetCartId) return { ...c, invoice: c.invoice.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item) };
        return c;
      });
    });
  };

  const removeFromInvoice = (id) => {
    const cartItem = activeCart.invoice.find(i => i.id === id);
    if (cartItem) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: p.stock + cartItem.quantity } : p));
    }

    setCarts(prevCarts => {
      const targetCartId = prevCarts.find(c => c.id === activeCartId) ? activeCartId : prevCarts[0].id;
      return prevCarts.map(c => {
        if (c.id === targetCartId) return { ...c, invoice: c.invoice.filter((item) => item.id !== id) };
        return c;
      });
    });
  };

  const openEditModal = (item) => {
    setEditItemModal({ ...item, basePrice: item.basePrice || item.price, newPrice: item.price, discountType: item.itemDiscountType || '₹', discountValue: item.itemDiscountValue || '' });
  };

  const handleItemDiscountChange = (type, value) => {
    let val = value === '' ? '' : parseFloat(value);
    let calculatedPrice = editItemModal.basePrice;
    if (val !== '' && !isNaN(val)) {
      if (type === '%') calculatedPrice = editItemModal.basePrice - (editItemModal.basePrice * (val / 100));
      else if (type === '₹') calculatedPrice = editItemModal.basePrice - val;
    }
    setEditItemModal({ ...editItemModal, discountType: type, discountValue: value, newPrice: Math.max(0, calculatedPrice) });
  };

  const handleItemPriceChange = (value) => {
    let val = value === '' ? '' : parseFloat(value);
    setEditItemModal({ ...editItemModal, newPrice: val, discountType: 'none', discountValue: '' });
  };

  const saveItemEdit = () => {
    const finalPrice = parseFloat(editItemModal.newPrice);
    if (isNaN(finalPrice) || finalPrice < 0) return alert("Please enter a valid price.");
    updateCart('invoice', activeCart.invoice.map(item => item.id === editItemModal.id ? { ...item, price: finalPrice, itemDiscountType: editItemModal.discountType, itemDiscountValue: editItemModal.discountValue, basePrice: editItemModal.basePrice } : item));
    setEditItemModal(null);
  };

  const addNewCart = () => {
    const newCartId = Date.now();
    const newCart = { id: newCartId, title: `Cart ${carts.length + 1}`, invoice: [], customerName: '', customerPhone: '', discountPercent: '', gstPercent: '', paymentMethod: 'Cash' };
    setCarts([...carts, newCart]);
    setActiveCartId(newCartId);
  };

  const closeCart = (idToClose) => {
    const cartToClose = carts.find(c => c.id === idToClose);
    if (cartToClose.invoice.length > 0) {
      if (!window.confirm(`Cancel this bill? Items will be returned to stock.`)) return;
      
      let currentProducts = [...products];
      cartToClose.invoice.forEach(cartItem => {
        const index = currentProducts.findIndex(p => p.id === cartItem.id);
        if (index >= 0) currentProducts[index].stock += cartItem.quantity;
      });
      setProducts(currentProducts);
    }
    
    if (carts.length === 1) {
      const newCartId = Date.now();
      setCarts([{ id: newCartId, title: 'Cart 1', invoice: [], customerName: '', customerPhone: '', discountPercent: '', gstPercent: '', paymentMethod: 'Cash' }]);
      setActiveCartId(newCartId);
    } else {
      const remainingCarts = carts.filter(c => c.id !== idToClose);
      setCarts(remainingCarts);
      if (activeCartId === idToClose) setActiveCartId(remainingCarts[0].id);
    }
  };

  const createNewProduct = () => {
    const newProduct = { id: Date.now(), name: search, price: 0, stock: 100, barcode: Date.now().toString().slice(-10) };
    setProducts(prev => [...prev, newProduct]);
    setTimeout(() => addToInvoice(newProduct), 0);
    setSearch('');
  };

  const processScannedCode = (scannedCode) => {
    const foundProduct = products.find(p => p.barcode === scannedCode);
    if (foundProduct) addToInvoice(foundProduct);
    else alert(`Barcode ${scannedCode} not found!`);
  };

  const handleUSBScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      if (scanInput.trim()) {
        processScannedCode(scanInput.trim()); 
        setScanInput(''); 
      } else {
        if (activeCart.invoice.length > 0) {
          customerNameRef.current?.focus();
        }
      }
    }
  };

  const handleReviewClick = () => {
    if (activeCart.paymentMethod === 'Credit' && activeCart.customerName.trim() === '') {
      alert("⚠️ Customer Name is required for Credit sales!");
      return; 
    }
    setShowReceiptModal(true); 
  };

  const handleCompleteSale = async () => {
    setShowReceiptModal(false); 

    const newBill = {
      id: Date.now().toString().slice(-6),
      date: new Date().toLocaleString(),
      cashierName: currentUser?.name || 'Admin',
      cashierId: currentUser?.id || 'admin',
      customerName: activeCart.customerName.trim() || 'Walk-in Customer',
      customerPhone: activeCart.customerPhone || 'N/A',
      paymentMethod: activeCart.paymentMethod, 
      items: [...activeCart.invoice],
      subtotal: subtotal,
      discountPercent: safeDiscountRate,
      discountAmount: discountAmount,
      gstPercent: safeGstRate,
      gstAmount: gstAmount,
      tax: gstAmount, 
      total: total
    };
    
    if (setBillHistory) setBillHistory([newBill, ...billHistory]);

    if (activeCart.customerPhone || activeCart.customerName.trim() !== '') {
      const phone = activeCart.customerPhone || 'N/A';
      const name = activeCart.customerName.trim() || 'Walk-in Customer';
      const isCredit = activeCart.paymentMethod === 'Credit';
      const amountAddedToCredit = isCredit ? total : 0;

      const existingCustomer = customers.find(c => c.phone === phone && phone !== 'N/A') || customers.find(c => c.name === name);

      if (existingCustomer) {
        setCustomers(customers.map(c => c.id === existingCustomer.id ? {
          ...c,
          totalSpent: (c.totalSpent || 0) + total,
          creditDue: (c.creditDue || 0) + amountAddedToCredit,
          lastVisit: new Date().toLocaleDateString()
        } : c));
      } else {
        setCustomers([...customers, {
          id: Date.now().toString(),
          name: name,
          phone: phone,
          totalSpent: total,
          creditDue: amountAddedToCredit,
          lastVisit: new Date().toLocaleDateString()
        }]);
      }
    }

    try {
      await addDoc(collection(db, "print_queue"), {
        cart: activeCart,
        storeDetails: storeDetails,
        cashierName: currentUser?.name || 'Admin',
        subtotal: subtotal,
        total: total,
        status: "pending",
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to send to cloud queue:", err);
    }

    if (carts.length === 1) {
      const newCartId = Date.now();
      setCarts([{ id: newCartId, title: 'Cart 1', invoice: [], customerName: '', customerPhone: '', discountPercent: '', gstPercent: '', paymentMethod: 'Cash' }]);
      setActiveCartId(newCartId);
    } else {
      const remainingCarts = carts.filter(c => c.id !== activeCartId);
      setCarts(remainingCarts);
      setActiveCartId(remainingCarts[0].id);
    }
    
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans relative overflow-hidden">
      
      {/* 🔥 THE FIXED DASHBOARD BUTTON: Always stays in the top-left over everything */}
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="fixed top-3 left-3 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* Adjusted padding to respect the new custom fixed button on Dashboard */}
      <div className={`bg-white border-b border-slate-200 pr-4 py-3 flex items-center gap-2 overflow-x-auto shrink-0 shadow-sm z-10 min-h-[50px] ${isSidebarHidden ? 'pl-16 md:pl-20' : 'pl-4'}`}>
        {carts.map(cart => (
          <div key={cart.id} onClick={() => setActiveCartId(cart.id)} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm cursor-pointer transition-all border-b-2 whitespace-nowrap ${activeCartId === cart.id ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-500 hover:bg-slate-100 border-transparent'}`}>
            <span>{cart.title}</span>
            <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">{cart.invoice.length}</span>
            <button onClick={(e) => { e.stopPropagation(); closeCart(cart.id); }} className="ml-1 text-slate-400 hover:text-red-500 font-bold">✕</button>
          </div>
        ))}
        <button onClick={addNewCart} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors ml-2 whitespace-nowrap">
          + New Cart
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 p-2 pt-3 md:px-4 md:pb-4 md:pt-3 gap-3 overflow-y-auto lg:overflow-hidden relative">
        
        {isCameraOpen && <CameraScanner onScan={(code) => { processScannedCode(code); setIsCameraOpen(false); }} onClose={() => setIsCameraOpen(false)} />}

        {editItemModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative">
              <button onClick={() => setEditItemModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 font-bold text-lg">✕</button>
              <h3 className="font-bold text-xl text-slate-800 mb-1">Edit Item</h3>
              <p className="text-sm font-semibold text-blue-600 mb-4">{editItemModal.name}</p>

              <div className="space-y-5">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Original Price</span>
                  <span className="font-bold text-slate-800 text-lg">₹{editItemModal.basePrice.toFixed(2)}</span>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Apply Discount</label>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => handleItemDiscountChange('%', editItemModal.discountValue)} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${editItemModal.discountType === '%' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600'}`}>% Percentage</button>
                    <button onClick={() => handleItemDiscountChange('₹', editItemModal.discountValue)} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${editItemModal.discountType === '₹' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600'}`}>₹ Rupee</button>
                  </div>
                  <input type="number" value={editItemModal.discountValue} onChange={(e) => handleItemDiscountChange(editItemModal.discountType, e.target.value)} placeholder="Enter discount amount..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Final Unit Price (₹)</label>
                  <input type="number" step="0.01" value={editItemModal.newPrice} onChange={(e) => handleItemPriceChange(e.target.value)} className="w-full p-3 font-bold text-lg text-emerald-700 border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={saveItemEdit} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-sm">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {showReceiptModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-100 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto w-full max-w-sm relative">
              <button onClick={() => setShowReceiptModal(false)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-500 hover:text-white rounded-full text-slate-600 font-bold transition-colors shadow-sm">✕</button>
              <div ref={receiptRef} className={`p-4 bg-white text-black font-mono shadow-sm ${printerSize === '58mm' ? 'w-[220px] text-[11px]' : 'w-[300px] text-sm'} mt-4`}>
                <h2 className="text-center font-bold mb-1 uppercase leading-tight" style={{ fontSize: printerSize === '58mm' ? '14px' : '18px' }}>{storeDetails?.name || 'STOREFRONT POS'}</h2>
                <div className="text-center text-slate-600 mb-2 leading-tight" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>
                  {storeDetails?.address && <div>{storeDetails.address}</div>}
                  {storeDetails?.phone && <div>Ph: {storeDetails.phone}</div>}
                  {storeDetails?.gstNo && <div>GSTIN: <span className="uppercase">{storeDetails.gstNo}</span></div>}
                </div>
                <p className="text-center text-slate-500 mb-2 mt-3 border-b-2 border-dashed border-slate-300 pb-2" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>Receipt: #{Date.now().toString().slice(-6)}</p>
                <div className="text-slate-600 mb-2 border-b border-dashed border-slate-300 pb-2" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>
                  <div>Customer: {activeCart.customerName.trim() || 'Walk-in Customer'}</div>
                  {activeCart.customerPhone && <div>Phone: {activeCart.customerPhone}</div>}
                  {currentUser?.role === 'admin' && <div className="mt-1 text-slate-400">Served By: {currentUser.name}</div>}
                </div>
                <div className="flex justify-between font-bold mb-2"><span>ITEM</span><span>TOTAL</span></div>
                <div className="space-y-3 mb-4">
                  {activeCart.invoice.map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between"><span className="truncate pr-2">{item.name}</span><span>₹{(item.price * item.quantity).toFixed(2)}</span></div>
                      <div className="text-slate-500" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>{item.quantity} x ₹{item.price.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-dashed border-slate-300 mt-4 pt-4">
                  <div className="flex justify-between text-slate-600 mb-1"><span>Subtotal:</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-slate-600 mb-1"><span>Discount ({safeDiscountRate}%):</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
                  {gstAmount > 0 && <div className="flex justify-between text-slate-600 mb-2"><span>GST ({safeGstRate}%):</span><span>+₹{gstAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-slate-800" style={{ fontSize: printerSize === '58mm' ? '14px' : '18px' }}><span>TOTAL:</span><span>₹{total.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600 font-bold mt-2 border-t border-slate-300 pt-2" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}><span>Paid By:</span><span className="uppercase">{activeCart.paymentMethod}</span></div>
                </div>
                <p className="text-center text-slate-500 mt-6" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>Thank you for shopping with us!</p>
              </div>
              <div className="flex gap-3 mt-6 w-full">
                <button onClick={handlePrintReceipt} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-sm">🖨️ Print Bill</button>
                <button ref={doneBtnRef} onClick={handleCompleteSale} className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition shadow-sm">Done & Save</button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full lg:w-7/12 xl:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 flex flex-col min-h-[50vh] lg:h-full shrink-0 lg:shrink">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 shrink-0">
            <h2 className="text-2xl font-bold text-slate-800 hidden md:block">Products</h2>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex flex-1 items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 shadow-sm min-w-[150px]">
                <span className="text-emerald-600 font-bold">⌨️ USB:</span>
                <input 
                  ref={scannerInputRef} 
                  type="text" 
                  className="bg-white border border-emerald-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full" 
                  placeholder="Scan here..." 
                  value={scanInput} 
                  onChange={(e) => setScanInput(e.target.value)} 
                  onKeyDown={handleUSBScan} 
                  autoFocus 
                />
              </div>
              <button onClick={() => setIsCameraOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm transition-colors h-[42px] whitespace-nowrap">
                📱 Camera
              </button>
            </div>
          </div>
          
          <div className="relative mb-4 shrink-0">
            <input type="text" className="w-full p-3 md:p-4 pl-4 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" placeholder="Search products by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {filteredProducts.length === 0 && search && (
            <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-3">
              <span className="text-blue-800 text-center sm:text-left">No product found for "<strong>{search}</strong>"</span>
              <button onClick={createNewProduct} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition w-full sm:w-auto">+ Create & Add</button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1 pb-4 flex-1">
            {filteredProducts.map((product) => {
              let cardBg = "bg-white border-slate-200 hover:border-blue-500";
              if (product.stock <= 0) cardBg = "bg-red-100 border-red-300 opacity-70 cursor-not-allowed";
              else if (product.stock <= 5) cardBg = "bg-yellow-100 border-yellow-400 hover:border-yellow-500";

              return (
                <div 
                  key={product.id} 
                  onClick={() => addToInvoice(product)} 
                  className={`p-3 border rounded-xl shadow-sm transition-all group flex flex-col justify-between ${cardBg}`}
                >
                  <div>
                    <h3 className={`font-semibold text-sm md:text-base line-clamp-2 leading-tight ${product.stock <= 0 ? 'text-red-700' : 'text-slate-800 group-hover:text-blue-600'}`}>
                      {product.name}
                    </h3>
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center mt-2 gap-1">
                      <span className="text-base font-bold text-slate-900">₹{product.price.toFixed(2)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block w-max
                        ${product.stock <= 0 ? 'bg-red-600 text-white' : 
                          product.stock <= 5 ? 'bg-yellow-600 text-white' : 
                          'bg-slate-100 text-slate-500'}`}>
                        Stock: {product.stock}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-center bg-white p-1 rounded border border-slate-100 mt-3 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Barcode value={product.barcode} height={20} width={1.2} fontSize={10} background="transparent" margin={0} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full lg:w-5/12 xl:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 flex flex-col flex-1 lg:h-full shrink-0 lg:shrink">
          
          <div className="flex-grow overflow-y-auto pr-1 mb-4 space-y-3">
            {activeCart.invoice.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[150px]">
                <p>Your cart is empty.</p>
                <p className="text-sm">Click products or scan to add.</p>
              </div>
            ) : (
              activeCart.invoice.map((item) => (
                <div key={item.id} className="flex flex-col xl:flex-row justify-between items-start xl:items-center p-3 bg-slate-50 rounded-lg border border-slate-100 gap-2">
                  <div className="flex-1 w-full break-words pr-2">
                    <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mb-1">#{item.barcode}</p>
                    
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        ₹{item.price.toFixed(2)} / each
                        <button onClick={() => openEditModal(item)} className="text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold px-2 py-0.5 rounded" title="Edit Price & Discount">✏️ Edit</button>
                      </div>
                      {item.basePrice > item.price && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                          Discounted from ₹{item.basePrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full xl:w-auto justify-between xl:flex-col items-center xl:items-end gap-2 xl:gap-0 mt-2 xl:mt-0">
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-full bg-white border shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold">-</button>
                      <span className="font-semibold w-4 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-full bg-white border shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold">+</button>
                    </div>
                    <div className="flex items-center gap-3 xl:mt-2">
                      <p className="font-bold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                      <button onClick={() => removeFromInvoice(item.id)} className="text-red-400 hover:text-red-600 text-xs font-bold bg-white px-2 py-1 rounded border shadow-sm">✕</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 shrink-0">
            
            <div className="mb-4 space-y-3">
              <div className="relative">
                <input 
                  ref={customerNameRef}
                  onKeyDown={e => handleNextFocus(e, customerPhoneRef)}
                  type="text" 
                  placeholder={activeCart.paymentMethod === 'Credit' ? "Customer Name (REQUIRED) *" : "Customer Name"} 
                  value={activeCart.customerName} 
                  onChange={(e) => {
                    updateCart('customerName', e.target.value);
                    setShowNameSuggestions(true);
                  }} 
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                  className={`w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${activeCart.paymentMethod === 'Credit' && !activeCart.customerName.trim() ? 'border-red-400 bg-red-50 placeholder-red-400' : 'border-slate-300'}`} 
                />
                
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {nameSuggestions.map(c => (
                      <div 
                        key={c.id} 
                        onMouseDown={(e) => { e.preventDefault(); handleSelectCustomer(c); }} 
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.phone !== 'N/A' ? `📞 ${c.phone}` : 'No phone number'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <input 
                  ref={customerPhoneRef}
                  onKeyDown={e => handleNextFocus(e, discountRef)}
                  type="text" 
                  placeholder="Phone Number (Optional)" 
                  value={activeCart.customerPhone} 
                  onChange={(e) => {
                    updateCart('customerPhone', e.target.value);
                    setShowPhoneSuggestions(true);
                  }} 
                  onFocus={() => setShowPhoneSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowPhoneSuggestions(false), 200)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />

                {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {phoneSuggestions.map(c => (
                      <div 
                        key={c.id} 
                        onMouseDown={(e) => { e.preventDefault(); handleSelectCustomer(c); }} 
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-500">📞 {c.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4 text-sm md:text-base">
              <div className="flex justify-between items-center text-slate-600 font-medium"><span>Subtotal:</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Discount (%)</span>
                  <input 
                    ref={discountRef}
                    onKeyDown={e => handleNextFocus(e, gstRef)}
                    type="number" min="0" max="100" 
                    value={activeCart.discountPercent} 
                    onChange={(e) => updateCart('discountPercent', e.target.value)} 
                    className="w-16 p-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" 
                  />
                </div>
                <span className="text-red-500">-₹{discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <div className="flex items-center gap-2">
                  <span>GST (%)</span>
                  <input 
                    ref={gstRef}
                    onKeyDown={e => handleNextFocus(e, reviewBtnRef)}
                    type="number" min="0" 
                    value={activeCart.gstPercent} 
                    onChange={(e) => updateCart('gstPercent', e.target.value)} 
                    className="w-16 p-1 border border-slate-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" 
                  />
                </div>
                <span className="text-emerald-600">+₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl md:text-2xl font-bold text-slate-900 pt-3 border-t border-slate-200"><span>Total:</span><span>₹{total.toFixed(2)}</span></div>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
              <div className="flex gap-2">
                {['Cash', 'Online', 'Credit'].map(method => (
                  <button key={method} onClick={() => updateCart('paymentMethod', method)} className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-lg border transition-all ${activeCart.paymentMethod === method ? method === 'Credit' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                    {method === 'Cash' ? '💵' : method === 'Online' ? '📱' : '💳'} <span className="hidden sm:inline">{method}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 mt-2">
              <button disabled={activeCart.invoice.length === 0} onClick={() => closeCart(activeCart.id)} className="w-16 flex items-center justify-center rounded-xl font-bold text-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed">
                🗑️
              </button>
              <button 
                ref={reviewBtnRef}
                disabled={activeCart.invoice.length === 0} 
                onClick={handleReviewClick} 
                className="flex-1 py-3 md:py-4 rounded-xl font-bold text-lg transition-all shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Review & Complete
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}