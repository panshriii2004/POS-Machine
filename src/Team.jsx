import React, { useState } from 'react';

export default function Team({ users, setUsers, globalUsers, isSidebarHidden, showSidebar }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator'); 

  const handleAddUser = (e) => {
    e.preventDefault();
    setError('');

    const isTaken = globalUsers.some((u) => u.username.toLowerCase() === username.toLowerCase());

    if (isTaken) {
      setError(`The username "@${username}" is already taken by another store.`);
      return;
    }

    const newUser = {
      id: Date.now().toString(),
      name: name,
      username: username.toLowerCase(),
      password: password,
      role: role
    };

    setUsers([...users, newUser]);
    setName(''); setUsername(''); setPassword(''); setRole('operator');
    setShowAddForm(false);
  };

  const handleDeleteUser = (idToDelete) => {
    if (window.confirm("Are you sure you want to revoke POS access for this user?")) {
      setUsers(users.filter(u => u.id !== idToDelete));
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto h-full relative">
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 mt-12 sm:mt-0">
        <div>
          <h1 className={`text-3xl font-bold text-slate-800 ${isSidebarHidden ? 'sm:ml-12' : ''}`}>POS Access Management</h1>
          <p className={`text-slate-500 mt-1 ${isSidebarHidden ? 'sm:ml-12' : ''}`}>Control which employees can log into the Cash Register</p>
        </div>
        <button 
          onClick={() => { setShowAddForm(!showAddForm); setError(''); }} 
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md mt-4 sm:mt-0"
        >
          {showAddForm ? '✕ Cancel' : '+ Add POS User'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 mb-8 animate-fade-in-down">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Create Login Credentials</h2>
          {error && <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg font-medium text-sm">🚨 {error}</div>}

          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Global Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Password</label>
              <input type="text" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Software Permissions</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 cursor-pointer">
                <option value="operator">Cashier (Can only use Register)</option>
                <option value="admin">Store Admin (Full Settings Access)</option>
              </select>
            </div>
            <div className="md:col-span-2 pt-2">
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md">
                Grant POS Access
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <div key={user.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                {user.role}
              </span>
            </div>
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 mb-4">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-lg font-bold text-slate-800">{user.name}</h3>
            <div className="mt-4 space-y-1 text-sm">
              <p className="flex justify-between text-slate-500"><span className="font-medium text-slate-400">Username:</span> <b>@{user.username}</b></p>
              <p className="flex justify-between text-slate-500"><span className="font-medium text-slate-400">Password:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{user.password}</span></p>
            </div>
            {users.length > 1 && (
              <button onClick={() => handleDeleteUser(user.id)} className="w-full mt-6 py-2 border-2 border-red-100 text-red-500 font-bold rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                Revoke Login Access
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}