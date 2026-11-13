import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

export default function Customers({ currentUser, customers, setCustomers, billHistory, storeDetails, isSidebarHidden, showSidebar }) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [viewingBill, setViewingBill] = useState(null);
  
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustVillage, setNewCustVillage] = useState(''); 

  // Admin Credit & Village Filter States
  const [showCreditOnly, setShowCreditOnly] = useState(false);
  const [creditColorFilter, setCreditColorFilter] = useState('all'); 
  const [villageFilter, setVillageFilter] = useState('all'); 

  // FULL EDIT PROFILE STATE
  const [editingCustomerObj, setEditingCustomerObj] = useState(null);

  const detailsRef = useRef(null);
  const listRef = useRef(null);

  const cashierBilledPhones = new Set();
  const cashierBilledNames = new Set();

  if (currentUser?.role === 'operator') {
    billHistory.forEach(bill => {
      if (bill.cashierId === currentUser.id || bill.cashierName === currentUser.name) {
        if (bill.customerPhone && bill.customerPhone !== 'N/A') {
          cashierBilledPhones.add(bill.customerPhone);
        } else {
          cashierBilledNames.add(bill.customerName);
        }
      }
    });
  }

  // Operator visibility filter
  const accessibleCustomers = currentUser?.role === 'operator' 
    ? customers.filter(c => 
        c.addedBy === currentUser?.id || 
        (c.phone && c.phone !== 'N/A' && cashierBilledPhones.has(c.phone)) || 
        cashierBilledNames.has(c.name)
      )
    : customers;

  // Extract unique villages for the dropdown filter dynamically
  const uniqueVillages = [...new Set(accessibleCustomers.map(c => c.village?.trim()).filter(Boolean))].sort();

  // Search filter
  const searchFiltered = accessibleCustomers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search)) ||
    (c.village && c.village.toLowerCase().includes(search.toLowerCase()))
  );

  // Helper function to determine the color status of a customer
  const getCustomerStatus = (customer) => {
    if (customer.creditDue <= 0) return { type: 'none', border: 'border-slate-100', bg: 'bg-white', badgeBg: 'bg-slate-100', text: 'text-slate-600' };

    let statusType = '';

    if (customer.manualColorOverride) {
      statusType = customer.manualColorOverride;
    } else {
      const dateString = customer.creditStartDate || customer.lastVisit;
      
      let startDateObj = new Date();
      if (dateString) {
        const parts = dateString.includes('/') ? dateString.split('/') : [];
        if (parts.length === 3 && parts[2].length === 4) { 
          startDateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); 
        } else {
          startDateObj = new Date(dateString);
        }
      }
      
      if (isNaN(startDateObj)) startDateObj = new Date(); 

      const diffTime = new Date() - startDateObj;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) statusType = 'emerald';
      else if (diffDays <= 180) statusType = 'yellow';
      else statusType = 'red';
    }

    if (statusType === 'emerald') return { type: 'emerald', border: 'border-emerald-400', bg: 'bg-emerald-50', badgeBg: 'bg-emerald-100', text: 'text-emerald-700' };
    if (statusType === 'yellow') return { type: 'yellow', border: 'border-yellow-400', bg: 'bg-yellow-50', badgeBg: 'bg-yellow-100', text: 'text-yellow-700' };
    if (statusType === 'red') return { type: 'red', border: 'border-red-400', bg: 'bg-red-50', badgeBg: 'bg-red-100', text: 'text-red-700' };
    
    return { type: 'none', border: 'border-slate-100', bg: 'bg-white', badgeBg: 'bg-slate-100', text: 'text-slate-600' };
  };

  // Filter by Credit, Selected Color, and Village
  const filteredCustomers = searchFiltered.filter(c => {
    // 1. Village Filter
    if (villageFilter !== 'all' && c.village?.trim() !== villageFilter) return false;
    
    // 2. Credit Toggle Filter
    if (showCreditOnly && c.creditDue <= 0) return false;
    
    // 3. Color Filter
    if (showCreditOnly && creditColorFilter !== 'all') {
      const status = getCustomerStatus(c);
      if (status.type !== creditColorFilter) return false;
    }
    
    return true;
  });

  // Calculate the total credit dynamically based on the filtered list
  const totalFilteredCredit = filteredCustomers.reduce((sum, customer) => {
    return sum + (customer.creditDue > 0 ? customer.creditDue : 0);
  }, 0);

  const customerBills = selectedCustomer 
    ? billHistory.filter(b => b.customerPhone === selectedCustomer.phone || (b.customerName === selectedCustomer.name && selectedCustomer.phone === 'N/A'))
    : [];

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    if (window.innerWidth < 768) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150); 
    }
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    if (!newCustName.trim()) return alert("Customer Name is required");

    const newCustomer = {
      id: Date.now().toString(),
      name: newCustName.trim(),
      phone: newCustPhone.trim() || 'N/A',
      address: newCustAddress.trim(),
      village: newCustVillage.trim(), 
      totalSpent: 0,
      creditDue: 0,
      lastVisit: new Date().toLocaleDateString(),
      paymentHistory: [],
      addedBy: currentUser?.id,
      manualColorOverride: ''
    };

    setCustomers([newCustomer, ...customers]);
    setShowAddCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustVillage('');
    handleSelectCustomer(newCustomer);
  };

  const handleSaveProfile = () => {
    if(!editingCustomerObj.name.trim()) return alert("Name is required");
    const updated = customers.map(c => c.id === editingCustomerObj.id ? editingCustomerObj : c);
    setCustomers(updated);
    if (selectedCustomer?.id === editingCustomerObj.id) setSelectedCustomer(editingCustomerObj);
    setEditingCustomerObj(null);
  };

  const handleDeleteCustomer = () => {
    if (selectedCustomer.creditDue > 0) {
      if (!window.confirm(`⚠️ WARNING: ${selectedCustomer.name} still owes you ₹${selectedCustomer.creditDue.toFixed(2)}!\n\nAre you absolutely sure you want to delete their profile and wipe their debt?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to completely delete ${selectedCustomer.name}'s profile? This cannot be undone.`)) {
        return;
      }
    }

    const updatedCustomers = customers.filter(c => c.id !== selectedCustomer.id);
    setCustomers(updatedCustomers);
    setSelectedCustomer(null); 

    if (window.innerWidth < 768) {
      setTimeout(() => {
        listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleSettleCredit = (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount");
    if (amount > selectedCustomer.creditDue) return alert("Payment cannot be greater than the outstanding credit!");

    const newPaymentRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      amount: amount
    };

    const updatedCustomers = customers.map(c => {
      if (c.id === selectedCustomer.id) {
        return { 
          ...c, 
          creditDue: c.creditDue - amount,
          paymentHistory: [newPaymentRecord, ...(c.paymentHistory || [])] 
        };
      }
      return c;
    });

    setCustomers(updatedCustomers);
    setSelectedCustomer({ 
      ...selectedCustomer, 
      creditDue: selectedCustomer.creditDue - amount,
      paymentHistory: [newPaymentRecord, ...(selectedCustomer.paymentHistory || [])]
    });
    
    setPaymentAmount('');
  };

  const openEditPayment = (payment) => {
    setEditingPayment(payment);
    setEditPaymentAmount(payment.amount.toString());
  };

  const handleSaveEditPayment = (e) => {
    e.preventDefault();
    const newAmount = parseFloat(editPaymentAmount);
    if (isNaN(newAmount) || newAmount <= 0) return alert("Enter a valid amount");

    const oldAmount = editingPayment.amount;
    const difference = newAmount - oldAmount; 

    if (selectedCustomer.creditDue - difference < 0) {
      if(!window.confirm("This edit will result in an overpayment (negative credit). Continue?")) return;
    }

    const updatedPaymentHistory = selectedCustomer.paymentHistory.map(p => 
      p.id === editingPayment.id ? { ...p, amount: newAmount } : p
    );

    const updatedCustomers = customers.map(c => {
      if (c.id === selectedCustomer.id) {
        return { ...c, creditDue: c.creditDue - difference, paymentHistory: updatedPaymentHistory };
      }
      return c;
    });

    setCustomers(updatedCustomers);
    setSelectedCustomer({ ...selectedCustomer, creditDue: selectedCustomer.creditDue - difference, paymentHistory: updatedPaymentHistory });
    setEditingPayment(null);
  };

  const handleDeletePayment = () => {
    if (!window.confirm("Are you sure you want to delete this payment record? This will add the money back to their Credit Due.")) return;

    const updatedPaymentHistory = selectedCustomer.paymentHistory.filter(p => p.id !== editingPayment.id);
    const amountToRestore = editingPayment.amount;

    const updatedCustomers = customers.map(c => {
      if (c.id === selectedCustomer.id) {
        return { ...c, creditDue: c.creditDue + amountToRestore, paymentHistory: updatedPaymentHistory };
      }
      return c;
    });

    setCustomers(updatedCustomers);
    setSelectedCustomer({ ...selectedCustomer, creditDue: selectedCustomer.creditDue + amountToRestore, paymentHistory: updatedPaymentHistory });
    setEditingPayment(null);
  };

  const handleSendWhatsApp = () => {
    if (!selectedCustomer.phone || selectedCustomer.phone === 'N/A') {
      return alert("No valid phone number saved for this customer.");
    }
    
    let phone = selectedCustomer.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const shopName = storeDetails?.name || "Our Store";
    const message = `Hello ${selectedCustomer.name},\n\nThis is a gentle reminder from ${shopName}. You currently have an outstanding credit balance of ₹${selectedCustomer.creditDue.toFixed(2)}.\n\nPlease arrange a payment at your earliest convenience. Thank you!`;
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareReceipt = async () => {
    const element = document.getElementById('receipt-capture-area');
    if(!element) return;

    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' });
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `Receipt_${viewingBill.id}.png`, { type: 'image/png' });
      let phone = viewingBill.customerPhone;
      
      if (phone && phone !== 'N/A') {
          phone = phone.replace(/\D/g, '');
          if(phone.length === 10) phone = '91' + phone;
      } else {
          phone = null;
      }

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: 'Receipt', files: [file] });
          return;
        } catch(e) {} 
      }
      
      try {
        await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
        alert("Receipt image copied to clipboard! Opening WhatsApp... just paste (Ctrl+V) the image directly into the chat.");
        
        if (phone && phone.length >= 10) {
          window.open(`https://api.whatsapp.com/send?phone=${phone}`, '_blank');
        } else {
           window.open(`https://web.whatsapp.com/`, '_blank');
        }
      } catch(e) {
        alert("Failed to copy image to clipboard. Please take a screenshot manually.");
      }
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 font-sans p-4 md:p-6 gap-6 overflow-y-auto md:overflow-hidden relative custom-scrollbar">
      
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative animate-fade-in-down">
            <button onClick={() => setShowAddCustomerModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 font-bold transition-colors">✕</button>
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Add New Customer</h2>
            
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Name *</label>
                <input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number (Optional)</label>
                <input type="text" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Village / Town (Optional)</label>
                <input type="text" value={newCustVillage} onChange={(e) => setNewCustVillage(e.target.value)} placeholder="e.g. Rahaud" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address / Note (Optional)</label>
                <textarea value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} rows="2" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 resize-none"></textarea>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCustomerObj && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative animate-fade-in-down max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditingCustomerObj(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 font-bold transition-colors">✕</button>
            <h2 className="text-xl font-bold mb-4 text-slate-800 border-b border-slate-100 pb-2">Edit Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                <input value={editingCustomerObj.name} onChange={e=>setEditingCustomerObj({...editingCustomerObj, name: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                <input value={editingCustomerObj.phone} onChange={e=>setEditingCustomerObj({...editingCustomerObj, phone: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Village / Town</label>
                <input value={editingCustomerObj.village || ''} onChange={e=>setEditingCustomerObj({...editingCustomerObj, village: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address / Note</label>
                <textarea value={editingCustomerObj.address} onChange={e=>setEditingCustomerObj({...editingCustomerObj, address: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 resize-none" rows="2" />
              </div>
              
              <div className="border-t border-slate-200 pt-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Color Override</label>
                <select 
                  value={editingCustomerObj.manualColorOverride || ''} 
                  onChange={e=>setEditingCustomerObj({...editingCustomerObj, manualColorOverride: e.target.value})}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                >
                  <option value="">🕒 Auto-Calculate by Time</option>
                  <option value="emerald">🟢 Force Green (1st Month)</option>
                  <option value="yellow">🟡 Force Yellow (1 to 6 Months)</option>
                  <option value="red">🔴 Force Red (Over 6 Months)</option>
                </select>
              </div>

              <button onClick={handleSaveProfile} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors shadow-md">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm relative animate-fade-in-down">
            <button onClick={() => setEditingPayment(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 font-bold transition-colors">✕</button>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Edit Payment</h2>
            <p className="text-xs text-slate-500 mb-6 border-b border-slate-100 pb-4">Logged: {editingPayment.date}</p>
            
            <form onSubmit={handleSaveEditPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Amount (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={editPaymentAmount} 
                  onChange={(e) => setEditPaymentAmount(e.target.value)} 
                  className="w-full p-3 text-lg font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50 text-emerald-700" 
                  required 
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleDeletePayment} className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 font-bold py-3 rounded-xl transition-colors border border-red-200">
                  🗑️ Delete
                </button>
                <button type="submit" className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-md">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingBill && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewingBill(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-red-500 hover:text-white rounded-full text-slate-600 font-bold transition-colors">✕</button>
            
            <div id="receipt-capture-area" className="bg-white p-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Receipt #{viewingBill.id}</h2>
              <p className="text-sm text-slate-500 mb-4">{viewingBill.date}</p>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-sm">
                <p><strong>Cashier:</strong> {viewingBill.cashierName}</p>
                <p><strong>Payment Method:</strong> {viewingBill.paymentMethod}</p>
              </div>

              <h3 className="font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider border-b border-slate-200 pb-1">Items Purchased</h3>
              <div className="space-y-3 mb-6">
                {viewingBill.items.map(item => (
                  <div key={item.id} className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x ₹{item.price.toFixed(2)}</p>
                    </div>
                    <p className="font-bold text-slate-800">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-slate-200 pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal:</span><span>₹{viewingBill.subtotal.toFixed(2)}</span></div>
                {viewingBill.discountAmount > 0 && <div className="flex justify-between text-red-500"><span>Discount ({viewingBill.discountPercent}%):</span><span>-₹{viewingBill.discountAmount.toFixed(2)}</span></div>}
                {viewingBill.gstAmount > 0 && <div className="flex justify-between text-emerald-600"><span>GST ({viewingBill.gstPercent}%):</span><span>+₹{viewingBill.gstAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between text-xl font-bold text-slate-900 border-t border-slate-200 mt-2 pt-2"><span>Total:</span><span>₹{viewingBill.total.toFixed(2)}</span></div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button onClick={() => setViewingBill(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl transition-colors">Close</button>
              <button onClick={handleShareReceipt} className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-3 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2">
                <span>💬 WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="flex w-full md:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex-col h-[55vh] md:h-full overflow-hidden shrink-0 mt-12 md:mt-0">
        <h2 className={`text-2xl font-bold text-slate-800 mb-4 ${isSidebarHidden ? 'ml-12 md:ml-12' : ''}`}>Customer Directory</h2>
        
        <div className="flex flex-wrap gap-2 mb-4 shrink-0">
          <div className="relative flex-1 min-w-[150px]">
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search name or village..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-sm" 
            />
          </div>
          
          <select 
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-600 font-bold px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 shadow-sm min-w-[100px]"
          >
            <option value="all">🌍 All Villages</option>
            {uniqueVillages.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => {
                setShowCreditOnly(!showCreditOnly);
                setCreditColorFilter('all'); 
              }}
              className={`font-bold px-3 py-2 rounded-xl transition-colors shadow-sm whitespace-nowrap text-sm border flex items-center ${showCreditOnly ? 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              title="View customers with pending credit"
            >
              {showCreditOnly ? '👥 View All' : '💳 Credit Only'}
            </button>
          )}

          <button 
            onClick={() => setShowAddCustomerModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-sm"
          >
            + Add
          </button>
        </div>

        {/* Credit Color Sub-Filter Row */}
        {showCreditOnly && (
          <div className="flex gap-2 mb-4 overflow-x-auto shrink-0 pb-1 custom-scrollbar">
            <button 
              onClick={() => setCreditColorFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${creditColorFilter === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              All Credit
            </button>
            <button 
              onClick={() => setCreditColorFilter('emerald')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${creditColorFilter === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
            >
              🟢 <span className="hidden sm:inline">Green</span> (≤ 1M)
            </button>
            <button 
              onClick={() => setCreditColorFilter('yellow')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${creditColorFilter === 'yellow' ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm' : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'}`}
            >
              🟡 <span className="hidden sm:inline">Yellow</span> (1-6M)
            </button>
            <button 
              onClick={() => setCreditColorFilter('red')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${creditColorFilter === 'red' ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
            >
              🔴 <span className="hidden sm:inline">Red</span> (&gt; 6M)
            </button>
          </div>
        )}

        {/* Total Dynamic Credit Banner */}
        {totalFilteredCredit > 0 && (
          <div className="bg-slate-800 rounded-xl p-3 mb-4 flex justify-between items-center shrink-0 shadow-sm transition-all">
            <span className="text-slate-300 font-semibold text-[11px] uppercase tracking-widest">
              Total Outstanding
            </span>
            <span className="text-white font-bold text-lg">
              ₹{totalFilteredCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredCustomers.length === 0 ? (
            <p className="text-center text-slate-400 mt-10">No customers found.</p>
          ) : (
            filteredCustomers.map(customer => {
              const status = getCustomerStatus(customer);
              const isSelected = selectedCustomer?.id === customer.id;
              
              return (
                <div 
                  key={customer.id} 
                  onClick={() => handleSelectCustomer(customer)}
                  className={`p-4 rounded-xl border-l-[6px] border-y border-r cursor-pointer transition-all ${isSelected ? 'shadow-md ' + status.bg : 'bg-white hover:shadow-sm'} ${status.border} border-y-slate-100 border-r-slate-100`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-800 truncate pr-2">{customer.name}</h3>
                    {/* MODIFIED: Now shows the actual amount due in the card list */}
                    {customer.creditDue > 0 && (
                      <span className={`${status.badgeBg} ${status.text} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0`}>
                        Due: ₹{customer.creditDue.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>📞 {customer.phone || 'N/A'}</span>
                    <span className="font-medium text-slate-700">Spent: ₹{customer.totalSpent?.toFixed(2) || '0.00'}</span>
                  </div>
                  {customer.village && (
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                      🌍 {customer.village}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div ref={detailsRef} className="flex w-full md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex-col min-h-[60vh] md:h-full overflow-hidden shrink-0 mt-2 md:mt-0">
        {!selectedCustomer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
            <span className="text-6xl mb-4">👤</span>
            <p className="text-lg font-medium">Select a customer to view details</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            
            <div className={`p-4 md:p-6 border-b shrink-0 ${getCustomerStatus(selectedCustomer).bg} border-slate-200 transition-colors`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex justify-between items-start w-full">
                    <h2 className="text-3xl font-bold text-slate-800 truncate pr-2">{selectedCustomer.name}</h2>
                    {currentUser?.role === 'admin' && (
                      <button 
                        onClick={handleDeleteCustomer} 
                        className="text-xs font-bold text-red-400 hover:text-white border border-red-200 hover:bg-red-500 py-1.5 px-3 rounded-lg transition-colors shrink-0 bg-white"
                      >
                        Delete Profile
                      </button>
                    )}
                  </div>
                  <p className="text-slate-500 mt-1 font-mono text-sm">📞 {selectedCustomer.phone}</p>
                  <p className="text-xs text-slate-400 mt-1">Last Visit: {selectedCustomer.lastVisit}</p>
                  
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">
                    🌍 {selectedCustomer.village || 'No Village/Town Saved'}
                  </p>

                  <div className="mt-3">
                    <div className="group flex items-start gap-2 max-w-md">
                      <p className={`text-sm ${selectedCustomer.address ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                        {selectedCustomer.address ? `📍 ${selectedCustomer.address}` : 'No address saved.'}
                      </p>
                    </div>
                    <button onClick={() => setEditingCustomerObj(selectedCustomer)} className="text-blue-600 bg-white text-xs font-bold py-1.5 px-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors mt-2">
                      ✏️ Edit Profile & Color
                    </button>
                  </div>
                </div>
                
                <div className="bg-white border-2 border-slate-200 p-4 rounded-xl text-center shadow-sm min-w-[160px] w-full md:w-auto shrink-0 relative overflow-hidden">
                  {selectedCustomer.creditDue > 0 && (
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${getCustomerStatus(selectedCustomer).bg.replace('50', '400')}`}></div>
                  )}
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 mt-1">Total Credit Due</p>
                  <p className={`text-2xl font-bold ${selectedCustomer.creditDue > 0 ? getCustomerStatus(selectedCustomer).text : 'text-emerald-500'}`}>
                    ₹{selectedCustomer.creditDue.toFixed(2)}
                  </p>
                </div>

              </div>

              {selectedCustomer.creditDue > 0 && (
                <div className="mt-6 p-4 bg-white border border-slate-200 rounded-xl flex flex-col lg:flex-row gap-4 justify-between items-center shadow-sm">
                  <form onSubmit={handleSettleCredit} className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="Amount to pay..." 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-50 w-full sm:w-40 bg-slate-50"
                    />
                    <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0">
                      💵 Receive
                    </button>
                  </form>
                  
                  <button onClick={handleSendWhatsApp} className="w-full lg:w-auto bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm shrink-0">
                    <span>💬 Send Reminder</span>
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 flex-1 overflow-y-auto space-y-8 min-h-[300px] custom-scrollbar">
              {selectedCustomer.paymentHistory && selectedCustomer.paymentHistory.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Received Payments</h3>
                  <div className="space-y-3">
                    {selectedCustomer.paymentHistory.map(payment => (
                      <div key={payment.id} className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:shadow-sm transition-shadow">
                        <div>
                          <span className="font-bold text-emerald-700 mr-3">💰 Payment Logged</span>
                          <span className="text-sm text-slate-500 block sm:inline">{payment.date}</span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                          <span className="font-bold text-emerald-700 text-lg">+ ₹{payment.amount.toFixed(2)}</span>
                          <button 
                            onClick={() => openEditPayment(payment)} 
                            className="bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white p-2 rounded-lg transition-colors shadow-sm text-xs font-bold shrink-0"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Recent Purchase History</h3>
                {customerBills.length === 0 ? (
                  <p className="text-slate-400 text-sm">No recorded purchases in the system.</p>
                ) : (
                  <div className="space-y-4">
                    {customerBills.map(bill => (
                      <div 
                        key={bill.id} 
                        onClick={() => setViewingBill(bill)}
                        className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-md hover:border-blue-400 cursor-pointer transition-all group"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-bold text-blue-600 mr-3 group-hover:underline">#{bill.id}</span>
                            <span className="text-sm text-slate-500 block sm:inline">{bill.date}</span>
                          </div>
                          <span className="font-bold text-slate-800 text-lg">₹{bill.total.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide ${
                            bill.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' :
                            bill.paymentMethod === 'Credit' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            Paid via {bill.paymentMethod}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 hidden sm:block">{bill.items.length} item(s) purchased</span>
                            <span className="text-blue-500 font-bold opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity text-xs">View Details ➔</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}