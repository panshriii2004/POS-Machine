import React from 'react';

export default function Settings({ storeDetails, setStoreDetails, isSidebarHidden, showSidebar }) {
  const handleChange = (e) => {
    setStoreDetails({ ...storeDetails, [e.target.name]: e.target.value });
  };

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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto w-full mt-12 md:mt-0">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">⚙️ Store Settings</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Store Name</label>
            <input 
              type="text" name="name" value={storeDetails.name} onChange={handleChange} 
              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              placeholder="e.g. SuperMart POS"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Phone Number</label>
            <input 
              type="text" name="phone" value={storeDetails.phone} onChange={handleChange} 
              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              placeholder="e.g. +91 98765 43210"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">Store Address</label>
            <textarea 
              name="address" value={storeDetails.address} onChange={handleChange} rows="3"
              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              placeholder="e.g. 123 Main Market, City, State"
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">GST Number</label>
            <input 
              type="text" name="gstNo" value={storeDetails.gstNo} onChange={handleChange} 
              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white uppercase"
              placeholder="e.g. 22AAAAA0000A1Z5"
            />
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-800 flex items-center gap-2 font-medium">
            <span>💡</span> These details will automatically appear at the top of every printed receipt. Changes are saved instantly!
          </p>
        </div>
      </div>
    </div>
  );
}