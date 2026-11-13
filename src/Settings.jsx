import React, { useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore'; 
import { db } from './firebase'; 

export default function Settings({ storeDetails, setStoreDetails, isSidebarHidden, showSidebar, currentUser, globalUsers, setGlobalUsers, onPlatformLogout }) {
  const [name, setName] = useState(storeDetails?.name || '');
  const [phone, setPhone] = useState(storeDetails?.phone || '');
  const [email, setEmail] = useState(storeDetails?.email || ''); // 🔥 Added Email State
  const [address, setAddress] = useState(storeDetails?.address || '');
  const [gstNo, setGstNo] = useState(storeDetails?.gstNo || '');

  const handleSave = (e) => {
    e.preventDefault();
    setStoreDetails({ name, phone, email, address, gstNo }); // 🔥 Saving email
    alert("Store details updated successfully!");
  };

  const handleDeleteStore = async () => {
    const confirm1 = window.confirm("⚠️ DANGER: Are you sure you want to completely delete this store? All products, bills, and customers will be erased.");
    if (!confirm1) return;
    
    const confirm2 = window.confirm("This action is PERMANENT. Your username will be freed up for others to use, and you will be logged out. Proceed?");
    if (!confirm2) return;

    try {
      const dbFolder = currentUser.dbFolder || `shop_${currentUser.username}`;
      
      if (!dbFolder) {
         alert("Error: Could not determine your database folder.");
         return;
      }
      
      const updatedGlobalUsers = globalUsers.filter(u => (u.dbFolder || `shop_${u.username}`) !== dbFolder);
      setGlobalUsers(updatedGlobalUsers);
      
      if (onPlatformLogout) {
        onPlatformLogout();
      }

      setTimeout(async () => {
        try {
          await Promise.all([
            deleteDoc(doc(db, dbFolder, "pos_products")),
            deleteDoc(doc(db, dbFolder, "pos_bills")),
            deleteDoc(doc(db, dbFolder, "pos_purchases")),
            deleteDoc(doc(db, dbFolder, "pos_customers")),
            deleteDoc(doc(db, dbFolder, "pos_staff")),
            deleteDoc(doc(db, dbFolder, "pos_carts")),
            deleteDoc(doc(db, dbFolder, "pos_users")),
            deleteDoc(doc(db, dbFolder, "pos_store")),
            deleteDoc(doc(db, dbFolder, "pos_receipt_config"))
          ]);
          console.log(`Database folder ${dbFolder} completely wiped.`);
        } catch (err) {
          console.error("Failed background wipe:", err);
        }
      }, 500);

    } catch (error) {
      console.error("Error initiating store wipe:", error);
      alert("Something went wrong while initiating deletion.");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full overflow-y-auto h-full relative font-sans">
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      <div className="mt-12 sm:mt-0 mb-8">
        <h1 className={`text-3xl font-bold text-slate-800 ${isSidebarHidden ? 'ml-12' : ''}`}>Store Settings</h1>
        <p className={`text-slate-500 mt-1 ${isSidebarHidden ? 'ml-12' : ''}`}>Manage your basic store profile and dangerous actions.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Business Profile</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Store / Business Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>
          {/* 🔥 ADDED EMAIL FIELD */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Business Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" placeholder="store@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">GSTIN / Tax ID</label>
            <input type="text" value={gstNo} onChange={(e) => setGstNo(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Store Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows="3" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none"></textarea>
          </div>
          <div className="md:col-span-2 pt-2">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-md">
              Save Changes
            </button>
          </div>
        </form>
      </div>

      <div className="bg-red-50 p-6 md:p-8 rounded-2xl shadow-sm border border-red-200">
        <h2 className="text-xl font-bold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-red-500 text-sm mb-6">Proceed with extreme caution. These actions cannot be undone.</p>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-xl border border-red-100 shadow-sm">
          <div>
            <h3 className="font-bold text-slate-800">Delete Entire Store</h3>
            <p className="text-xs text-slate-500 mt-1">Wipes all data and frees your username.</p>
          </div>
          <button 
            onClick={handleDeleteStore}
            className="mt-4 sm:mt-0 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white font-bold py-2 px-6 rounded-lg transition-colors border border-red-200 hover:border-red-600"
          >
            Delete Store
          </button>
        </div>
      </div>

    </div>
  );
}