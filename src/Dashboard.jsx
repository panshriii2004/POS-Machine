import html2canvas from 'html2canvas';
import React, { useState, useRef, useEffect } from 'react';
import Barcode from 'react-barcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useReactToPrint } from 'react-to-print';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase'; 

const generateEscPosImage = async (logoUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const targetWidth = 200; 
      const scale = targetWidth / img.width;
      const targetHeight = Math.floor(img.height * scale);
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const pixels = imageData.data;
      
      const widthBytes = Math.ceil(targetWidth / 8);
      const buffer = new Uint8Array(8 + (widthBytes * targetHeight));
      
      buffer[0] = 29; 
      buffer[1] = 118; 
      buffer[2] = 48; 
      buffer[3] = 0; 
      buffer[4] = widthBytes % 256; 
      buffer[5] = Math.floor(widthBytes / 256); 
      buffer[6] = targetHeight % 256; 
      buffer[7] = Math.floor(targetHeight / 256); 
      
      let offset = 8;
      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < widthBytes; x++) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const px = (x * 8) + b;
            if (px < targetWidth) {
              const idx = (y * targetWidth + px) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const bValue = pixels[idx + 2];
              const luminance = 0.299 * r + 0.587 * g + 0.114 * bValue;
              if (luminance < 128) {
                byte |= (1 << (7 - b));
              }
            }
          }
          buffer[offset++] = byte;
        }
      }
      resolve(buffer);
    };
    img.onerror = () => resolve(new Uint8Array(0)); 
    img.src = logoUrl;
  });
};

const CameraScanner = ({ onScan, onClose }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 20, qrbox: { width: 300, height: 100 } }, false);
    scanner.render(
      (decodedText) => { 
        try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(e) {}
        onScan(decodedText); 
        scanner.clear(); 
      },
      (error) => {}
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
  isSidebarHidden, showSidebar, printCharacteristic, receiptConfig
}) {
  const [search, setSearch] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [editItemModal, setEditItemModal] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [isDirectPrinting, setIsDirectPrinting] = useState(false); 

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

  // --- SMART DELTA STOCK CALCULATOR FIX ---
  const getOriginalBill = (cart) => {
    if (!cart) return null;
    return billHistory.find(b => 
      b.id === cart.id || 
      b.id === cart.originalBillId || 
      b.id === cart.editBillId ||
      (cart.title && cart.title.includes(`#${b.id}`))
    );
  };

  const getAvailableStock = (productId, originalStock) => {
    let reservedInCarts = 0;
    carts.forEach(cart => {
      const originalBill = getOriginalBill(cart);
      const itemInCart = cart.invoice.find(i => i.id === productId);
      const currentQty = itemInCart ? itemInCart.quantity : 0;
      
      if (originalBill) {
        // Only reserve the EXTRA items added beyond the original bill
        const originalItem = originalBill.items.find(i => i.id === productId);
        const originalQty = originalItem ? originalItem.quantity : 0;
        reservedInCarts += (currentQty - originalQty);
      } else {
        reservedInCarts += currentQty;
      }
    });
    return originalStock - reservedInCarts;
  };

  const subtotal = activeCart.invoice.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalMrp = activeCart.invoice.reduce((sum, item) => sum + (item.basePrice || item.price) * item.quantity, 0); 
  const safeDiscountRate = Number(activeCart.discountPercent) || 0;
  const safeGstRate = Number(activeCart.gstPercent) || 0;
  const discountAmount = subtotal * (safeDiscountRate / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const gstAmount = discountedSubtotal * (safeGstRate / 100);
  const total = discountedSubtotal + gstAmount;
  const totalSavings = (totalMrp - subtotal) + discountAmount;
  const totalQty = activeCart.invoice.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const receiptScreenWidth = printerSize === '58mm' ? '260px' : '320px';
  const receiptPaperWidth = printerSize === '58mm' ? '58mm' : '80mm';
  const receiptFontFamily = '"Segoe UI", Arial, Helvetica, sans-serif';
  const receiptTextSize = printerSize === '58mm' ? '10px' : '12px';
  const receiptSmallTextSize = printerSize === '58mm' ? '9px' : '11px';
  const receiptHeaderSize = printerSize === '58mm' ? '18px' : '22px';
  const receiptTitleSize = printerSize === '58mm' ? '14px' : '16px';
  const receiptTotalSize = printerSize === '58mm' ? '20px' : '26px';
  
  const handlePrintReceiptDialog = useReactToPrint({ 
    contentRef: receiptRef, 
    documentTitle: 'Customer_Receipt',
    pageStyle: `@page { size: ${receiptPaperWidth} 297mm; margin: 0; }`,
    onAfterPrint: () => handleCompleteSale()
  });

  const handleDirectBluetoothPrint = async () => {
    setIsDirectPrinting(true);
    try {
      let charWidth = printerSize === '80mm' ? 48 : 32;
      if (receiptConfig?.printerFont === 'B' || receiptConfig?.printerFont === 'C') {
        charWidth = printerSize === '80mm' ? 64 : 42;
      }
      const dashedDivider = "-".repeat(charWidth) + "\n";

      const ESC = 27, GS = 29;
      const CMD_INIT = [ESC, 64];
      const CMD_ALIGN_LEFT = [ESC, 97, 0], CMD_ALIGN_CENTER = [ESC, 97, 1];
      const CMD_BOLD_ON = [ESC, 69, 1], CMD_BOLD_OFF = [ESC, 69, 0];
      const CMD_SIZE_NORMAL = [GS, 33, 0], CMD_SIZE_LARGE = [GS, 33, 17]; 
      const CMD_PAPER_CUT = [GS, 86, 66, 0];
      const fontCode = receiptConfig?.printerFont === 'C' ? 2 : receiptConfig?.printerFont === 'B' ? 1 : 0;
      const CMD_SET_FONT = [ESC, 77, fontCode];

      let payloadChunks = [];
      const encoder = new TextEncoder();
      const pushCmd = (arr) => payloadChunks.push(new Uint8Array(arr));
      const pushText = (str) => payloadChunks.push(encoder.encode(str));

      const formatLineLR = (left, right) => {
        const leftStr = left.toString(), rightStr = right.toString();
        const spaces = Math.max(1, charWidth - leftStr.length - rightStr.length);
        return leftStr + " ".repeat(spaces) + rightStr + "\n";
      };

      const formatTableRow = (col1, col2, col3, col4, col5) => {
        const remainingSpace = charWidth - 28;
        const col1Size = remainingSpace > 0 ? remainingSpace : 9;
        return col1.toString().substring(0, col1Size).padEnd(col1Size, ' ') + " " +
               col2.toString().padStart(4, ' ') + " " +
               col3.toString().padStart(4, ' ') + " " +
               col4.toString().padStart(5, ' ') + " " +
               col5.toString().padStart(6, ' ') + "\n";
      };

      pushCmd(CMD_INIT);
      
      if (receiptConfig?.logoUrl) {
        pushCmd(CMD_ALIGN_CENTER);
        try {
          const imagePayload = await generateEscPosImage(receiptConfig.logoUrl);
          if (imagePayload.length > 0) { pushCmd(imagePayload); pushText("\n"); }
        } catch (err) {}
      }

      pushCmd(CMD_SET_FONT); 
      pushCmd(CMD_ALIGN_CENTER);
      pushCmd(CMD_SIZE_LARGE);
      pushCmd(CMD_BOLD_ON);
      pushText((receiptConfig?.headerText || storeDetails?.name || "CHITRANJAN CLOTH STORE") + "\n");
      pushCmd(CMD_SIZE_NORMAL);
      pushCmd(CMD_BOLD_OFF);

      const formattedAddress = (storeDetails?.address || "RAHOUD").replace(/shop no\.?\s*\d*,?\s*/gi, '').trim();
      if (formattedAddress) pushText(`${formattedAddress}\n`);
      if (storeDetails?.phone) pushText(`Tel: +91 ${storeDetails.phone}\n`);
      if (storeDetails?.email) pushText(`Email: ${storeDetails.email}\n`);
      
      pushCmd(CMD_BOLD_ON);
      pushText("\nINVOICE\n\n");
      pushCmd(CMD_BOLD_OFF);
      pushCmd(CMD_ALIGN_LEFT);

      let bodyText = "";
      const dateStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true });
      bodyText += formatLineLR(dateStr, `Invoice : ${Date.now().toString().slice(-6)}`);
      bodyText += dashedDivider;

      if (receiptConfig?.showCustomerDetails && activeCart.customerName.trim()) {
        bodyText += `Customer Details :\nName : ${activeCart.customerName.trim()}\n`; 
        if (activeCart.customerPhone) bodyText += `Contact : ${activeCart.customerPhone}\n`;
        bodyText += dashedDivider;
      }
      pushText(bodyText);

      pushCmd(CMD_BOLD_ON);
      pushText(formatTableRow("ITEM", "QTY", "MRP", "RATE", "TOTAL"));
      pushCmd(CMD_BOLD_OFF);

      let itemText = dashedDivider;
      activeCart.invoice.forEach(item => {
        let itemName = item.name + (receiptConfig?.showMeasuringUnit ? " (pc)" : "");
        let mrp = (item.basePrice || item.price).toFixed(0), rate = item.price.toFixed(0), itemTotal = (item.price * item.quantity).toFixed(0);
        itemText += formatTableRow(itemName, item.quantity, mrp, rate, itemTotal);
      });
      itemText += dashedDivider;
      itemText += formatLineLR("", `Rs ${subtotal.toFixed(0)}`);
      itemText += dashedDivider;

      let leftSummary1 = receiptConfig?.showTotalItems ? `Items : ${activeCart.invoice.length}` : "";
      let leftSummary2 = receiptConfig?.showTotalQty ? `Total Qty : ${totalQty}` : "";
      let rightLines = [`Sub Total  Rs ${subtotal.toFixed(0)}`];
      if (discountAmount > 0) rightLines.push(`Discount   Rs ${discountAmount.toFixed(0)}`);
      if (gstAmount > 0) rightLines.push(`GST        Rs ${gstAmount.toFixed(0)}`);

      const maxLines = Math.max(leftSummary1 || leftSummary2 ? 2 : 1, rightLines.length);
      let leftLines = [leftSummary1, leftSummary2];
      
      for (let i = 0; i < maxLines; i++) {
         itemText += formatLineLR(leftLines[i] || "", rightLines[i] || "");
      }
      itemText += dashedDivider;
      pushText(itemText);

      pushCmd(CMD_ALIGN_CENTER);
      pushCmd(CMD_SIZE_LARGE);
      pushCmd(CMD_BOLD_ON);
      pushText(`Total : Rs ${total.toFixed(0)}\n`);
      pushCmd(CMD_SIZE_NORMAL);
      pushCmd(CMD_BOLD_OFF);
      
      let footerTextStr = "";
      if (receiptConfig?.showSaveAmount && totalSavings > 0) footerTextStr += `You saved Rs ${totalSavings.toFixed(0)} on this purchase\n`;
      footerTextStr += dashedDivider;
      if (receiptConfig?.showPaymentMode) {
        footerTextStr += `Payment Mode\n${activeCart.paymentMethod} : Rs ${total.toFixed(0)}\n${dashedDivider}`;
      }
      
      const footerLines = (receiptConfig?.footerText || "Thank You . Visit again!!").split('\n');
      footerLines.forEach(line => { footerTextStr += `${line}\n`; });
      footerTextStr += "\n\n\n\n";
      pushText(footerTextStr);
      pushCmd(CMD_PAPER_CUT);

      let totalLength = payloadChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      let finalPayload = new Uint8Array(totalLength);
      let offset = 0;
      payloadChunks.forEach(chunk => { finalPayload.set(chunk, offset); offset += chunk.length; });

      const CHUNK_SIZE = 150;
      for (let i = 0; i < finalPayload.length; i += CHUNK_SIZE) {
        await printCharacteristic.writeValue(finalPayload.slice(i, i + CHUNK_SIZE));
      }

      handleCompleteSale();

    } catch (error) {
      alert("Direct printing failed. Falling back to system dialog.");
      handlePrintReceiptDialog(); 
    }
    setIsDirectPrinting(false);
  };

  const handlePrintClick = () => {
    if (printCharacteristic) handleDirectBluetoothPrint();
    else handlePrintReceiptDialog();
  };

  const handleShareWhatsAppSS = async () => {
    let phone = activeCart.customerPhone;
    if (!phone || phone.trim() === '' || phone === 'N/A') {
      alert("Please enter the customer's phone number in the bill details before sharing.");
      customerPhoneRef.current?.focus();
      return;
    }

    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const element = document.getElementById('receipt-capture-area');
    if(!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `Receipt.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title: 'Receipt', files: [file] });
            return;
          } catch(e) {} 
        }
        
        try {
          await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
          alert("Receipt copied! Opening WhatsApp... paste (Ctrl+V) the image directly into the chat.");
          window.open(`https://api.whatsapp.com/send?phone=${phone}`, '_blank');
        } catch(e) {
          alert("Failed to copy image. Opening WhatsApp chat anyway.");
          window.open(`https://api.whatsapp.com/send?phone=${phone}`, '_blank');
        }
      });
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
  };

  const handleCustomerBlur = () => {
    setTimeout(() => {
      setShowNameSuggestions(false);
      setShowPhoneSuggestions(false);

      const name = customerNameRef.current?.value.trim();
      const phone = customerPhoneRef.current?.value.trim() || 'N/A';
      if (!name) return;

      setCustomers(prev => {
        const existingCustomer = prev.find(c => 
          (c.phone !== 'N/A' && c.phone === phone) || c.name.toLowerCase() === name.toLowerCase()
        );
        if (!existingCustomer) {
          return [...prev, {
            id: Date.now().toString(), name: name, phone: phone, totalSpent: 0, creditDue: 0, lastVisit: new Date().toLocaleDateString(), addedBy: currentUser?.id
          }];
        }
        return prev;
      });
    }, 200);
  };

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
          return { ...c, customerName: customer.name, customerPhone: customer.phone === 'N/A' ? '' : customer.phone };
        }
        return c;
      });
    });
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
    setTimeout(() => discountRef.current?.focus(), 150); 
  };

  const handleMergeCart = (sourceCartId) => {
    setCarts(prevCarts => {
      const sourceCart = prevCarts.find(c => c.id === sourceCartId);
      const targetCart = prevCarts.find(c => c.id === activeCartId);
      if (!sourceCart || !targetCart) return prevCarts;

      const mergedInvoice = [...targetCart.invoice];
      sourceCart.invoice.forEach(sourceItem => {
        const existingItemIndex = mergedInvoice.findIndex(i => i.id === sourceItem.id);
        if (existingItemIndex >= 0) {
          mergedInvoice[existingItemIndex] = {
            ...mergedInvoice[existingItemIndex],
            quantity: mergedInvoice[existingItemIndex].quantity + sourceItem.quantity
          };
        } else {
          mergedInvoice.push(sourceItem);
        }
      });

      const updatedTargetCart = {
        ...targetCart,
        invoice: mergedInvoice,
        customerName: targetCart.customerName || sourceCart.customerName,
        customerPhone: targetCart.customerPhone || sourceCart.customerPhone,
      };

      return prevCarts.filter(c => c.id !== sourceCartId).map(c => c.id === activeCartId ? updatedTargetCart : c);
    });
    setShowMergeModal(false);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (showReceiptModal || editItemModal || isCameraOpen || showMergeModal) return;
      if (e.key === 'Enter') {
        if (document.activeElement === document.body) {
          e.preventDefault();
          if (activeCart.invoice.length === 0) scannerInputRef.current?.focus();
          else customerNameRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeCart.invoice.length, showReceiptModal, editItemModal, isCameraOpen, showMergeModal]);

  useEffect(() => {
    if (showReceiptModal) setTimeout(() => doneBtnRef.current?.focus(), 100);
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
    const targetCartId = carts.find(c => c.id === activeCartId) ? activeCartId : carts[0].id;
    const availableStock = getAvailableStock(product.id, product.stock);
    
    if (availableStock <= 0) {
      alert(`Out of stock! You don't have any more '${product.name}' left.`);
      return; 
    }

    setCarts(prevCarts => prevCarts.map(c => c.id === targetCartId ? {
      ...c, 
      invoice: c.invoice.find(i => i.id === product.id)
        ? c.invoice.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...c.invoice, { ...product, quantity: 1, basePrice: product.mrp || product.price }]
    } : c));
  };

  const updateQuantity = (id, delta) => {
    const cartItem = activeCart.invoice.find(i => i.id === id);
    if (!cartItem || (delta === -1 && cartItem.quantity <= 1)) return; 
    const inventoryProduct = products.find(p => p.id === id);

    if (delta === 1) {
      const availableStock = getAvailableStock(id, inventoryProduct.stock);
      if (availableStock <= 0) {
        alert(`Out of stock!`); return; 
      }
    }

    setCarts(prevCarts => prevCarts.map(c => c.id === activeCartId ? {
      ...c, invoice: c.invoice.map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
    } : c));
  };

  const removeFromInvoice = (id) => {
    setCarts(prevCarts => prevCarts.map(c => c.id === activeCartId ? {
      ...c, invoice: c.invoice.filter((item) => item.id !== id)
    } : c));
  };

  const openEditModal = (item) => {
    setEditItemModal({ ...item, basePrice: item.basePrice || item.price, newPrice: item.price, discountType: item.itemDiscountType || 'Rs', discountValue: item.itemDiscountValue || '' });
  };

  const handleItemDiscountChange = (type, value) => {
    let val = value === '' ? '' : parseFloat(value);
    let calculatedPrice = editItemModal.basePrice;
    if (val !== '' && !isNaN(val)) {
      if (type === '%') calculatedPrice = editItemModal.basePrice - (editItemModal.basePrice * (val / 100));
      else if (type === 'Rs') calculatedPrice = editItemModal.basePrice - val;
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
    if (cartToClose.invoice.length > 0 && !window.confirm(`Cancel this bill? Items will be cleared.`)) return;
    
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
      if (scanInput.trim()) { processScannedCode(scanInput.trim()); setScanInput(''); } 
      else if (activeCart.invoice.length > 0) customerNameRef.current?.focus();
    }
  };

  const handleReviewClick = () => {
    if (activeCart.paymentMethod === 'Credit' && activeCart.customerName.trim() === '') {
      alert("⚠️ Customer Name is required for Credit sales!"); return; 
    }
    setShowReceiptModal(true); 
  };

  const handleCompleteSale = async () => {
    setShowReceiptModal(false); 

    const originalBill = getOriginalBill(activeCart);

    const newBill = {
      id: originalBill ? originalBill.id : Date.now().toString().slice(-6), 
      date: originalBill ? originalBill.date : new Date().toLocaleString(),
      cashierName: currentUser?.name || 'Admin', cashierId: currentUser?.id || 'admin',
      customerName: activeCart.customerName.trim() || 'Walk-in Customer', customerPhone: activeCart.customerPhone || 'N/A',
      paymentMethod: activeCart.paymentMethod, items: [...activeCart.invoice],
      subtotal: subtotal, discountPercent: safeDiscountRate, discountAmount: discountAmount,
      gstPercent: safeGstRate, gstAmount: gstAmount, tax: gstAmount, total: total
    };
    
    if (setBillHistory) {
      if (originalBill) setBillHistory(billHistory.map(b => b.id === originalBill.id ? newBill : b));
      else setBillHistory([newBill, ...billHistory]);
    }

    if (activeCart.customerPhone || activeCart.customerName.trim() !== '') {
      const phone = activeCart.customerPhone || 'N/A';
      const name = activeCart.customerName.trim() || 'Walk-in Customer';
      const isCredit = activeCart.paymentMethod === 'Credit';
      const amountAddedToCredit = isCredit ? total : 0;

      let amountToReverse = 0;
      let creditToReverse = 0;
      let oldCustomerPhone = null;
      let oldCustomerName = null;

      if (originalBill) {
        amountToReverse = originalBill.total;
        if (originalBill.paymentMethod === 'Credit') creditToReverse = originalBill.total;
        oldCustomerPhone = originalBill.customerPhone;
        oldCustomerName = originalBill.customerName;
      }

      setCustomers(prevCustomers => {
        let updated = [...prevCustomers];
        
        if (originalBill && (oldCustomerPhone !== 'N/A' || oldCustomerName !== 'Walk-in Customer')) {
           const oldCustIdx = updated.findIndex(c => (c.phone !== 'N/A' && c.phone === oldCustomerPhone) || c.name === oldCustomerName);
           if (oldCustIdx !== -1) {
              updated[oldCustIdx] = {
                 ...updated[oldCustIdx],
                 totalSpent: updated[oldCustIdx].totalSpent - amountToReverse,
                 creditDue: updated[oldCustIdx].creditDue - creditToReverse
              };
           }
        }

        const newCustIdx = updated.findIndex(c => (c.phone !== 'N/A' && c.phone === phone) || c.name.toLowerCase() === name.toLowerCase());
        if (newCustIdx !== -1) {
           let updatedPhone = updated[newCustIdx].phone;
           if ((!updatedPhone || updatedPhone === 'N/A') && phone !== 'N/A') updatedPhone = phone;
           
           updated[newCustIdx] = {
              ...updated[newCustIdx],
              phone: updatedPhone,
              totalSpent: (updated[newCustIdx].totalSpent || 0) + total,
              creditDue: (updated[newCustIdx].creditDue || 0) + amountAddedToCredit,
              lastVisit: new Date().toLocaleDateString()
           };
        } else {
           updated.push({
             id: Date.now().toString(), name: name, phone: phone, totalSpent: total, creditDue: amountAddedToCredit, lastVisit: new Date().toLocaleDateString(), addedBy: currentUser?.id
           });
        }
        return updated;
      });
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "print_queue")), {
        cart: activeCart, storeDetails: storeDetails, cashierName: currentUser?.name || 'Admin', subtotal: subtotal, total: total, status: "pending", timestamp: Date.now()
      });
      
      setProducts(prevProducts => {
        let updatedProducts = [...prevProducts];
        
        activeCart.invoice.forEach(cartItem => {
          const idx = updatedProducts.findIndex(p => p.id === cartItem.id);
          if (idx !== -1) {
            let qtyToDeduct = cartItem.quantity;
            if (originalBill) {
               const originalItem = originalBill.items.find(i => i.id === cartItem.id);
               const originalQty = originalItem ? originalItem.quantity : 0;
               qtyToDeduct = cartItem.quantity - originalQty; 
            }
            const newStock = updatedProducts[idx].stock - qtyToDeduct;
            updatedProducts[idx] = { ...updatedProducts[idx], stock: newStock };
          }
        });

        if (originalBill) {
           originalBill.items.forEach(origItem => {
              const stillInCart = activeCart.invoice.find(i => i.id === origItem.id);
              if (!stillInCart) {
                 const idx = updatedProducts.findIndex(p => p.id === origItem.id);
                 if (idx !== -1) {
                   updatedProducts[idx] = { ...updatedProducts[idx], stock: updatedProducts[idx].stock + origItem.quantity };
                 }
              }
           });
        }
        
        return updatedProducts;
      });
      
      await batch.commit();
    } catch (err) {}

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
      
      {isSidebarHidden && (
        <button onClick={showSidebar} className="fixed top-3 left-3 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105" title="Show Menu">
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {showMergeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative">
            <button onClick={() => setShowMergeModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 font-bold text-lg">✕</button>
            <h3 className="font-bold text-xl text-slate-800 mb-2">Merge Carts</h3>
            <p className="text-sm text-slate-500 mb-5">Select a cart to pull its items into <strong>{activeCart.title}</strong>:</p>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {carts.filter(c => c.id !== activeCartId).map(c => (
                <button 
                  key={c.id} 
                  onClick={() => handleMergeCart(c.id)} 
                  className="w-full p-4 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 flex justify-between items-center transition-all group shadow-sm"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-700 group-hover:text-blue-700">{c.title}</span>
                    {c.customerName && <span className="text-xs text-slate-500">{c.customerName}</span>}
                  </div>
                  <span className="text-xs font-bold bg-slate-100 group-hover:bg-blue-200 text-slate-600 group-hover:text-blue-800 px-2.5 py-1 rounded-full transition-colors">
                    {c.invoice.length} items
                  </span>
                </button>
              ))}
              {carts.length <= 1 && (
                <p className="text-center text-slate-400 italic py-4">No other active carts to merge.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
        <button onClick={() => setShowMergeModal(true)} disabled={carts.length < 2} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors ml-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
          🔗 Merge
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
                  <span className="font-bold text-slate-800 text-lg">Rs {editItemModal.basePrice.toFixed(2)}</span>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Apply Discount</label>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => handleItemDiscountChange('%', editItemModal.discountValue)} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${editItemModal.discountType === '%' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600'}`}>% Percentage</button>
                    <button onClick={() => handleItemDiscountChange('Rs', editItemModal.discountValue)} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${editItemModal.discountType === 'Rs' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-300 text-slate-600'}`}>Rs</button>
                  </div>
                  <input type="number" value={editItemModal.discountValue} onChange={(e) => handleItemDiscountChange(editItemModal.discountType, e.target.value)} placeholder="Enter discount amount..." className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Final Unit Price (Rs)</label>
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
            <div className="bg-slate-100 p-4 md:p-6 rounded-2xl shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto w-full max-w-sm relative">
              <button onClick={() => setShowReceiptModal(false)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-500 hover:text-white rounded-full text-slate-600 font-bold transition-colors shadow-sm">✕</button>
              
              <div
                id="receipt-capture-area"
                ref={receiptRef}
                className="thermal-receipt p-4 bg-white text-black shadow-sm mx-auto mt-4"
                style={{
                  width: receiptScreenWidth,
                  fontFamily: receiptFontFamily,
                  WebkitFontSmoothing: 'antialiased',
                  textRendering: 'geometricPrecision'
                }}
              >
                
                {receiptConfig?.logoUrl && (
                  <div className="flex justify-center mb-2">
                    <img src={receiptConfig.logoUrl} alt="Store Logo" className="max-h-16 w-auto object-contain filter grayscale" />
                  </div>
                )}

                <h2 className="text-center font-bold uppercase mb-1 leading-tight" style={{ fontSize: receiptHeaderSize }}>
                  {receiptConfig?.headerText || storeDetails?.name || 'CHITRANJAN CLOTH STORE'}
                </h2>
                
                <div className="text-center text-slate-800 mb-2 leading-tight" style={{ fontSize: receiptTextSize }}>
                  <div>{(storeDetails?.address || "RAHOUD").replace(/shop no\.?\s*\d*,?\s*/gi, '').trim()}</div>
                  <div>Tel: +91 {storeDetails?.phone || '7566229521'}</div>
                  <div>Email: {storeDetails?.email || 'chitranjanclothstore121@gmail.com'}</div>
                </div>

                <div className="text-center font-bold mb-2 mt-3 tracking-widest" style={{ fontSize: receiptTitleSize }}>
                  INVOICE
                </div>
                
                <div className="flex justify-between text-slate-800 mb-1" style={{ fontSize: receiptTextSize }}>
                  <span>{new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true })}</span>
                  <span>Invoice : {Date.now().toString().slice(-5)}</span>
                </div>
                
                <div className="border-b border-dashed border-black mb-2"></div>

                {receiptConfig?.showCustomerDetails && activeCart.customerName.trim() && (
                  <>
                    <div className="text-slate-800 mb-2" style={{ fontSize: receiptTextSize }}>
                      <div className="font-semibold">Customer Details :</div>
                      <div>Name : {activeCart.customerName.trim()}</div>
                      {activeCart.customerPhone && <div>Contact : {activeCart.customerPhone}</div>}
                    </div>
                    <div className="border-b border-dashed border-black mb-2"></div>
                  </>
                )}

                <div className="flex justify-between font-bold text-black mb-1 uppercase" style={{ fontSize: receiptTextSize }}>
                  <span className="w-[35%]">ITEM</span>
                  <span className="w-[15%] text-center">QTY</span>
                  <span className="w-[15%] text-center">MRP</span>
                  <span className="w-[15%] text-center">RATE</span>
                  <span className="w-[20%] text-right">TOTAL</span>
                </div>
                <div className="border-b border-dashed border-black mb-2"></div>
                
                <div className="space-y-2 mb-2 text-slate-800" style={{ fontSize: receiptTextSize }}>
                  {activeCart.invoice.map(item => {
                    let itemName = item.name + (receiptConfig?.showMeasuringUnit ? " (pc)" : "");
                    let mrp = (item.basePrice || item.price).toFixed(0);
                    let rate = item.price.toFixed(0);
                    let itemTotal = (item.price * item.quantity).toFixed(0);
                    return (
                      <div key={item.id} className="flex justify-between items-start">
                        <span className="w-[35%] pr-1 break-words">{itemName}</span>
                        <span className="w-[15%] text-center">{item.quantity}</span>
                        <span className="w-[15%] text-center">{receiptConfig?.showMrp ? mrp : '-'}</span>
                        <span className="w-[15%] text-center">{rate}</span>
                        <span className="w-[20%] text-right">{itemTotal}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-b border-dashed border-black mb-1"></div>
                
                <div className="flex justify-end text-black font-semibold mb-1" style={{ fontSize: receiptTextSize }}>
                  <span>Rs {subtotal.toFixed(0)}</span>
                </div>
                <div className="border-b border-dashed border-black mb-2"></div>

                <div className="flex justify-between items-start text-slate-800 mb-2" style={{ fontSize: receiptTextSize }}>
                  <div className="flex flex-col">
                    {receiptConfig?.showTotalItems && <span>Items : {activeCart.invoice.length}</span>}
                    {receiptConfig?.showTotalQty && <span>Total Qty : {totalQty}</span>}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex justify-between w-[120px]">
                      <span>Sub Total</span>
                      <span>Rs {subtotal.toFixed(0)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between w-[120px] mt-1">
                        <span>Discount</span>
                        <span>Rs {discountAmount.toFixed(0)}</span>
                      </div>
                    )}
                    {gstAmount > 0 && (
                      <div className="flex justify-between w-[120px] mt-1">
                        <span>GST</span>
                        <span>Rs {gstAmount.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-b border-dashed border-black mb-3"></div>

                <div className="flex justify-center items-center gap-3 font-bold text-black mb-1" style={{ fontSize: receiptTotalSize }}>
                  <span>Total : Rs</span>
                  <span>{total.toFixed(0)}</span>
                </div>
                
                {receiptConfig?.showSaveAmount && totalSavings > 0 && (
                  <div className="text-center text-slate-800 mb-3" style={{ fontSize: receiptSmallTextSize }}>
                    You saved Rs {totalSavings.toFixed(0)} on this purchase
                  </div>
                )}
                <div className="border-b border-dashed border-black mb-2"></div>

                {receiptConfig?.showPaymentMode && (
                  <>
                    <div className="text-center text-slate-800" style={{ fontSize: receiptTextSize }}>
                      <div className="mb-0.5">Payment Mode</div>
                      <div>{activeCart.paymentMethod} : Rs {total.toFixed(0)}</div>
                    </div>
                    <div className="border-b border-dashed border-black mt-2 mb-3"></div>
                  </>
                )}

                <div className="text-center text-slate-800 leading-snug whitespace-pre-wrap" style={{ fontSize: receiptSmallTextSize }}>
                  {receiptConfig?.footerText || "Thank You . Visit again!!"}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
                <button 
                  onClick={handleShareWhatsAppSS} 
                  className="flex-1 bg-[#25D366] text-white font-bold py-3 rounded-xl hover:bg-[#1ebe5d] transition shadow-sm flex items-center justify-center gap-2"
                >
                  <span>💬 Share WhatsApp</span>
                </button>
                <button 
                  onClick={handlePrintClick} 
                  disabled={isDirectPrinting}
                  className="flex-1 bg-blue-600 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-sm"
                >
                  {isDirectPrinting ? 'Printing...' : printCharacteristic ? '🖨️ Direct Print' : '🖨️ Print Bill'}
                </button>
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
              const availableStock = getAvailableStock(product.id, product.stock);
              
              let cardBg = "bg-white border-slate-200 hover:border-blue-500";
              if (availableStock <= 0) cardBg = "bg-red-100 border-red-300 opacity-70 cursor-not-allowed";
              else if (availableStock <= 5) cardBg = "bg-yellow-100 border-yellow-400 hover:border-yellow-500";

              return (
                <div 
                  key={product.id} 
                  onClick={() => addToInvoice(product)} 
                  className={`p-3 border rounded-xl shadow-sm transition-all group flex flex-col justify-between ${cardBg}`}
                >
                  <div>
                    <h3 className={`font-semibold text-sm md:text-base line-clamp-2 leading-tight ${availableStock <= 0 ? 'text-red-700' : 'text-slate-800 group-hover:text-blue-600'}`}>
                      {product.name}
                    </h3>
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center mt-2 gap-1">
                      <span className="text-base font-bold text-slate-900">Rs {product.price.toFixed(2)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block w-max
                        ${availableStock <= 0 ? 'bg-red-600 text-white' : 
                          availableStock <= 5 ? 'bg-yellow-600 text-white' : 
                          'bg-slate-100 text-slate-500'}`}>
                        Stock: {availableStock}
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
                        Rs {item.price.toFixed(2)} / each
                        <button onClick={() => openEditModal(item)} className="text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold px-2 py-0.5 rounded" title="Edit Price & Discount">✏️ Edit</button>
                      </div>
                      {(item.basePrice || item.price) > item.price && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                          Discounted from Rs {(item.basePrice || item.price).toFixed(2)}
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
                      <p className="font-bold text-slate-900">Rs {(item.price * item.quantity).toFixed(2)}</p>
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
                  onBlur={handleCustomerBlur}
                  type="text" 
                  placeholder={activeCart.paymentMethod === 'Credit' ? "Customer Name (REQUIRED) *" : "Customer Name"} 
                  value={activeCart.customerName} 
                  onChange={(e) => {
                    updateCart('customerName', e.target.value);
                    setShowNameSuggestions(true);
                  }} 
                  onFocus={() => setShowNameSuggestions(true)}
                  className={`w-full p-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${activeCart.paymentMethod === 'Credit' && !activeCart.customerName.trim() ? 'border-red-400 bg-red-50 placeholder-red-400' : 'border-slate-300'}`} 
                />
                
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {nameSuggestions.map(c => (
                      <div 
                        key={c.id} 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectCustomer(c)} 
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
                  onBlur={handleCustomerBlur}
                  type="text" 
                  placeholder="Phone Number (Optional)" 
                  value={activeCart.customerPhone} 
                  onChange={(e) => {
                    updateCart('customerPhone', e.target.value);
                    setShowPhoneSuggestions(true);
                  }} 
                  onFocus={() => setShowPhoneSuggestions(true)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />

                {showPhoneSuggestions && phoneSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {phoneSuggestions.map(c => (
                      <div 
                        key={c.id} 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectCustomer(c)} 
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
              <div className="flex justify-between items-center text-slate-600 font-medium"><span>Subtotal:</span><span>Rs {subtotal.toFixed(2)}</span></div>
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
                <span className="text-red-500">-Rs {discountAmount.toFixed(2)}</span>
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
                <span className="text-emerald-600">+Rs {gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl md:text-2xl font-bold text-slate-900 pt-3 border-t border-slate-200"><span>Total:</span><span>Rs {total.toFixed(2)}</span></div>
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