import React, { useState } from 'react';

export default function Login({ users, onLogin, onRegister, deviceId, onForceLogoutAll }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- Login State ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- Device Conflict State ---
  const [isLoggedElsewhere, setIsLoggedElsewhere] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

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
    setIsLoading(true);

    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (user) {
      // Block login if the user is active on a DIFFERENT device
      if (user.activeDeviceId && user.activeDeviceId !== deviceId) {
        setIsLoggedElsewhere(true);
        setPendingUser(user);
        setIsLoading(false);
        return;
      }
      onLogin(user);
    } else {
      setError('Invalid username or password.');
    }
    
    setIsLoading(false);
  };

  const handleLogoutAllDevices = () => {
    if (pendingUser) {
      onForceLogoutAll(pendingUser);
      setIsLoggedElsewhere(false);
      setPendingUser(null);
      setError('All other devices logged out. You can now log in.');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    setError('');

    if (users.find(u => u.username.toLowerCase() === regUsername.toLowerCase())) {
      setError('That username is already taken globally. Please choose another.');
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      name: 'Admin',
      username: regUsername.toLowerCase(),
      password: regPassword,
      role: 'admin',
      shopName: shopName,
      category: category,
      email: email,
      phone: phone,
      activeDeviceId: deviceId // Tie new user to this device immediately
    };

    if (onRegister) {
      onRegister(newUser, shopName);
    }

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
        
        {isLoggedElsewhere ? (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Active session detected</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Your account is currently active on another device. You must log out of all other sessions to continue here.
            </p>
            <button 
              onClick={handleLogoutAllDevices}
              className="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-sm mb-3"
            >
              Logout from all devices
            </button>
            <button 
              onClick={() => { setIsLoggedElsewhere(false); setError(''); }}
              className="text-sm text-blue-600 font-bold hover:underline mt-2"
            >
              Cancel
            </button>
          </div>
        ) : !isRegistering ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                autoComplete="username" 
                className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}  
                autoComplete="current-password" 
                className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all" 
                required 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-md mt-4"
            >
              {isLoading ? 'Verifying...' : 'Sign In'}
            </button>
            
            <div className="text-center pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600">Don't have a store yet?</p>
              <button type="button" onClick={() => { setIsRegistering(true); setError(''); }} className="text-blue-600 hover:text-blue-800 font-bold mt-1">
                Register Here ➔
              </button>
            </div>
          </form>
        ) : (
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