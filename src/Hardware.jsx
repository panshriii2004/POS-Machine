import React, { useState, useRef } from 'react';

export default function Hardware({ storeDetails, printerSize, setPrinterSize, isSidebarHidden, showSidebar }) {
  const [printerStatus, setPrinterStatus] = useState('Disconnected');
  const [deviceName, setDeviceName] = useState('');
  
  const [testScan, setTestScan] = useState('');
  const [lastScanSuccess, setLastScanSuccess] = useState(null);
  const scannerInputRef = useRef(null);

  const connectBluetoothPrinter = async () => {
    try {
      setPrinterStatus('Searching...');
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['generic_access'] });
      setDeviceName(device.name || 'Unnamed Thermal Printer');
      setPrinterStatus('Connected');
      device.addEventListener('gattserverdisconnected', () => { setPrinterStatus('Disconnected'); setDeviceName(''); });
    } catch (error) {
      console.error(error);
      setPrinterStatus('Disconnected');
      if (error.name === 'NotFoundError') alert("Bluetooth pairing cancelled or no devices found.");
      else if (error.name === 'SecurityError') alert("Please ensure your website is running on HTTPS or localhost to use Bluetooth.");
    }
  };

  const handleTestScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setLastScanSuccess(`Success! Read barcode: ${testScan}`);
      setTestScan(''); 
      try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(err) {}
    }
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

      <div className="max-w-5xl mx-auto w-full space-y-6 mt-12 md:mt-0">
        
        <h2 className="text-2xl font-bold text-slate-800 pl-12 mb-2">🖨️ Hardware & Devices</h2>
        <p className="text-slate-500 mb-6">Manage your Bluetooth thermal printers, formats, and barcode scanners.</p>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
            <div className="text-4xl">🧾</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Bluetooth Thermal Printer</h3>
              <p className="text-sm text-slate-500">Connect a printer and choose your receipt paper size.</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-6">
              
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${printerStatus === 'Connected' ? 'bg-emerald-500' : printerStatus === 'Searching...' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`}></span>
                      <span className={`font-bold text-lg ${printerStatus === 'Connected' ? 'text-emerald-700' : 'text-slate-700'}`}>{printerStatus}</span>
                    </div>
                    {deviceName && <p className="text-sm text-blue-600 font-semibold mt-1">Device: {deviceName}</p>}
                  </div>
                  <button onClick={connectBluetoothPrinter} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-sm">
                    {printerStatus === 'Connected' ? 'Reconnect' : 'Pair Printer'}
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 mb-3">Receipt Paper Format</h4>
                <div className="flex gap-4">
                  <label className={`flex-1 cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${printerSize === '80mm' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                    <input type="radio" name="printerSize" value="80mm" checked={printerSize === '80mm'} onChange={() => setPrinterSize('80mm')} className="hidden" />
                    <span className="text-2xl">📜</span>
                    <span className="font-bold text-slate-800">3 Inch (80mm)</span>
                    <span className="text-xs text-slate-500 text-center">Standard POS Size.<br/>Wide & highly readable.</span>
                  </label>
                  
                  <label className={`flex-1 cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${printerSize === '58mm' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                    <input type="radio" name="printerSize" value="58mm" checked={printerSize === '58mm'} onChange={() => setPrinterSize('58mm')} className="hidden" />
                    <span className="text-2xl">🧾</span>
                    <span className="font-bold text-slate-800">2 Inch (58mm)</span>
                    <span className="text-xs text-slate-500 text-center">Compact POS Size.<br/>Saves paper, smaller text.</span>
                  </label>
                </div>
              </div>

            </div>

            <div className="flex-1 flex flex-col items-center bg-slate-100 p-6 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-500 mb-4 uppercase text-xs tracking-wider">Live Preview</h4>
              
              <div className={`bg-white shadow-lg border border-slate-300 p-4 text-black font-mono transition-all duration-300 ${printerSize === '58mm' ? 'w-[220px] text-[11px]' : 'w-[300px] text-sm'}`}>
                <h2 className="text-center font-bold mb-1 uppercase text-base leading-tight">{storeDetails?.name || 'STOREFRONT POS'}</h2>
                <div className="text-center text-slate-600 mb-2 leading-tight" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>
                  {storeDetails?.address && <div>{storeDetails.address}</div>}
                  {storeDetails?.phone && <div>Ph: {storeDetails.phone}</div>}
                  {storeDetails?.gstNo && <div>GSTIN: <span className="uppercase">{storeDetails.gstNo}</span></div>}
                </div>
                
                <p className="text-center text-slate-500 mb-2 border-b-2 border-dashed border-slate-300 pb-2" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>
                  Receipt: #PREVIEW
                </p>

                <div className="flex justify-between font-bold mb-1"><span>ITEM</span><span>TOTAL</span></div>
                
                <div className="space-y-2 mb-3">
                  <div>
                    <div className="flex justify-between"><span className="truncate pr-2">Mech Keyboard</span><span>₹85.00</span></div>
                    <div className="text-slate-500" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>1 x ₹85.00</div>
                  </div>
                  <div>
                    <div className="flex justify-between"><span className="truncate pr-2">USB-C Cable</span><span>₹30.00</span></div>
                    <div className="text-slate-500" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>2 x ₹15.00</div>
                  </div>
                </div>

                <div className="border-t-2 border-dashed border-slate-300 pt-3">
                  <div className="flex justify-between text-slate-600 mb-1"><span>Subtotal:</span><span>₹115.00</span></div>
                  <div className="flex justify-between text-slate-600 mb-1"><span>GST (10%):</span><span>+₹11.50</span></div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-slate-800" style={{ fontSize: printerSize === '58mm' ? '14px' : '18px' }}>
                    <span>TOTAL:</span><span>₹126.50</span>
                  </div>
                </div>
                <p className="text-center text-slate-500 mt-4" style={{ fontSize: printerSize === '58mm' ? '9px' : '12px' }}>Thank you for shopping!</p>
              </div>

            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-4">
            <div className="text-4xl">🔫</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Bluetooth Barcode Scanner</h3>
              <p className="text-sm text-slate-500">Verify your wireless scanner is working correctly.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-bold text-slate-700">How to setup:</h4>
              <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                <li>Put your scanner into "Bluetooth Pairing Mode".</li>
                <li>Go to your computer/tablet's normal <strong>OS Settings (Bluetooth)</strong>.</li>
                <li>Pair the scanner just like a wireless keyboard.</li>
                <li>Click the test box on the right and scan an item!</li>
              </ol>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
              <label className="font-bold text-blue-800 mb-2">Scanner Test Area</label>
              <input ref={scannerInputRef} type="text" value={testScan} onChange={(e) => setTestScan(e.target.value)} onKeyDown={handleTestScan} placeholder="Click here & pull trigger..." className="w-full max-w-xs p-3 text-center border-2 border-blue-300 rounded-lg outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all font-mono" />
              <div className="mt-4 h-6">
                {lastScanSuccess ? <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-full text-sm animate-pulse">✅ {lastScanSuccess}</span> : <span className="text-slate-400 text-sm italic">Waiting for scan...</span>}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}