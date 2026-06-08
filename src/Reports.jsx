import React, { useState, useMemo } from 'react';

export default function Reports({ billHistory }) {
  const [timeFilter, setTimeFilter] = useState('Daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- THE FIX: Smart Date Decoder ---
  // This automatically detects if your PC uses DD/MM or MM/DD and forces JavaScript to read it correctly!
  const parseDateSafely = (dateStr) => {
    if (!dateStr) return new Date();
    
    // Extract just the date part (e.g., "02/04/2026" from "02/04/2026, 11:25:46 am")
    const datePart = dateStr.split(',')[0].trim();
    const parts = datePart.split(/[\/\-]/);
    
    if (parts.length === 3) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const p3 = parseInt(parts[2], 10);
      
      if (p3 > 2000) {
        // Test the browser's local format using Nov 25th
        const testDate = new Date(2023, 10, 25); 
        if (testDate.toLocaleDateString().startsWith('25')) {
          // If it starts with 25, your region is DD/MM/YYYY
          return new Date(p3, p2 - 1, p1); 
        } else {
          // Otherwise, it's MM/DD/YYYY
          return new Date(p3, p1 - 1, p2); 
        }
      }
    }
    return new Date(dateStr); // Fallback standard parser
  };

  // Math logic to intelligently filter dates
  const filteredData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of exactly today
    
    return billHistory.filter(bill => {
      const billDate = parseDateSafely(bill.date);
      const billDateMidnight = new Date(billDate);
      billDateMidnight.setHours(0, 0, 0, 0); // Normalize time

      if (timeFilter === 'Daily') {
        return billDateMidnight.getTime() === today.getTime();
      }
      
      if (timeFilter === 'Weekly') {
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        return billDateMidnight >= oneWeekAgo;
      }
      
      if (timeFilter === 'Monthly') {
        return billDate.getMonth() === today.getMonth() && billDate.getFullYear() === today.getFullYear();
      }
      
      if (timeFilter === 'Yearly') {
        return billDate.getFullYear() === today.getFullYear();
      }
      
      if (timeFilter === 'Custom Range') {
        if (!startDate || !endDate) return true; // Show all if user hasn't picked both dates
        
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        return billDate >= start && billDate <= end;
      }
      
      return true; // 'All Time'
    });
  }, [billHistory, timeFilter, startDate, endDate]);

  // Calculate Totals based on the filtered data
  const totalSales = filteredData.reduce((sum, bill) => sum + (bill.total || 0), 0);
  const totalGST = filteredData.reduce((sum, bill) => sum + (bill.gstAmount || 0), 0);
  const totalDiscounts = filteredData.reduce((sum, bill) => sum + (bill.discountAmount || 0), 0);
  const totalRefunds = filteredData.reduce((sum, bill) => sum + (bill.refundTotal || 0), 0);
  const netRevenue = totalSales - totalRefunds;

  return (
    <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto bg-slate-50 font-sans">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-bold text-slate-800">📊 Business Reports</h2>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-lg">
              {['Daily', 'Weekly', 'Monthly', 'Yearly', 'All Time', 'Custom Range'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setTimeFilter(f)} 
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${timeFilter === f ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Custom Date Calendar Inputs */}
            {timeFilter === 'Custom Range' && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 p-2 rounded-lg shadow-sm">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-1.5 text-sm border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-blue-800 font-semibold"
                />
                <span className="text-blue-500 font-bold">to</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-1.5 text-sm border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-blue-800 font-semibold"
                />
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-1">Net Revenue</p>
            <h3 className="text-3xl font-bold text-emerald-800">₹{netRevenue.toFixed(2)}</h3>
            <p className="text-xs text-emerald-600 mt-2">After refunds</p>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1">Gross Sales</p>
            <h3 className="text-2xl font-bold text-blue-800">₹{totalSales.toFixed(2)}</h3>
            <p className="text-xs text-blue-600 mt-2">{filteredData.length} Invoices generated</p>
          </div>
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm font-bold text-red-600 uppercase tracking-wider mb-1">Total Refunds</p>
            <h3 className="text-2xl font-bold text-red-800">-₹{totalRefunds.toFixed(2)}</h3>
            <p className="text-xs text-red-600 mt-2">Money returned</p>
          </div>
          <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
            <p className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-1">Taxes Collected (GST)</p>
            <h3 className="text-2xl font-bold text-purple-800">₹{totalGST.toFixed(2)}</h3>
            <p className="text-xs text-purple-600 mt-2">Discounts given: ₹{totalDiscounts.toFixed(2)}</p>
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-700 mb-4">
          Transactions for {timeFilter === 'Custom Range' && startDate && endDate ? `${startDate} to ${endDate}` : timeFilter}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-y border-slate-200">
              <tr className="text-slate-500 uppercase text-xs tracking-wider">
                <th className="p-3">Date</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Method</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr><td colSpan="4" className="p-4 text-center text-slate-500 font-medium">No sales found for this period.</td></tr>
              ) : (
                filteredData.map(bill => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="p-3 text-sm text-slate-600">{bill.date}</td>
                    <td className="p-3 text-sm font-mono text-blue-600">#{bill.id}</td>
                    <td className="p-3 text-sm font-bold text-slate-600">{bill.paymentMethod || 'Cash'}</td>
                    <td className="p-3 text-right font-bold text-slate-800">₹{bill.total.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}