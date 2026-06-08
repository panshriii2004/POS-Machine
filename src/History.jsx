import React, { useState } from 'react';

export default function History({ 
  currentUser, 
  billHistory, setBillHistory, products, setProducts, 
  setActiveTab, carts, setCarts, setActiveCartId,
  isSidebarHidden, showSidebar
}) {
  const [selectedBill, setSelectedBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const handleReturnItem = (billId, item) => {
    const maxToReturn = item.quantity - (item.returnedQty || 0);
    if (maxToReturn <= 0) return alert("All quantities of this item have already been returned.");

    const input = window.prompt(`How many '${item.name}' would you like to return? (Max: ${maxToReturn})`, "1");
    if (!input) return;

    const qtyToReturn = parseInt(input, 10);
    if (isNaN(qtyToReturn) || qtyToReturn <= 0 || qtyToReturn > maxToReturn) {
      return alert("Invalid quantity entered.");
    }

    const refundAmount = item.price * qtyToReturn;
    const bill = billHistory.find(b => b.id === billId);
    const discountAmount = refundAmount * ((bill?.discountPercent || 0) / 100);
    const discountedRefund = refundAmount - discountAmount;
    const gstAmount = discountedRefund * ((bill?.gstPercent || 0) / 100);
    const finalRefund = discountedRefund + gstAmount;

    const updatedHistory = billHistory.map(bill => {
      if (bill.id === billId) {
        const updatedItems = bill.items.map(i => {
          if (i.id === item.id) {
            const newReturnedQty = (i.returnedQty || 0) + qtyToReturn;
            return { ...i, returnedQty: newReturnedQty, returned: newReturnedQty === i.quantity, returnDate: new Date().toLocaleDateString() };
          }
          return i;
        });

        const newRefundTotal = (bill.refundTotal || 0) + finalRefund;
        const updatedBill = { ...bill, items: updatedItems, refundTotal: newRefundTotal };
        if (selectedBill && selectedBill.id === billId) setSelectedBill(updatedBill);
        return updatedBill;
      }
      return bill;
    });

    setBillHistory(updatedHistory);
    setProducts(products.map(p => p.id === item.id ? { ...p, stock: p.stock + qtyToReturn } : p));
  };

  const handleReopenInPOS = (bill) => {
    if (!window.confirm("This will void this bill and open the items in the Register so you can edit the sale. Proceed?")) return;

    setBillHistory(billHistory.filter(b => b.id !== bill.id));

    const itemsForCart = bill.items
      .filter(i => (i.quantity - (i.returnedQty || 0)) > 0)
      .map(i => ({ ...i, quantity: i.quantity - (i.returnedQty || 0), returnedQty: 0, returned: false }));
    
    const reopenedCart = {
      id: Date.now(),
      title: `Reopened #${bill.id}`,
      invoice: itemsForCart,
      customerName: bill.customerName === 'Walk-in Customer' ? '' : bill.customerName,
      customerPhone: bill.customerPhone === 'N/A' ? '' : bill.customerPhone,
      discountPercent: bill.discountPercent === 0 ? '' : bill.discountPercent,
      gstPercent: bill.gstPercent === 0 ? '' : bill.gstPercent,
      paymentMethod: bill.paymentMethod || 'Cash'
    };

    setCarts([...carts, reopenedCart]);
    setActiveCartId(reopenedCart.id);

    setSelectedBill(null);
    setActiveTab('POS'); 
  };

  const filteredHistory = billHistory.filter(bill => {
    if (currentUser?.role === 'operator' && bill.cashierId !== currentUser.id) {
      return false; 
    }

    const matchesPayment = paymentFilter === 'All' || bill.paymentMethod === paymentFilter;
    
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      bill.id.toLowerCase().includes(query) ||
      (bill.customerName && bill.customerName.toLowerCase().includes(query)) ||
      (bill.customerPhone && bill.customerPhone.includes(query));

    return matchesPayment && matchesSearch;
  });

  if (selectedBill) {
    return (
      <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto bg-slate-50 font-sans relative">
        {isSidebarHidden && (
          <button 
            onClick={showSidebar}
            className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
            title="Show Menu"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        )}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-4xl mx-auto w-full mt-12 md:mt-0">
          <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Bill Details</h2>
              <p className="text-slate-500">Receipt #{selectedBill.id} • {selectedBill.date}</p>
              {selectedBill.cashierName && (
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                  Cashier: {selectedBill.cashierName}
                </p>
              )}
              <p className="text-sm font-bold text-blue-600 mt-1 flex items-center gap-2">
                Paid via: {selectedBill.paymentMethod || 'Cash'}
                {selectedBill.paymentMethod === 'Credit' && (
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] tracking-wider uppercase border border-orange-200">
                    Credit Account
                  </span>
                )}
              </p>
            </div>
            <button onClick={() => setSelectedBill(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition">
              ← Back to List
            </button>
          </div>

          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Customer Information</h3>
              <p className="text-slate-800"><strong>Name:</strong> {selectedBill.customerName}</p>
              <p className="text-slate-800"><strong>Phone:</strong> {selectedBill.customerPhone}</p>
            </div>
            
            <button onClick={() => handleReopenInPOS(selectedBill)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-colors">
              ✏️ Reopen & Edit in Register
            </button>
          </div>

          <h3 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider">Purchased Items</h3>
          <table className="w-full text-left mb-6">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-sm">
                <th className="p-3 rounded-tl-lg">Item</th>
                <th className="p-3 text-center">Purchased</th>
                <th className="p-3 text-center text-red-500">Returned</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedBill.items.map((item) => (
                <tr key={item.id} className={item.returned ? "bg-red-50/50" : ""}>
                  <td className="p-3 font-medium text-slate-800">
                    <span className={item.returned ? "line-through text-slate-500" : ""}>{item.name}</span> <br/>
                    <span className="text-xs text-slate-500 font-normal">@ ₹{item.price.toFixed(2)}/ea</span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">{item.quantity}</td>
                  <td className="p-3 text-center font-bold text-red-500">{item.returnedQty > 0 ? item.returnedQty : "-"}</td>
                  <td className="p-3 text-right font-bold text-slate-800">
                    <span className={item.returned ? "line-through text-slate-400" : ""}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {item.returned ? (
                      <span className="text-xs font-bold text-red-600 bg-red-100 py-1 px-2 rounded-md">Fully Returned</span>
                    ) : (
                      <button onClick={() => handleReturnItem(selectedBill.id, item)} className="text-xs font-bold bg-slate-200 hover:bg-red-500 hover:text-white text-slate-700 py-1.5 px-3 rounded-md transition-colors">
                        ↩️ Return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t-2 border-slate-200 pt-4 w-72 ml-auto">
            <div className="flex justify-between text-slate-500 mb-2"><span>Original Subtotal:</span><span>₹{selectedBill.subtotal?.toFixed(2) || "0.00"}</span></div>
            {selectedBill.discountAmount > 0 && <div className="flex justify-between text-slate-500 mb-2"><span>Discount ({selectedBill.discountPercent}%):</span><span className="text-red-400">-₹{selectedBill.discountAmount.toFixed(2)}</span></div>}
            {selectedBill.gstAmount > 0 && <div className="flex justify-between text-slate-500 mb-2"><span>GST ({selectedBill.gstPercent}%):</span><span className="text-emerald-500">+₹{selectedBill.gstAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2"><span>Original Total:</span><span>₹{selectedBill.total.toFixed(2)}</span></div>
            {selectedBill.refundTotal > 0 && <div className="flex justify-between text-lg font-bold text-red-500 mt-2 p-2 bg-red-50 rounded-lg border border-red-100"><span>Total Refunded:</span><span>-₹{selectedBill.refundTotal.toFixed(2)}</span></div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto bg-slate-50 font-sans relative">
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-12 md:mt-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-bold text-slate-800">📜 Bill History</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
              <input type="text" placeholder="Search Name, Invoice, or Phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64" />
            </div>
            
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="py-2 px-4 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-slate-700">
              <option value="All">All Payments</option>
              <option value="Cash">Cash Only</option>
              <option value="Online">Online Only</option>
              <option value="Credit">Credit Only</option>
            </select>
          </div>
        </div>
        
        {filteredHistory.length === 0 ? (
          <div className="text-center text-slate-400 py-10 font-medium text-lg">
            {billHistory.length === 0 ? "No bills generated yet. Complete a sale to see it here!" : "No bills match your search/filter criteria."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-slate-500 uppercase text-xs tracking-wider">
                  <th className="p-4 font-bold">Receipt ID</th>
                  <th className="p-4 font-bold">Date & Time</th>
                  <th className="p-4 font-bold">Customer</th>
                  <th className="p-4 font-bold text-center">Payment</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((bill) => {
                  const hasReturns = bill.items.some(item => item.returnedQty > 0);
                  return (
                    <tr key={bill.id} onClick={() => setSelectedBill(bill)} className="hover:bg-blue-50 transition-colors cursor-pointer group">
                      <td className="p-4 font-mono font-bold text-blue-600 group-hover:underline">
                        #{bill.id}
                        {currentUser?.role === 'admin' && bill.cashierName && (
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">By: {bill.cashierName}</div>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 text-sm">{bill.date}</td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">
                          {bill.customerName}
                          {bill.paymentMethod === 'Credit' && <span className="ml-2 text-[10px] text-orange-500 font-bold border border-orange-500 px-1 rounded">CREDIT</span>}
                        </div>
                        {bill.customerPhone !== 'N/A' && <div className="text-xs text-slate-500">{bill.customerPhone}</div>}
                      </td>
                      
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                          bill.paymentMethod === 'Cash' ? 'bg-green-50 text-green-700 border-green-200' :
                          bill.paymentMethod === 'Online' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          {bill.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {hasReturns ? (
                          <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-full text-xs">Refund Processed</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full text-xs">Completed</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800 text-lg">₹{bill.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}