import React, { useState } from 'react';

export default function Login({ users, onLogin, onRegister }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  // --- Login State ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- Registration State ---
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');

    // 1. Check if the username is already taken in the database
    if (users.find(u => u.username === regUsername)) {
      setError('That username is already taken. Please choose another.');
      return;
    }

    // 2. Create the new Admin User object
    const newUser = {
      id: Date.now().toString(),
      name: 'Admin', // Default name for the shop creator
      username: regUsername,
      password: regPassword,
      role: 'admin',
      
      // Extra details you requested
      shopName: shopName,
      category: category,
      email: email,
      phone: phone
    };

    // 3. Send the new user to App.jsx to save in the cloud (if the prop exists)
    if (onRegister) {
      onRegister(newUser, shopName);
    }

    // 4. Instantly log them in to their new POS!
    onLogin(newUser);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 font-sans p-4 overflow-y-auto">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md my-8">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {isRegistering ? '🚀' : 'S'}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
          {isRegistering ? 'Create Your Store' : 'StoreFront POS'}
        </h2>
        <p className="text-center text-slate-500 font-medium mb-6 text-sm">
          {isRegistering ? 'Set up your new point of sale system' : 'Sign in to access your register'}
        </p>
        
        {error && <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold text-center border border-red-200">{error}</div>}
        
        {/* ================= LOGIN FORM ================= */}
        {!isRegistering ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all" required />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-4">
              Sign In
            </button>
            <div className="text-center pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600">Don't have a store yet?</p>
              <button type="button" onClick={() => { setIsRegistering(true); setError(''); }} className="text-blue-600 hover:text-blue-800 font-bold mt-1">
                Register Here ➔
              </button>
            </div>
          </form>
        ) : (
        /* ================= REGISTRATION FORM ================= */
          <form onSubmit={handleRegister} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Shop Name</label>
                <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-sm" placeholder="My Shop" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-sm" required>
                  <option value="" disabled>Select...</option>
                  <option value="retail">Retail Clothing</option>
                  <option value="electronics">Electronics</option>
                  <option value="grocery">Grocery / Mart</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Email (Gmail)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-sm" placeholder="shop@gmail.com" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-sm" placeholder="+91 00000 00000" required />
            </div>

            <div className="border-t border-slate-200 pt-4 mt-2">
              <label className="block text-xs font-bold text-emerald-600 mb-1 uppercase tracking-wide">Create Admin Username</label>
              <input type="text" value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white text-sm mb-3" placeholder="admin_user" required />
              
              <label className="block text-xs font-bold text-emerald-600 mb-1 uppercase tracking-wide">Create Password</label>
              <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white text-sm" placeholder="••••••••" required />
            </div>

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-6">
              Create Store & Login
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setIsRegistering(false); setError(''); }} className="text-slate-500 hover:text-slate-800 text-sm font-bold mt-2">
                ← Back to Login
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}