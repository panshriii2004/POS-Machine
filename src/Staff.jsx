import React, { useState, useRef } from 'react';

export default function Staff({ staffList, setStaffList, isSidebarHidden, showSidebar }) {
  const [search, setSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const [showIndividualAttendance, setShowIndividualAttendance] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); 

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState(null); 

  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerNote, setLedgerNote] = useState('');
  const [attendanceNote, setAttendanceNote] = useState('');

  const fileInputRef = useRef(null);
  
  // 🔥 NEW: Ref for the right panel to handle scrolling
  const rightPanelRef = useRef(null);
  
  const todayDate = new Date().toISOString().split('T')[0]; 

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);
  const filteredStaff = staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.jobTitle.toLowerCase().includes(search.toLowerCase()));

  // 🔥 NEW: Scroll function that triggers on mobile
  const scrollToRightPanel = () => {
    // Only scroll if we are on a smaller screen (where columns are stacked)
    if (window.innerWidth < 768 && rightPanelRef.current) {
      setTimeout(() => {
        rightPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const getAttendanceRecord = (staffMember, dateString) => {
    if (!staffMember.attendance || !staffMember.attendance[dateString]) return { status: 'Not Marked', note: '' };
    const record = staffMember.attendance[dateString];
    if (typeof record === 'string') return { status: record, note: '' }; 
    return record; 
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1048576) return alert("Image is too large! Please choose a file smaller than 1MB.");
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddStaff = (e) => {
    e.preventDefault();
    const newStaff = {
      id: Date.now().toString(),
      name,
      jobTitle,
      phone,
      photo,
      attendance: {}, 
      ledgerBalance: 0, 
      ledgerHistory: []
    };
    setStaffList([...staffList, newStaff]);
    setName(''); setJobTitle(''); setPhone(''); setPhoto(null);
    setShowAddForm(false);
  };

  const handleDeleteStaff = (idToDelete) => {
    if (window.confirm("Are you sure you want to remove this employee's HR profile?")) {
      setStaffList(staffList.filter(s => s.id !== idToDelete));
      if (selectedStaffId === idToDelete) setSelectedStaffId(null);
    }
  };

  const handleMarkAttendance = (status) => {
    if ((status === 'Absent' || status === 'Half Day') && !attendanceNote.trim()) {
      if (!window.confirm(`You haven't added a reason/note for marking them ${status}. Continue anyway?`)) return;
    }

    const updatedStaff = staffList.map(s => {
      if (s.id === selectedStaff.id) {
        return { 
          ...s, 
          attendance: { 
            ...(s.attendance || {}), 
            [todayDate]: { status: status, note: attendanceNote.trim() } 
          } 
        };
      }
      return s;
    });
    setStaffList(updatedStaff);
    setAttendanceNote('');
  };

  const handleAddLedgerEntry = (type) => {
    const amount = parseFloat(ledgerAmount);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");

    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      amount: amount,
      type: type, 
      note: ledgerNote || (type === 'advance' ? 'Given Advance' : 'Salary Payout')
    };

    const updatedStaff = staffList.map(s => {
      if (s.id === selectedStaff.id) {
        const currentBalance = s.ledgerBalance || 0;
        const newBalance = type === 'advance' ? currentBalance + amount : currentBalance - amount;
        return { ...s, ledgerBalance: newBalance, ledgerHistory: [entry, ...(s.ledgerHistory || [])] };
      }
      return s;
    });

    setStaffList(updatedStaff);
    setLedgerAmount('');
    setLedgerNote('');
  };

  const getDaysInMonth = (yearMonthStr) => {
    const [year, month] = yearMonthStr.split('-');
    return new Date(year, month, 0).getDate();
  };

  const generateMonthDates = (yearMonthStr) => {
    const days = getDaysInMonth(yearMonthStr);
    const dates = [];
    for (let i = 1; i <= days; i++) {
      const dayStr = i.toString().padStart(2, '0');
      dates.push(`${yearMonthStr}-${dayStr}`);
    }
    return dates;
  };

  const currentMonthDates = generateMonthDates(reportMonth);

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 font-sans p-6 gap-6 overflow-y-auto relative">
      
      {isSidebarHidden && (
        <button 
          onClick={showSidebar}
          className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
          title="Show Menu"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {showAllAttendance && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden relative animate-fade-in-down">
            
            {/* 🔥 FIXED: Responsive Header for Calendar */}
            <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 shrink-0 relative gap-4">
              <div className="pr-10">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">Master Attendance</h2>
                <p className="text-slate-500 text-xs md:text-sm mt-1">View all staff attendance for the selected month</p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="p-2 w-full sm:w-auto border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700" />
              </div>
              {/* Close button is now strictly fixed to the top right to avoid being pushed off screen */}
              <button onClick={() => setShowAllAttendance(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-full text-slate-600 font-bold transition-colors shadow-sm">✕</button>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6 bg-white">
              <table className="w-full border-collapse text-sm text-center">
                <thead className="sticky top-0 bg-white shadow-sm ring-1 ring-slate-200 z-10">
                  <tr>
                    <th className="p-3 text-left font-bold text-slate-700 uppercase tracking-wider bg-slate-100 min-w-[120px] sticky left-0 z-20 shadow-[1px_0_0_#e2e8f0]">Staff Name</th>
                    {currentMonthDates.map(date => (
                      <th key={date} className="p-2 font-semibold text-slate-500 border border-slate-200 min-w-[40px]">
                        {date.split('-')[2]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffList.length === 0 ? (
                    <tr><td colSpan={currentMonthDates.length + 1} className="p-8 text-slate-400">No staff members found.</td></tr>
                  ) : (
                    staffList.map(staff => (
                      <tr key={staff.id} className="hover:bg-slate-50">
                        <td className="p-3 text-left font-bold text-slate-800 bg-white sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0]">
                          <div className="truncate w-24 md:w-32" title={staff.name}>{staff.name}</div>
                        </td>
                        {currentMonthDates.map(date => {
                          const record = getAttendanceRecord(staff, date);
                          let bgClass = "bg-white";
                          let symbol = "-";
                          
                          if (record.status === 'Present') { bgClass = "bg-emerald-100 text-emerald-700 font-bold"; symbol = "P"; }
                          else if (record.status === 'Absent') { bgClass = "bg-red-100 text-red-700 font-bold"; symbol = "A"; }
                          else if (record.status === 'Half Day') { bgClass = "bg-yellow-100 text-yellow-700 font-bold"; symbol = "H"; }

                          return (
                            <td key={date} className={`p-2 border border-slate-200 ${bgClass}`} title={`${date}: ${record.status}${record.note ? ` - ${record.note}` : ''}`}>
                              {symbol}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex justify-center gap-4 md:gap-6 text-xs md:text-sm font-medium text-slate-600">
              <span className="flex items-center gap-2"><span className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded flex items-center justify-center text-[10px] text-emerald-700">P</span> = Present</span>
              <span className="flex items-center gap-2"><span className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded flex items-center justify-center text-[10px] text-yellow-700">H</span> = Half Day</span>
              <span className="flex items-center gap-2"><span className="w-4 h-4 bg-red-100 border border-red-300 rounded flex items-center justify-center text-[10px] text-red-700">A</span> = Absent</span>
            </div>
          </div>
        </div>
      )}

      {showIndividualAttendance && selectedStaff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg relative max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-down">
            <button onClick={() => setShowIndividualAttendance(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-red-500 hover:text-white rounded-full text-slate-600 font-bold transition-colors">✕</button>
            
            <div className="shrink-0 mb-4 border-b border-slate-100 pb-4 pr-6">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">{selectedStaff.name}'s Attendance</h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 gap-3">
                <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm" />
                
                <div className="flex gap-2 text-xs font-bold">
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">P: {currentMonthDates.filter(d => getAttendanceRecord(selectedStaff, d).status === 'Present').length}</span>
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">H: {currentMonthDates.filter(d => getAttendanceRecord(selectedStaff, d).status === 'Half Day').length}</span>
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded">A: {currentMonthDates.filter(d => getAttendanceRecord(selectedStaff, d).status === 'Absent').length}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {currentMonthDates.slice().reverse().map(date => { 
                const record = getAttendanceRecord(selectedStaff, date);
                if (record.status === 'Not Marked') return null; 

                let bgClass = "bg-slate-50 border-slate-200";
                if (record.status === 'Present') bgClass = "bg-emerald-50 border-emerald-200 text-emerald-800";
                else if (record.status === 'Absent') bgClass = "bg-red-50 border-red-200 text-red-800";
                else if (record.status === 'Half Day') bgClass = "bg-yellow-50 border-yellow-200 text-yellow-800";

                return (
                  <div key={date} className={`p-3 border rounded-xl flex flex-col gap-1 ${bgClass}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">{date}</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{record.status}</span>
                    </div>
                    {record.note && (
                      <div className="text-xs mt-1 pt-1 border-t border-black/10 opacity-80">
                        <span className="font-bold">Note: </span>{record.note}
                      </div>
                    )}
                  </div>
                );
              })}
              {currentMonthDates.filter(d => getAttendanceRecord(selectedStaff, d).status !== 'Not Marked').length === 0 && (
                <div className="text-center p-8 text-slate-400">No attendance marked for this month.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN */}
      <div className="w-full md:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden shrink-0 mt-12 md:mt-0">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className={`text-xl md:text-2xl font-bold text-slate-800 ${isSidebarHidden ? 'md:ml-12' : ''}`}>HR Portal</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAllAttendance(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 text-sm rounded-lg transition-colors" title="Master Attendance Sheet">
              📅
            </button>
            <button 
              onClick={() => { 
                setShowAddForm(true); 
                setSelectedStaffId(null); 
                scrollToRightPanel(); // 🔥 Trigger Scroll
              }} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 text-sm rounded-lg transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
        
        <div className="relative mb-4 shrink-0">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input type="text" placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filteredStaff.map(staff => {
            const todayRecord = getAttendanceRecord(staff, todayDate);
            return (
              <div 
                key={staff.id} 
                onClick={() => { 
                  setSelectedStaffId(staff.id); 
                  setShowAddForm(false); 
                  scrollToRightPanel(); // 🔥 Trigger Scroll
                }}
                // Works for double click or single click to be safe
                onDoubleClick={() => { 
                  setSelectedStaffId(staff.id); 
                  setShowAddForm(false); 
                  scrollToRightPanel(); 
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${selectedStaffId === staff.id ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-sm'}`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center">
                  {staff.photo ? <img src={staff.photo} alt="profile" className="w-full h-full object-cover" /> : <span className="text-slate-500 font-bold text-lg">{staff.name.charAt(0)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 truncate">{staff.name}</h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${todayRecord.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : todayRecord.status === 'Absent' ? 'bg-red-100 text-red-700' : todayRecord.status === 'Half Day' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                      {todayRecord.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 capitalize">{staff.jobTitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div ref={rightPanelRef} className="w-full md:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden shrink-0 md:mt-0 relative">
        
        {showAddForm && (
          <div className="p-6 overflow-y-auto h-full animate-fade-in-down">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
              <h2 className="text-2xl font-bold text-slate-800">Add New Employee</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-red-500 font-bold">✕ Cancel</button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-5 max-w-lg">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center relative cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => fileInputRef.current.click()}>
                  {photo ? <img src={photo} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-2xl">📷</span>}
                </div>
                <div>
                  <button type="button" onClick={() => fileInputRef.current.click()} className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-3 rounded-lg transition-colors">Upload Photo</button>
                  <p className="text-xs text-slate-400 mt-1">Max size: 1MB</p>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Job Title / Role</label>
                  <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Cleaner, Driver" required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                </div>
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md">
                Create HR Profile
              </button>
            </form>
          </div>
        )}

        {!showAddForm && !selectedStaff && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
            <span className="text-6xl mb-4">👔</span>
            <p className="text-lg font-medium">Select an employee from the list</p>
          </div>
        )}

        {!showAddForm && selectedStaff && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0 relative">
              <button onClick={() => handleDeleteStaff(selectedStaff.id)} className="absolute top-4 right-4 text-xs font-bold text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 py-1 px-2 rounded transition-colors">
                Remove Profile
              </button>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 mt-6 sm:mt-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-white border-4 border-white shadow-md shrink-0 flex items-center justify-center">
                  {selectedStaff.photo ? <img src={selectedStaff.photo} alt="profile" className="w-full h-full object-cover" /> : <span className="text-slate-400 font-bold text-3xl">{selectedStaff.name.charAt(0)}</span>}
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-800">{selectedStaff.name}</h2>
                  <p className="bg-slate-200 inline-block text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide mt-1">
                    {selectedStaff.jobTitle}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {selectedStaff.phone && (
                      <a href={`tel:${selectedStaff.phone}`} className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-sm transition-colors">
                        📞 Call {selectedStaff.phone}
                      </a>
                    )}
                    
                    <button onClick={() => setShowIndividualAttendance(true)} className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-1.5 px-3 rounded-full shadow-sm transition-colors">
                      📅 Monthly Attendance
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 min-h-[400px]">
              
              <section className="bg-white border border-slate-200 p-4 md:p-5 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Today's Attendance ({todayDate})</h3>
                
                <input 
                  type="text" 
                  placeholder="Add a note (e.g. 'Arrived 2 hours late' or 'Sick leave')..." 
                  value={attendanceNote} 
                  onChange={(e) => setAttendanceNote(e.target.value)} 
                  className="w-full mb-3 p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button onClick={() => handleMarkAttendance('Present')} className={`flex-1 py-3 rounded-xl font-bold transition-all border ${getAttendanceRecord(selectedStaff, todayDate).status === 'Present' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'}`}>✅ Present</button>
                  <button onClick={() => handleMarkAttendance('Half Day')} className={`flex-1 py-3 rounded-xl font-bold transition-all border ${getAttendanceRecord(selectedStaff, todayDate).status === 'Half Day' ? 'bg-yellow-500 text-white border-yellow-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-yellow-50'}`}>⏱️ Half Day</button>
                  <button onClick={() => handleMarkAttendance('Absent')} className={`flex-1 py-3 rounded-xl font-bold transition-all border ${getAttendanceRecord(selectedStaff, todayDate).status === 'Absent' ? 'bg-red-500 text-white border-red-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-red-50'}`}>❌ Absent</button>
                </div>
                {getAttendanceRecord(selectedStaff, todayDate).note && (
                  <p className="mt-3 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                    <strong className="text-slate-700">Today's Note:</strong> {getAttendanceRecord(selectedStaff, todayDate).note}
                  </p>
                )}
              </section>

              <section className="bg-slate-100 p-4 md:p-5 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Salary & Advance Ledger</h3>
                  <div className={`text-right px-4 py-2 rounded-xl bg-white border shadow-sm w-full sm:w-auto ${selectedStaff.ledgerBalance > 0 ? 'border-orange-300' : selectedStaff.ledgerBalance < 0 ? 'border-emerald-300' : 'border-slate-200'}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Net Balance</p>
                    <p className={`text-lg md:text-xl font-bold ${selectedStaff.ledgerBalance > 0 ? 'text-orange-600' : selectedStaff.ledgerBalance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {selectedStaff.ledgerBalance > 0 ? `Owes Us ₹${selectedStaff.ledgerBalance}` : selectedStaff.ledgerBalance < 0 ? `Pending Pay ₹${Math.abs(selectedStaff.ledgerBalance)}` : '₹0.00'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <input type="number" placeholder="Amount ₹" value={ledgerAmount} onChange={e => setLedgerAmount(e.target.value)} className="w-full lg:w-28 p-2 text-sm border border-slate-300 rounded outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="text" placeholder="Note (e.g. Diwali Bonus)" value={ledgerNote} onChange={e => setLedgerNote(e.target.value)} className="flex-1 p-2 text-sm border border-slate-300 rounded outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex gap-2 w-full lg:w-auto">
                    <button onClick={() => handleAddLedgerEntry('advance')} className="flex-1 lg:w-auto bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-3 py-2 text-xs rounded transition-colors border border-orange-200">
                      Give Advance
                    </button>
                    <button onClick={() => handleAddLedgerEntry('salary')} className="flex-1 lg:w-auto bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold px-3 py-2 text-xs rounded transition-colors border border-emerald-200">
                      Pay Salary
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {(!selectedStaff.ledgerHistory || selectedStaff.ledgerHistory.length === 0) ? (
                    <p className="p-4 text-center text-sm text-slate-400">No ledger history recorded.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                          <tr>
                            <th className="p-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                            <th className="p-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Note</th>
                            <th className="p-3 font-semibold text-slate-500 text-xs uppercase tracking-wider text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedStaff.ledgerHistory.map(entry => (
                            <tr key={entry.id} className="hover:bg-slate-50">
                              <td className="p-3 text-slate-500 whitespace-nowrap">{entry.date.split(',')[0]}</td>
                              <td className="p-3 text-slate-800">{entry.note}</td>
                              <td className={`p-3 font-bold text-right ${entry.type === 'advance' ? 'text-orange-600' : 'text-emerald-600'}`}>
                                {entry.type === 'advance' ? '+' : '-'}₹{entry.amount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}