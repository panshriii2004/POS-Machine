import React, { useState, useRef } from 'react';

export default function Purchases({ purchaseHistory = [], setPurchaseHistory, isSidebarHidden, showSidebar }) {
  const [selectedPartyId, setSelectedPartyId] = useState(null);

  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyGst, setPartyGst] = useState('');

  const [isEditingParty, setIsEditingParty] = useState(false);
  const [editPName, setEditPName] = useState('');
  const [editPPhone, setEditPPhone] = useState('');
  const [editPAddress, setEditPAddress] = useState('');
  const [editPGst, setEditPGst] = useState('');

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryInvoice, setEntryInvoice] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDebit, setEntryDebit] = useState('');
  const [entryCredit, setEntryCredit] = useState('');

  const dateRef = useRef(null);
  const invoiceRef = useRef(null);
  const amountRef = useRef(null);
  const debitRef = useRef(null);
  const creditRef = useRef(null);
  const submitBtnRef = useRef(null);

  const handleKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) nextRef.current.focus();
    }
  };

  const resetEntryForm = () => {
    setEditingEntryId(null);
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryInvoice('');
    setEntryAmount('');
    setEntryDebit('');
    setEntryCredit('');
    setTimeout(() => { if (dateRef.current) dateRef.current.focus(); }, 100);
  };

  const handleSelectParty = (id) => {
    setSelectedPartyId(id);
    setIsEditingParty(false);
    resetEntryForm();
  };

  const handleCreateParty = (e) => {
    e.preventDefault();
    if (!partyName.trim()) return alert("Party Name is required!");
    const newParty = { id: Date.now().toString(), name: partyName, phone: partyPhone, address: partyAddress, gstNo: partyGst.toUpperCase(), ledger: [] };
    setPurchaseHistory([newParty, ...purchaseHistory]);
    setPartyName(''); setPartyPhone(''); setPartyAddress(''); setPartyGst('');
  };

  const startEditingParty = (party) => {
    setEditPName(party.name); setEditPPhone(party.phone); setEditPGst(party.gstNo); setEditPAddress(party.address);
    setIsEditingParty(true);
  };

  const savePartyEdit = () => {
    if (!editPName.trim()) return alert("Party Name is required!");
    const updatedHistory = purchaseHistory.map(p => p.id === selectedPartyId ? { ...p, name: editPName, phone: editPPhone, gstNo: editPGst.toUpperCase(), address: editPAddress } : p);
    setPurchaseHistory(updatedHistory);
    setIsEditingParty(false);
  };

  const handleDeleteParty = (partyId) => {
    if (window.confirm("🚨 WARNING: Are you sure you want to completely delete this party AND all of their ledger records? This cannot be undone!")) {
      setPurchaseHistory(purchaseHistory.filter(p => p.id !== partyId));
      if (selectedPartyId === partyId) setSelectedPartyId(null);
    }
  };

  const handleSaveEntry = (e) => {
    e.preventDefault();
    if (!entryDate) return alert("Date is required!");
    const entryData = { id: editingEntryId || Date.now().toString(), date: entryDate, invoiceNo: entryInvoice || '-', amount: parseFloat(entryAmount) || 0, debit: parseFloat(entryDebit) || 0, credit: parseFloat(entryCredit) || 0 };
    
    const updatedHistory = purchaseHistory.map(party => {
      if (party.id === selectedPartyId) {
        if (editingEntryId) return { ...party, ledger: party.ledger.map(entry => entry.id === editingEntryId ? entryData : entry) };
        else return { ...party, ledger: [...party.ledger, entryData] };
      }
      return party;
    });

    setPurchaseHistory(updatedHistory);
    resetEntryForm();
  };

  const editEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEntryDate(entry.date);
    setEntryInvoice(entry.invoiceNo === '-' ? '' : entry.invoiceNo);
    setEntryAmount(entry.amount === 0 ? '' : entry.amount);
    setEntryDebit(entry.debit === 0 ? '' : entry.debit);
    setEntryCredit(entry.credit === 0 ? '' : entry.credit);
    if (dateRef.current) dateRef.current.focus();
  };

  const handleDeleteEntry = (partyId, entryId) => {
    if (!window.confirm("Delete this record?")) return;
    const updatedHistory = purchaseHistory.map(party => party.id === partyId ? { ...party, ledger: party.ledger.filter(entry => entry.id !== entryId) } : party);
    setPurchaseHistory(updatedHistory);
    if (editingEntryId === entryId) resetEntryForm();
  };

  if (selectedPartyId) {
    const party = purchaseHistory.find(p => p.id === selectedPartyId);
    if (!party) { setSelectedPartyId(null); return null; }

    const totalDebit = party.ledger.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = party.ledger.reduce((sum, item) => sum + item.credit, 0);
    const totalAmount = party.ledger.reduce((sum, item) => sum + item.amount, 0);
    const balance = totalCredit - totalDebit; 

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
          <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
            <div className="flex-1 w-full">
              <button onClick={() => handleSelectParty(null)} className="text-slate-500 hover:text-blue-600 font-bold mb-2 flex items-center gap-1 transition-colors">← Back to Parties</button>
              
              {isEditingParty ? (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 max-w-xl">
                  <div className="flex gap-2">
                    <input type="text" value={editPName} onChange={e => setEditPName(e.target.value)} placeholder="Party Name" className="flex-1 p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                    <input type="text" value={editPPhone} onChange={e => setEditPPhone(e.target.value)} placeholder="Phone" className="flex-1 p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={editPGst} onChange={e => setEditPGst(e.target.value)} placeholder="GST Number" className="flex-1 p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
                    <input type="text" value={editPAddress} onChange={e => setEditPAddress(e.target.value)} placeholder="Address" className="flex-[2] p-2 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={savePartyEdit} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1.5 px-4 rounded transition-colors shadow-sm">Save Details</button>
                    <button onClick={() => setIsEditingParty(false)} className="bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold py-1.5 px-4 rounded transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold text-slate-800">{party.name}</h2>
                    <button onClick={() => startEditingParty(party)} className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs font-bold transition-colors">✏️ Edit</button>
                    <button onClick={() => handleDeleteParty(party.id)} className="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 px-2 py-1 rounded text-xs font-bold transition-colors shadow-sm">🗑️ Delete Party</button>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600 font-medium">
                    {party.phone && <span>📞 {party.phone}</span>}
                    {party.gstNo && <span>🏢 GST: {party.gstNo}</span>}
                    {party.address && <span>📍 {party.address}</span>}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 text-right shrink-0">
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl min-w-[120px]">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Total Paid (Debit)</p>
                    <p className="text-xl font-bold text-slate-800">₹{totalDebit.toFixed(2)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl min-w-[120px]">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Bill (Credit)</p>
                    <p className="text-xl font-bold text-slate-800">₹{totalCredit.toFixed(2)}</p>
                </div>
                <div className={`p-3 rounded-xl min-w-[120px] border ${balance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-100 border-slate-200'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${balance > 0 ? 'text-orange-600' : 'text-slate-500'}`}>Outstanding</p>
                    <p className="text-xl font-bold text-slate-800">₹{Math.max(0, balance).toFixed(2)}</p>
                </div>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-2xl shadow-sm border shrink-0 transition-colors ${editingEntryId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-bold ${editingEntryId ? 'text-blue-800' : 'text-slate-800'}`}>{editingEntryId ? '✏️ Editing Record' : 'Add New Record'}</h3>
            {editingEntryId && <button type="button" onClick={resetEntryForm} className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">Cancel Edit</button>}
          </div>
          
          <form onSubmit={handleSaveEntry} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input ref={dateRef} onKeyDown={(e) => handleKeyDown(e, invoiceRef)} type="date" required value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice No.</label><input ref={invoiceRef} onKeyDown={(e) => handleKeyDown(e, amountRef)} type="text" placeholder="INV-001" value={entryInvoice} onChange={e => setEntryInvoice(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
            <div className="flex-1 min-w-[120px]"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₹)</label><input ref={amountRef} onKeyDown={(e) => handleKeyDown(e, debitRef)} type="number" step="0.01" placeholder="0.00" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" /></div>
            <div className="flex-1 min-w-[120px]"><label className="block text-xs font-bold text-red-400 uppercase mb-1">Debit/Paid (₹)</label><input ref={debitRef} onKeyDown={(e) => handleKeyDown(e, creditRef)} type="number" step="0.01" placeholder="0.00" value={entryDebit} onChange={e => setEntryDebit(e.target.value)} className="w-full p-2.5 border border-red-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-red-50 text-red-700 font-bold" /></div>
            <div className="flex-1 min-w-[120px]"><label className="block text-xs font-bold text-emerald-500 uppercase mb-1">Credit/Bill (₹)</label><input ref={creditRef} onKeyDown={(e) => handleKeyDown(e, submitBtnRef)} type="number" step="0.01" placeholder="0.00" value={entryCredit} onChange={e => setEntryCredit(e.target.value)} className="w-full p-2.5 border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-700 font-bold" /></div>
            <button ref={submitBtnRef} type="submit" className={`${editingEntryId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold px-6 py-2.5 rounded-lg transition-colors h-[46px] shadow-sm`}>{editingEntryId ? 'Update Record' : '+ Add Record'}</button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50"><h3 className="font-bold text-slate-800">Transaction History</h3></div>
          <div className="overflow-y-auto flex-1 p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <tr className="text-slate-500 uppercase text-xs tracking-wider"><th className="p-4 font-bold">Date</th><th className="p-4 font-bold">Invoice No.</th><th className="p-4 font-bold text-right">Amount (₹)</th><th className="p-4 font-bold text-right text-red-500">Debit (₹)</th><th className="p-4 font-bold text-right text-emerald-600">Credit (₹)</th><th className="p-4 font-bold text-center">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {party.ledger.length === 0 ? (
                  <tr><td colSpan="6" className="text-center p-8 text-slate-400">No records found. Add your first purchase above!</td></tr>
                ) : (
                  party.ledger.map((entry) => (
                    <tr key={entry.id} className={`transition-colors ${editingEntryId === entry.id ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-4 font-medium text-slate-700">{entry.date}</td><td className="p-4 font-mono text-sm text-slate-600">{entry.invoiceNo}</td><td className="p-4 text-right font-semibold text-slate-800">{entry.amount > 0 ? entry.amount.toFixed(2) : '-'}</td><td className="p-4 text-right font-bold text-red-500">{entry.debit > 0 ? entry.debit.toFixed(2) : '-'}</td><td className="p-4 text-right font-bold text-emerald-600">{entry.credit > 0 ? entry.credit.toFixed(2) : '-'}</td>
                      <td className="p-4 text-center space-x-3"><button onClick={() => editEntry(entry)} className="text-blue-500 hover:text-blue-700 text-sm font-bold" title="Edit Record">✏️</button><button onClick={() => handleDeleteEntry(party.id, entry.id)} className="text-red-400 hover:text-red-600 text-sm font-bold" title="Delete Record">🗑️</button></td>
                    </tr>
                  ))
                )}
              </tbody>
              {party.ledger.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold"><tr><td colSpan="2" className="p-4 text-right text-slate-600 uppercase tracking-wider text-xs">Totals:</td><td className="p-4 text-right text-slate-800 text-lg">₹{totalAmount.toFixed(2)}</td><td className="p-4 text-right text-red-500 text-lg">₹{totalDebit.toFixed(2)}</td><td className="p-4 text-right text-emerald-600 text-lg">₹{totalCredit.toFixed(2)}</td><td></td></tr></tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col md:flex-row gap-6 overflow-y-auto bg-slate-50 font-sans relative">
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      <div className="w-full md:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit mt-12 md:mt-0">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><span>🏢</span> Create New Party</h2>
        <form onSubmit={handleCreateParty} className="space-y-4">
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Party Name *</label><input required type="text" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g. ABC Wholesalers" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label><input type="text" value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">GST Number</label><input type="text" value={partyGst} onChange={(e) => setPartyGst(e.target.value)} placeholder="22AAAAA0000A1Z5" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 uppercase" /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label><textarea value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} rows="2" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none"></textarea></div>
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-2">+ Save Party Profile</button>
        </form>
      </div>

      <div className="w-full md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0 mt-12 md:mt-0">
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Your Parties / Suppliers</h2><span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">{purchaseHistory.length} Registered</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {purchaseHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px]"><span className="text-4xl mb-3">📇</span><p className="font-medium">No parties registered yet.</p><p className="text-sm">Create your first supplier on the left to start tracking purchases.</p></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {purchaseHistory.map(party => {
                const totalDebit = party.ledger.reduce((sum, item) => sum + item.debit, 0);
                const totalCredit = party.ledger.reduce((sum, item) => sum + item.credit, 0);
                const balance = totalCredit - totalDebit;
                return (
                  <div key={party.id} onClick={() => handleSelectParty(party.id)} className="p-5 border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md cursor-pointer transition-all bg-white group">
                    <div className="flex justify-between items-start mb-3"><h3 className="font-bold text-slate-800 group-hover:text-blue-600 text-lg truncate">{party.name}</h3><span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold">{party.ledger.length} entries</span></div>
                    <div className="space-y-1 mb-4 text-sm text-slate-500">{party.phone && <p>📞 {party.phone}</p>}{party.gstNo && <p>🏢 {party.gstNo}</p>}</div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase">Pending Balance:</span><span className={`font-bold ${balance > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{balance > 0 ? `₹${balance.toFixed(2)}` : 'Settled'}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}