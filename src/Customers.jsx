import React, { useState } from 'react';

export default function Customers({ currentUser, customers, setCustomers, billHistory, storeDetails, isSidebarHidden, showSidebar }) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [viewingBill, setViewingBill] = useState(null);
  
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');

  // Role-Based Visibility Filter
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

  const accessibleCustomers = currentUser?.role === 'operator' 
    ? customers.filter(c => 
        (c.phone && c.phone !== 'N/A' && cashierBilledPhones.has(c.phone)) || 
        cashierBilledNames.has(c.name)
      )
    : customers;

  const filteredCustomers = accessibleCustomers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const customerBills = selectedCustomer 
    ? billHistory.filter(b => b.customerPhone === selectedCustomer.phone || (b.customerName === selectedCustomer.name && selectedCustomer.phone === 'N/A'))
    : [];

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

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 font-sans p-6 gap-6 overflow-y-auto relative">
      
      {/* MENU BUTTON */}
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
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
            
            <button onClick={() => setViewingBill(null)} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">Close Receipt</button>
          </div>
        </div>
      )}

      {/* LEFT COLUMN */}
      <div className="w-full md:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden shrink-0 mt-12 md:mt-0">
        <h2 className={`text-2xl font-bold text-slate-800 mb-4 ${isSidebarHidden ? 'md:ml-12' : ''}`}>Customer Directory</h2>
        
        <div className="relative mb-4 shrink-0">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none" 
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filteredCustomers.length === 0 ? (
            <p className="text-center text-slate-400 mt-10">No customers found in your records.</p>
          ) : (
            filteredCustomers.map(customer => (
              <div 
                key={customer.id} 
                onClick={() => setSelectedCustomer(customer)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedCustomer?.id === customer.id ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-slate-800">{customer.name}</h3>
                  {customer.creditDue > 0 && (
                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Credit Due
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>📞 {customer.phone || 'N/A'}</span>
                  <span className="font-medium text-slate-700">Spent: ₹{customer.totalSpent?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-full md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
        {!selectedCustomer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
            <span className="text-6xl mb-4">👤</span>
            <p className="text-lg font-medium">Select a customer to view details</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0 relative">
              
              {currentUser?.role === 'admin' && (
                <button 
                  onClick={handleDeleteCustomer} 
                  className="absolute top-4 right-4 text-xs font-bold text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 py-1 px-2 rounded transition-colors"
                >
                  Delete Profile
                </button>
              )}

              <div className="flex justify-between items-start mt-6 md:mt-0">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">{selectedCustomer.name}</h2>
                  <p className="text-slate-500 mt-1">📞 {selectedCustomer.phone}</p>
                  <p className="text-xs text-slate-400 mt-1">Last Visit: {selectedCustomer.lastVisit}</p>
                </div>
                
                <div className="bg-white border-2 border-slate-200 p-4 rounded-xl text-center shadow-sm min-w-[150px]">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Credit Due</p>
                  <p className={`text-2xl font-bold ${selectedCustomer.creditDue > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    ₹{selectedCustomer.creditDue.toFixed(2)}
                  </p>
                </div>
              </div>

              {selectedCustomer.creditDue > 0 && (
                <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex flex-col lg:flex-row gap-4 justify-between items-center">
                  <form onSubmit={handleSettleCredit} className="flex gap-2 w-full lg:w-auto">
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="Amount to pay..." 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="p-2 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 w-40"
                    />
                    <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap">
                      💵 Receive Payment
                    </button>
                  </form>
                  
                  <button onClick={handleSendWhatsApp} className="w-full lg:w-auto bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm">
                    <span>💬 Send WhatsApp Reminder</span>
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-8 min-h-[300px]">
              {selectedCustomer.paymentHistory && selectedCustomer.paymentHistory.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Received Payments</h3>
                  <div className="space-y-3">
                    {selectedCustomer.paymentHistory.map(payment => (
                      <div key={payment.id} className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center hover:shadow-sm transition-shadow">
                        <div>
                          <span className="font-bold text-emerald-700 mr-3">💰 Payment Logged</span>
                          <span className="text-sm text-slate-500">{payment.date}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-emerald-700 text-lg">+ ₹{payment.amount.toFixed(2)}</span>
                          <button 
                            onClick={() => openEditPayment(payment)} 
                            className="bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white p-2 rounded-lg transition-colors shadow-sm text-xs font-bold"
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
                            <span className="text-sm text-slate-500">{bill.date}</span>
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
                            <span className="text-xs text-slate-400">{bill.items.length} item(s) purchased</span>
                            <span className="text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-xs">View Details ➔</span>
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
    </div>
  );
}