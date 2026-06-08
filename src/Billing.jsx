import React from 'react';

export default function Billing({ invoice, setInvoice, updateQuantity, removeFromInvoice, setActiveTab }) {
  
  const subtotal = invoice.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.1; // 10% Tax
  const total = subtotal + tax;

  const handleGenerateInvoice = () => {
    alert(`Invoice Generated successfully for $${total.toFixed(2)}!\nSending to printer...`);
    setInvoice([]); // Clear cart
    setActiveTab('POS'); // Send user back to register for the next customer
  };

  if (invoice.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Your Cart is Empty</h2>
        <p className="text-slate-500 mb-6">Go back to the register to scan or select products.</p>
        <button 
          onClick={() => setActiveTab('POS')}
          className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:bg-blue-700 transition"
        >
          Return to Register
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 p-6 flex flex-col md:flex-row gap-6 overflow-hidden">
      
      {/* LEFT: Item List */}
      <div className="w-full md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Review Items</h2>
        </div>
        
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {invoice.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex-1 mb-4 sm:mb-0">
                <p className="font-bold text-lg text-slate-800">{item.name}</p>
                <p className="text-sm text-slate-500 font-mono">Barcode: {item.barcode}</p>
                <p className="text-slate-600 mt-1">${item.price.toFixed(2)} / each</p>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Quantity Controls */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
                  <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold text-lg rounded-l-lg">-</button>
                  <span className="font-bold w-12 text-center border-x border-slate-200 h-10 flex items-center justify-center bg-slate-50">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 text-slate-600 font-bold text-lg rounded-r-lg">+</button>
                </div>
                
                <div className="text-right min-w-[80px]">
                  <p className="font-bold text-xl text-slate-900">${(item.price * item.quantity).toFixed(2)}</p>
                  <button onClick={() => removeFromInvoice(item.id)} className="text-red-500 hover:text-red-700 text-sm font-bold mt-1">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Payment Summary */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Payment Summary</h2>
          
          <div className="space-y-4 mb-6 text-slate-600">
            <div className="flex justify-between text-lg">
              <span>Items ({invoice.length}):</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Estimated Tax (10%):</span>
              <span className="font-semibold">${tax.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="flex justify-between text-2xl font-bold text-slate-900 pt-6 border-t border-slate-200 mb-8">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          
          <button 
            onClick={handleGenerateInvoice}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xl shadow-lg transition-all"
          >
            Generate Final Bill
          </button>
          <button 
            onClick={() => {
               if(window.confirm('Are you sure you want to clear the entire cart?')) setInvoice([]);
            }}
            className="w-full mt-3 py-3 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-all"
          >
            Clear Cart
          </button>
        </div>
      </div>

    </div>
  );
}