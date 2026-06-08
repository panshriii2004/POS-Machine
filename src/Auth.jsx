import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

export default function Auth({ onLoginSuccess }) {
  // Navigation State
  const [view, setView] = useState('loading'); // 'loading', 'auth', 'admin_setup', 'dashboard'
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  // Data State
  const [currentUser, setCurrentUser] = useState(null);
  const [myStores, setMyStores] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Listen for user login/logout
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await checkOwnerStores(user.uid);
      } else {
        setCurrentUser(null);
        setView('auth');
      }
    });
    return () => unsubscribe();
  }, []);

  // Check if the logged-in owner already has a store setup
  const checkOwnerStores = async (uid) => {
    try {
      const q = query(collection(db, "stores"), where("ownerUid", "==", uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // No store found? Force them to setup an admin account!
        setView('admin_setup');
      } else {
        // Store found! Load them up and show dashboard
        const storesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMyStores(storesList);
        setView('dashboard');
      }
    } catch (err) {
      console.error("Error fetching stores:", err);
      setError("Failed to load your stores.");
    }
  };

  // Handle Platform Owner Login / Signup
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        // Firebase auth listener will automatically catch this and run checkOwnerStores
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle creating the first store & admin account
  const handleStoreSetup = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Create a new store document linked to this owner
      await addDoc(collection(db, "stores"), {
        ownerUid: currentUser.uid,
        ownerEmail: currentUser.email,
        storeName: storeName,
        adminUsername: adminUsername,
        adminPassword: adminPassword, // Note: In a production app, never store passwords in plain text!
        createdAt: new Date().toISOString(),
        inventory: [], // Ready for future features
        billing: []    // Ready for future features
      });

      // Re-check stores to move them to the dashboard
      await checkOwnerStores(currentUser.uid);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // UI RENDERING BOILERPLATE BELOW
  if (view === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading POS System...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      
      {/* ----------------- VIEW 1: AUTHENTICATION ----------------- */}
      {view === 'auth' && (
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">cLiCk To cASh</h2>
          <p className="text-slate-400 text-center mb-8">Platform Owner Portal</p>
          
          <div className="flex gap-4 mb-6 border-b border-slate-600 pb-4">
            <button onClick={() => {setAuthMode('login'); setError('');}} className={`flex-1 font-bold ${authMode === 'login' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>Login</button>
            <button onClick={() => {setAuthMode('signup'); setError('');}} className={`flex-1 font-bold ${authMode === 'signup' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>Sign Up</button>
          </div>

          {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg text-sm mb-4">{error}</div>}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="email" placeholder="Owner Email Address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
              {isLoading ? 'Processing...' : authMode === 'login' ? 'Access Platform' : 'Create Platform Account'}
            </button>
          </form>
        </div>
      )}

      {/* ----------------- VIEW 2: ADMIN SETUP ----------------- */}
      {view === 'admin_setup' && (
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-2">Initialize Your POS</h2>
          <p className="text-slate-400 mb-6 text-sm">Welcome! Let's set up your first store database and create your local admin login.</p>

          {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg text-sm mb-4">{error}</div>}

          <form onSubmit={handleStoreSetup} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Store Name</label>
              <input type="text" placeholder="e.g. Chitranjan Cloth Store" required value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Store Admin Username</label>
              <input type="text" placeholder="e.g. admin_rahaud" required value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Store Admin Password</label>
              <input type="password" placeholder="Create a secure pin or password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <button disabled={isLoading} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
              {isLoading ? 'Creating Database...' : 'Initialize Store Database'}
            </button>
            <button type="button" onClick={() => signOut(auth)} className="w-full text-slate-400 hover:text-white text-sm py-2">Cancel & Logout</button>
          </form>
        </div>
      )}

      {/* ----------------- VIEW 3: PLATFORM DASHBOARD ----------------- */}
      {view === 'dashboard' && (
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/20">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">My Branches</h2>
              <p className="text-slate-400 text-sm">Logged in as {currentUser?.email}</p>
            </div>
            <button onClick={() => signOut(auth)} className="text-red-400 hover:text-red-300 font-bold px-4 py-2 border border-red-500/30 rounded-lg">Logout</button>
          </div>

          <div className="grid gap-4 mb-6">
            {myStores.map(store => (
              <div key={store.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-blue-500 transition-colors">
                <div>
                  <h3 className="text-xl font-bold text-white">{store.storeName}</h3>
                  <p className="text-sm text-slate-400 mt-1">Admin User: <span className="text-slate-200 font-mono">{store.adminUsername}</span></p>
                </div>
                {/* Clicking this would ideally pass the specific store data up to App.jsx to load the actual POS! */}
                <button onClick={() => onLoginSuccess(store)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                  Open POS ➔
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setView('admin_setup')} className="w-full border-2 border-dashed border-slate-600 hover:border-slate-400 text-slate-400 hover:text-white font-bold py-4 rounded-xl transition-colors">
            + Add Another Branch
          </button>
        </div>
      )}

    </div>
  );
}