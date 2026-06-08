import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase'; 

import Login from './Login';
import Team from './Team';
import Staff from './Staff'; // <-- Brought in your new HR file!
import Dashboard from './Dashboard';
import Inventory from './Inventory';
import History from './History';
import Settings from './Settings';
import Hardware from './Hardware';
import Reports from './Reports';
import Purchases from './Purchases';
import Customers from './Customers'; 

// Default Data 
const initialProducts = [{ id: 1, name: 'Sample Item', price: 100, stock: 50, barcode: '123456789' }];

const defaultUsers = [
  { id: '1', name: 'Master Admin', username: 'admin', password: 'password', role: 'admin', shopName: 'My First Store' },
  { id: 'legacy', name: 'Legacy Store', username: 'admin01', password: 'password', role: 'admin', shopName: 'Original Store', dbFolder: 'store_db' }
];

const defaultCarts = [{ id: Date.now(), title: 'Cart 1', invoice: [], customerName: '', customerPhone: '', discountPercent: '', gstPercent: '', paymentMethod: 'Cash' }];

// --- THE MAGIC CLOUD HOOK ---
function useCloudState(collectionName, docName, defaultValue) {
  const [state, setState] = useState(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, collectionName, docName), (docSnap) => {
      if (docSnap.exists()) {
        setState(docSnap.data().data);
      } else {
        setDoc(doc(db, collectionName, docName), { data: defaultValue })
          .catch(err => console.error(`❌ FIREBASE BLOCKED CREATING ${collectionName}:`, err));
        setState(defaultValue);
      }
      setIsLoaded(true);
    }, (error) => console.error(`❌ FIREBASE READ ERROR:`, error));
    
    return () => unsub(); 
  }, [collectionName, docName]);

  const setCloudState = (newValue) => {
    const resolvedValue = typeof newValue === 'function' ? newValue(state) : newValue;
    setState(resolvedValue); 
    setDoc(doc(db, collectionName, docName), { data: resolvedValue })
      .catch(err => console.error(`❌ FIREBASE BLOCKED SAVING TO ${collectionName}:`, err));
  };

  return [state, setCloudState, isLoaded];
}


// ============================================================================
// 1. THIS IS THE ISOLATED SHOP POS 
// ============================================================================
function MainPOS({ currentUser, onPlatformLogout, globalUsers, setGlobalUsers }) {
  
  const dbFolder = currentUser.dbFolder || `shop_${currentUser.username}`;

  // --- STORE SPECIFIC DATABASE CONNECTIONS ---
  const [products, setProducts, productsLoaded] = useCloudState(dbFolder, "pos_products", initialProducts);
  const [billHistory, setBillHistory, billsLoaded] = useCloudState(dbFolder, "pos_bills", []);
  const [purchaseHistory, setPurchaseHistory, purchasesLoaded] = useCloudState(dbFolder, "pos_purchases", []);
  const [carts, setCarts, cartsLoaded] = useCloudState(dbFolder, "pos_carts", defaultCarts);
  const [localCustomers, setLocalCustomers, customersLoaded] = useCloudState(dbFolder, "pos_customers", []);
  
  // 🔥 SAFELY PLACED: The HR Database connection is now inside the logged-in area!
  const [localStaff, setLocalStaff, staffLoaded] = useCloudState(dbFolder, "pos_staff", []);
  
  const [localUsers, setLocalUsers, usersLoaded] = useCloudState(dbFolder, "pos_users", [
    { id: currentUser.id || Date.now().toString(), name: currentUser.name, username: currentUser.username, password: currentUser.password, role: 'admin' }
  ]);
  
  const [storeDetails, setStoreDetails, storeLoaded] = useCloudState(dbFolder, "pos_store", { 
    name: currentUser.shopName || 'My Store', 
    phone: currentUser.phone || '', 
    address: '', 
    gstNo: '' 
  });
  
  const [activeCartId, setActiveCartId] = useState(null);
  const [activeTab, setActiveTab] = useState('POS');
  const [printerSize, setPrinterSize] = useState('80mm');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (cartsLoaded && carts.length > 0 && !activeCartId) {
      setActiveCartId(carts[0].id);
    }
  }, [cartsLoaded, carts, activeCartId]);

  const isEverythingLoaded = productsLoaded && billsLoaded && purchasesLoaded && storeLoaded && cartsLoaded && usersLoaded && customersLoaded && staffLoaded;
  
  if (!isEverythingLoaded) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold tracking-widest uppercase text-slate-300">Loading {currentUser.shopName}... ☁️</h2>
      </div>
    );
  }

  const handleTeamUpdate = (newTeamList) => {
    setLocalUsers(newTeamList);
    const otherShopsStaff = globalUsers.filter(u => u.dbFolder !== dbFolder);
    const thisShopsStaff = newTeamList.map(staff => ({
      ...staff,
      dbFolder: dbFolder,
      shopName: storeDetails.name
    }));
    setGlobalUsers([...otherShopsStaff, ...thisShopsStaff]);
  };

  const allNavItems = [
    { id: 'POS', label: 'Register', icon: '🏪', roles: ['admin', 'operator'] },
    { id: 'INVENTORY', label: 'Inventory', icon: '📦', roles: ['admin', 'operator'] },
    { id: 'CUSTOMERS', label: 'Customers', icon: '👤', roles: ['admin', 'operator'] },
    { id: 'HISTORY', label: 'Sales History', icon: '📜', roles: ['admin', 'operator'] },
    { id: 'PURCHASES', label: 'Purchases', icon: '📥', roles: ['admin'] },
    { id: 'REPORTS', label: 'Reports', icon: '📊', roles: ['admin'] },
    { id: 'TEAM', label: 'POS Access', icon: '🔐', roles: ['admin'] }, 
    { id: 'STAFF', label: 'HR & Staff', icon: '👔', roles: ['admin'] }, 
    { id: 'SETTINGS', label: 'Store Settings', icon: '⚙️', roles: ['admin'] },
    { id: 'HARDWARE', label: 'Hardware', icon: '🖨️', roles: ['admin', 'operator'] },
  ];

  const visibleNavItems = allNavItems.filter(item => item.roles.includes(currentUser.role));

  const handleLogout = () => {
    if(window.confirm("Are you sure you want to log out?")) {
      onPlatformLogout(); 
    }
  };

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden font-sans">
      <aside className={`bg-slate-900 text-white flex flex-col shadow-2xl z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-20 flex items-center px-4 border-b border-slate-800 shrink-0 overflow-hidden">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'ml-3 opacity-100 w-48' : 'ml-0 opacity-0 w-0'}`}>
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm shrink-0">{storeDetails.name.charAt(0) || 'S'}</div>
            <h1 className="text-base font-bold tracking-wide ml-3 truncate">{storeDetails.name}</h1>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
          {visibleNavItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3.5 rounded-xl font-bold transition-all duration-200 outline-none ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'} ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
              <span className={`text-2xl shrink-0 ${isSidebarOpen ? 'mr-3' : ''}`}>{item.icon}</span>
              {isSidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800 shrink-0 overflow-hidden bg-slate-950">
          <div className={`flex items-center justify-between transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white truncate">{currentUser.name}</span>
              <span className="text-xs text-slate-400 uppercase tracking-wide">{currentUser.role}</span>
            </div>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-500 font-bold text-sm">Log Out</button>
          </div>
          {!isSidebarOpen && <button onClick={handleLogout} className="w-full flex justify-center text-red-400">🚪</button>}
        </div>
      </aside>
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'POS' && activeCartId && <Dashboard currentUser={currentUser} products={products} setProducts={setProducts} billHistory={billHistory} setBillHistory={setBillHistory} storeDetails={storeDetails} printerSize={printerSize} carts={carts} setCarts={setCarts} activeCartId={activeCartId} setActiveCartId={setActiveCartId} customers={localCustomers} setCustomers={setLocalCustomers} />}
        {activeTab === 'INVENTORY' && <Inventory products={products} setProducts={setProducts} storeDetails={storeDetails} />}
        {activeTab === 'PURCHASES' && <Purchases products={products} setProducts={setProducts} purchaseHistory={purchaseHistory} setPurchaseHistory={setPurchaseHistory} />}
        {activeTab === 'HISTORY' && <History currentUser={currentUser} billHistory={billHistory} setBillHistory={setBillHistory} products={products} setProducts={setProducts} setActiveTab={setActiveTab} carts={carts} setCarts={setCarts} setActiveCartId={setActiveCartId} />}
       {/* 🔥 We added currentUser={currentUser} to this line! */}
{activeTab === 'CUSTOMERS' && <Customers currentUser={currentUser} customers={localCustomers} setCustomers={setLocalCustomers} billHistory={billHistory} storeDetails={storeDetails} />}
        {activeTab === 'REPORTS' && <Reports billHistory={billHistory} />}
        {activeTab === 'TEAM' && <Team users={localUsers} setUsers={handleTeamUpdate} globalUsers={globalUsers} />}
        
        {/* 🔥 SAFELY PLACED: Renders the new Staff page! */}
        {activeTab === 'STAFF' && <Staff staffList={localStaff} setStaffList={setLocalStaff} />}
        
        {activeTab === 'SETTINGS' && <Settings storeDetails={storeDetails} setStoreDetails={setStoreDetails} />}
        {activeTab === 'HARDWARE' && <Hardware storeDetails={storeDetails} printerSize={printerSize} setPrinterSize={setPrinterSize} />}
      </main>
    </div>
  );
}

// ============================================================================
// 2. THE MASTER SWITCHBOARD (Global Login Gateway)
// ============================================================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [globalUsers, setGlobalUsers, usersLoaded] = useCloudState("platform_db", "all_users", defaultUsers);

  if (!usersLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-white font-sans">
        <h2 className="text-xl font-bold tracking-widest uppercase text-slate-300">Connecting... ☁️</h2>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Login 
        users={globalUsers} 
        onLogin={(user) => {
          setCurrentUser(user);
        }} 
        onRegister={(newUser) => {
          const userWithDB = { ...newUser, dbFolder: `shop_${newUser.username}` };
          setGlobalUsers([...globalUsers, userWithDB]); 
        }}
      />
    );
  }

  return (
    <MainPOS 
      currentUser={currentUser} 
      onPlatformLogout={() => setCurrentUser(null)} 
      globalUsers={globalUsers}
      setGlobalUsers={setGlobalUsers}
    />
  );
}