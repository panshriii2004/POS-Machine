import React, { useState, useRef } from 'react';

export default function Hardware({ 
  storeDetails, printerSize, setPrinterSize, isSidebarHidden, showSidebar,
  printCharacteristic, setPrintCharacteristic, bluetoothPrinterName, setBluetoothPrinterName,
  receiptConfig, setReceiptConfig 
}) {
  const [view, setView] = useState('main'); 
  const [activeAccordion, setActiveAccordion] = useState('header'); 
  
  const [printerStatus, setPrinterStatus] = useState(printCharacteristic ? 'Connected' : 'Disconnected');
  const [testScan, setTestScan] = useState('');
  const [lastScanSuccess, setLastScanSuccess] = useState(null);
  const scannerInputRef = useRef(null);

  const connectBluetoothPrinter = async () => {
    try {
      setPrinterStatus('Searching...');
      const commonServices = [
        '000018f0-0000-1000-8000-00805f9b34fb', 
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', 
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', 
        '0000fee7-0000-1000-8000-00805f9b34fb'  
      ];

      const device = await navigator.bluetooth.requestDevice({ 
        acceptAllDevices: true, 
        optionalServices: commonServices 
      });

      setBluetoothPrinterName(device.name || 'Unnamed Thermal Printer');
      setPrinterStatus('Connecting to device...');

      const server = await device.gatt.connect();

      let validService = null;
      let writeCharacteristic = null;

      for (const uuid of commonServices) {
        try {
          validService = await server.getPrimaryService(uuid);
          if (validService) {
            const characteristics = await validService.getCharacteristics();
            writeCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
            if (writeCharacteristic) break; 
          }
        } catch (e) {}
      }

      if (!writeCharacteristic) throw new Error("Could not find a compatible printing service on this device.");

      setPrintCharacteristic(writeCharacteristic);
      setPrinterStatus('Connected');

      device.addEventListener('gattserverdisconnected', () => { 
        setPrinterStatus('Disconnected'); 
        setBluetoothPrinterName(''); 
        setPrintCharacteristic(null);
      });

    } catch (error) {
      console.error("Bluetooth Error:", error);
      setPrinterStatus('Disconnected');
      if (error.name === 'NotFoundError') alert("Bluetooth pairing cancelled or no devices found.");
      else if (error.name === 'SecurityError') alert("Security Error: Check HTTPS.");
      else alert(`Connection Failed: ${error.message}`);
    }
  };

  const printTestReceipt = async () => {
    if (!printCharacteristic) {
      alert("No printer connected! Please pair a printer first.");
      return;
    }

    try {
      setPrinterStatus('Printing...');

      let charWidth = printerSize === '80mm' ? 48 : 32;
      if (receiptConfig?.printerFont === 'B' || receiptConfig?.printerFont === 'C') {
        charWidth = printerSize === '80mm' ? 64 : 42;
      }
      const dashedDivider = "-".repeat(charWidth) + "\n";

      // Native ESC/POS Command Byte Constants
      const ESC = 27;
      const GS = 29;
      const CMD_INIT = [ESC, 64];
      const CMD_ALIGN_LEFT = [ESC, 97, 0];
      const CMD_ALIGN_CENTER = [ESC, 97, 1];
      const CMD_BOLD_ON = [ESC, 69, 1]; 
      const CMD_BOLD_OFF = [ESC, 69, 0]; 
      const CMD_SIZE_NORMAL = [GS, 33, 0]; 
      
      // Removed Double Height to prevent pixelation, rely entirely on Bold.
      const CMD_SIZE_LARGE = [GS, 33, 0]; 
      
      const CMD_PAPER_CUT = [GS, 86, 66, 0];

      const fontCode = receiptConfig?.printerFont === 'C' ? 2 : receiptConfig?.printerFont === 'B' ? 1 : 0;
      const CMD_SET_FONT = [ESC, 77, fontCode];

      let payloadChunks = [];
      const encoder = new TextEncoder();

      const pushCmd = (arr) => payloadChunks.push(new Uint8Array(arr));
      const pushText = (str) => payloadChunks.push(encoder.encode(str));

      const formatLineLR = (left, right) => {
        const leftStr = left.toString();
        const rightStr = right.toString();
        const spaces = Math.max(1, charWidth - leftStr.length - rightStr.length);
        return leftStr + " ".repeat(spaces) + rightStr + "\n";
      };

      const formatTableRow = (col1, col2, col3, col4, col5) => {
        if (charWidth === 48) {
          return col1.toString().substring(0, 19).padEnd(19, ' ') + " " +
                 col2.toString().padStart(5, ' ') + " " +
                 col3.toString().padStart(5, ' ') + " " +
                 col4.toString().padStart(7, ' ') + " " +
                 col5.toString().padStart(8, ' ') + "\n";
        } else {
          return col1.toString().substring(0, 9).padEnd(9, ' ') + " " +
                 col2.toString().padStart(4, ' ') + " " +
                 col3.toString().padStart(4, ' ') + " " +
                 col4.toString().padStart(5, ' ') + " " +
                 col5.toString().padStart(6, ' ') + "\n";
        }
      };

      pushCmd(CMD_INIT);
      pushCmd(CMD_SET_FONT); 
      
      pushCmd(CMD_ALIGN_CENTER);
      pushCmd(CMD_SIZE_LARGE);
      pushCmd(CMD_BOLD_ON);
      pushText((receiptConfig?.headerText || storeDetails?.name || "STOREFRONT POS") + "\n");
      
      pushCmd(CMD_SIZE_NORMAL);
      pushCmd(CMD_BOLD_OFF);
      
      let subHeaderText = "";
      if (storeDetails?.address) subHeaderText += `${storeDetails.address}\n`;
      if (receiptConfig?.showPhone && storeDetails?.phone) subHeaderText += `Tel: +91 ${storeDetails.phone}\n`;
      if (receiptConfig?.showEmail && storeDetails?.email) subHeaderText += `Email: ${storeDetails.email}\n`;
      if (receiptConfig?.showGst && storeDetails?.gstNo) subHeaderText += `GSTIN: ${storeDetails.gstNo}\n`;
      
      pushCmd(CMD_BOLD_ON);
      pushText(subHeaderText + "\nINVOICE\n\n");
      pushCmd(CMD_BOLD_OFF);

      pushCmd(CMD_ALIGN_LEFT);
      let bodyText = "";
      const dateStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true });
      bodyText += formatLineLR(dateStr, `Invoice : 00022`);
      bodyText += dashedDivider;
      pushText(bodyText);

      if (receiptConfig?.showCustomerDetails) {
        let custText = `Customer Details :\n`;
        custText += `Name : Kanvya Sala School\n`;
        custText += `Contact : 9993749215\n`;
        custText += dashedDivider;
        pushText(custText);
      }
      
      pushCmd(CMD_BOLD_ON);
      pushText(formatTableRow("ITEM", "QTY", "MRP", "RATE", "TOTAL"));
      pushCmd(CMD_BOLD_OFF);

      let itemText = dashedDivider;
      itemText += formatTableRow(`Apron${receiptConfig?.showMeasuringUnit ? '(pc)' : ''}`, "3", "30", "21", "63.00");
      itemText += dashedDivider;
      
      itemText += formatLineLR("", "Rs 63.00");
      itemText += dashedDivider;
      
      let leftSummary1 = receiptConfig?.showTotalItems ? "Items : 1" : "";
      let leftSummary2 = receiptConfig?.showTotalQty ? "Total Qty : 3" : "";
      
      if (leftSummary1) {
        itemText += formatLineLR(leftSummary1, "Sub Total  Rs 63.00");
        if (leftSummary2) itemText += `${leftSummary2}\n`;
      } else if (leftSummary2) {
        itemText += formatLineLR(leftSummary2, "Sub Total  Rs 63.00");
      } else {
        itemText += formatLineLR("", "Sub Total  Rs 63.00");
      }

      itemText += dashedDivider;
      pushText(itemText);

      pushCmd(CMD_ALIGN_CENTER);
      pushCmd(CMD_SIZE_LARGE);
      pushCmd(CMD_BOLD_ON);
      pushText("Total : Rs 63.00\n");
      
      pushCmd(CMD_SIZE_NORMAL);
      pushCmd(CMD_BOLD_OFF);
      
      let footerTextStr = "";
      if (receiptConfig?.showSaveAmount) {
        footerTextStr += `You saved Rs 27.00 on this purchase\n`;
      }
      pushText(footerTextStr);
      
      pushCmd(CMD_ALIGN_LEFT);
      pushText(dashedDivider);
      pushCmd(CMD_ALIGN_CENTER);

      if (receiptConfig?.showPaymentMode) {
        let payText = `Payment Mode\n`;
        payText += `Cash : Rs 63.00\n`;
        pushText(payText);

        pushCmd(CMD_ALIGN_LEFT);
        pushText(dashedDivider);
        pushCmd(CMD_ALIGN_CENTER);
      }
      
      const footerLines = (receiptConfig?.footerText || "Thank You ! Visit Again\n.\n*!! Exchange within 7 day's !!*").split('\n');
      let finalFooter = "";
      footerLines.forEach(line => {
        finalFooter += `${line}\n`;
      });
      finalFooter += "\n\n\n\n"; 
      pushText(finalFooter);

      pushCmd(CMD_PAPER_CUT);

      let totalLength = payloadChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      let finalPayload = new Uint8Array(totalLength);
      let currentOffset = 0;
      payloadChunks.forEach(chunk => {
        finalPayload.set(chunk, currentOffset);
        currentOffset += chunk.length;
      });

      const CHUNK_SIZE = 100;
      for (let i = 0; i < finalPayload.length; i += CHUNK_SIZE) {
        const chunk = finalPayload.slice(i, i + CHUNK_SIZE);
        await printCharacteristic.writeValue(chunk);
      }

      setPrinterStatus('Connected');
      
    } catch (error) {
      console.error("Printing failed:", error);
      setPrinterStatus('Connected');
      alert(`Printing failed: ${error.message}`);
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

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptConfig({...receiptConfig, logoUrl: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    const newConfig = {...receiptConfig};
    delete newConfig.logoUrl;
    setReceiptConfig(newConfig);
  };

  const SettingToggle = ({ label, settingKey, isPremium }) => (
    <div className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
      <span className="text-slate-200 text-sm font-medium">{label}</span>
      {isPremium ? (
        <span className="text-xl" title="Premium Feature">👑</span>
      ) : (
        <div 
          onClick={() => setReceiptConfig({...receiptConfig, [settingKey]: !receiptConfig[settingKey]})} 
          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${receiptConfig[settingKey] ? 'bg-emerald-500' : 'bg-slate-600'}`}
        >
          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${receiptConfig[settingKey] ? 'translate-x-5' : ''}`}></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-6 overflow-y-auto bg-slate-50 font-sans relative">
      {isSidebarHidden && (
        <button onClick={showSidebar} className="absolute top-4 left-4 z-50 p-2 md:p-3 bg-slate-900 text-white rounded-xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-105" title="Show Menu">
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      <div className="max-w-5xl mx-auto w-full space-y-6 mt-12 md:mt-0">
        
        <h2 className="text-2xl font-bold text-slate-800 pl-12 md:pl-0 mb-2">🖨️ Hardware & Devices</h2>
        <p className="text-slate-500 mb-6 pl-12 md:pl-0">Manage your Bluetooth thermal printers, formats, and barcode scanners.</p>

        <div className="flex flex-col lg:flex-row gap-8">
          
          <div className="flex-1 space-y-6">
            
            {view === 'main' && (
              <div className="bg-[#0a0a0a] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
                <div className="bg-[#111] p-4 flex items-center border-b border-white/10">
                  <h2 className="text-xl font-medium text-white ml-2">Thermal Printer</h2>
                </div>

                <div className="p-4 flex-1 space-y-4">
                  <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 flex justify-between items-start">
                      <div className="flex gap-4">
                        <span className="text-3xl text-white">🖨️</span>
                        <div>
                          <h4 className="text-white font-bold text-lg leading-tight">{bluetoothPrinterName || 'No Printer Paired'}</h4>
                          <p className="text-slate-400 text-xs mt-1 uppercase">{printerSize} • Font {receiptConfig?.printerFont || 'A'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className={`w-3 h-3 rounded-full ${printerStatus === 'Connected' ? 'bg-emerald-500' : printerStatus === 'Searching...' || printerStatus === 'Printing...' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`}></div>
                      </div>
                    </div>
                    <div 
                      onClick={connectBluetoothPrinter}
                      className={`w-full py-3 text-center text-sm font-bold cursor-pointer transition-colors ${printerStatus === 'Connected' ? 'bg-emerald-800 text-emerald-200 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-50 text-white'}`}
                    >
                      {printerStatus === 'Connected' ? 'Reconnect Device' : 'Tap To Connect'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={printTestReceipt} disabled={!printCharacteristic} className="bg-[#1a1a1a] border border-white/10 hover:bg-[#222] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
                      Test Print
                    </button>
                    <button onClick={() => setView('setup')} className="bg-[#1a1a1a] border border-white/10 hover:bg-[#222] text-white font-bold py-3 rounded-xl transition-colors">
                      Printer Config
                    </button>
                  </div>

                  <button onClick={() => setView('receipt')} className="w-full mt-2 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-400 font-bold py-4 rounded-xl flex justify-between items-center px-5 transition-colors">
                    <span className="flex items-center gap-3"><span className="text-xl">🧾</span> Customize Receipt Format</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            )}

            {view === 'setup' && (
              <div className="bg-[#0a0a0a] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
                <div className="bg-[#111] p-4 flex items-center border-b border-white/10">
                  <button onClick={() => setView('main')} className="text-white mr-4 text-xl">←</button>
                  <h2 className="text-xl font-medium text-white">Printer Configuration</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-base">Printer Size :</span>
                    <select value={printerSize} onChange={e => setPrinterSize(e.target.value)} className="bg-[#111] border border-white/20 text-white rounded-lg px-4 py-3 outline-none focus:border-blue-500 min-w-[140px]">
                      <option value="58mm">58MM (2 inch)</option>
                      <option value="80mm">80MM (3 inch)</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white text-base">Auto-Cut Paper :</span>
                    <div className="w-11 h-6 flex items-center rounded-full p-1 bg-emerald-500 cursor-not-allowed">
                      <div className="bg-white w-4 h-4 rounded-full shadow-md transform translate-x-5"></div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[#111] border-t border-white/10 shrink-0">
                  <button onClick={() => setView('main')} className="w-full bg-slate-300 hover:bg-white text-black font-bold text-lg py-4 rounded-xl transition-colors">Done</button>
                </div>
              </div>
            )}

            {view === 'receipt' && (
              <div className="bg-[#0a0a0a] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[800px]">
                <div className="bg-[#111] p-4 flex items-center border-b border-white/10 shrink-0">
                  <button onClick={() => setView('main')} className="text-white mr-4 text-xl">←</button>
                  <h2 className="text-xl font-medium text-white">Thermal Printer</h2>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  
                  <div>
                    <button onClick={() => setActiveAccordion(activeAccordion === 'header' ? '' : 'header')} className="w-full p-4 flex justify-between items-center bg-[#0a0a0a] hover:bg-[#111] transition-colors">
                      <span className="text-white font-bold text-base">Header Info</span>
                      <span className={`text-orange-400 transform transition-transform ${activeAccordion === 'header' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    
                    {activeAccordion === 'header' && (
                      <div className="px-5 pb-4 space-y-4 animate-fade-in-down">
                        
                        <div className="flex justify-between items-center py-3 border-b border-white/5 mt-2">
                          <span className="text-slate-200 text-sm font-medium flex items-center gap-2">🔤 Printer Font</span>
                          <select 
                            value={receiptConfig.printerFont || 'A'} 
                            onChange={(e) => setReceiptConfig({...receiptConfig, printerFont: e.target.value})}
                            className="bg-[#111] border border-white/20 text-white rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 text-sm"
                          >
                            <option value="A">Font A (Standard)</option>
                            <option value="B">Font B (Narrow)</option>
                            <option value="C">Font C (Small)</option>
                          </select>
                        </div>

                        {/* --- NEW LOGO UPLOAD SECTION --- */}
                        <div className="flex flex-col gap-2 py-3 border-b border-white/5">
                          <span className="text-slate-200 text-sm font-medium flex items-center gap-2">🖼️ Store Logo</span>
                          {receiptConfig?.logoUrl ? (
                            <div className="flex items-center justify-between bg-[#111] p-3 rounded-lg border border-white/10">
                              <img src={receiptConfig.logoUrl} alt="Store Logo" className="h-12 w-auto object-contain bg-white rounded p-1" />
                              <button onClick={removeLogo} className="text-red-400 hover:text-red-500 text-sm font-bold bg-white/5 px-3 py-1.5 rounded-md">Remove</button>
                            </div>
                          ) : (
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleLogoUpload}
                              className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 w-full"
                            />
                          )}
                        </div>

                        <div className="relative mt-2">
                          <label className="absolute -top-2 left-3 bg-[#0a0a0a] px-1 text-[10px] font-bold text-slate-500">Receipt Header</label>
                          <input type="text" value={receiptConfig.headerText} onChange={(e) => setReceiptConfig({...receiptConfig, headerText: e.target.value})} className="w-full bg-transparent border border-white/20 rounded-lg p-3 pt-4 text-white outline-none focus:border-blue-500" />
                        </div>
                        <SettingToggle label="Email" settingKey="showEmail" />
                        <SettingToggle label="Phone Number" settingKey="showPhone" />
                        <SettingToggle label="GST Number" settingKey="showGst" />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5">
                    <button onClick={() => setActiveAccordion(activeAccordion === 'items' ? '' : 'items')} className="w-full p-4 flex justify-between items-center bg-[#0a0a0a] hover:bg-[#111] transition-colors">
                      <span className="text-white font-bold text-base">Item Table</span>
                      <span className={`text-orange-400 transform transition-transform ${activeAccordion === 'items' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    
                    {activeAccordion === 'items' && (
                      <div className="px-5 pb-4 animate-fade-in-down">
                        <SettingToggle label="Customer Details" settingKey="showCustomerDetails" />
                        <SettingToggle label="Customer credit details" isPremium={true} />
                        <SettingToggle label="Measuring Unit" settingKey="showMeasuringUnit" />
                        <SettingToggle label="MRP" settingKey="showMrp" />
                        <SettingToggle label="Payment Mode" settingKey="showPaymentMode" />
                        <SettingToggle label="Total items" settingKey="showTotalItems" />
                        <SettingToggle label="Total Qty" settingKey="showTotalQty" />
                        <SettingToggle label="Customer save amount message" settingKey="showSaveAmount" />
                        <SettingToggle label="Custom Note" isPremium={true} />
                        <SettingToggle label="Delivery Address" isPremium={true} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 mb-4">
                    <button onClick={() => setActiveAccordion(activeAccordion === 'footer' ? '' : 'footer')} className="w-full p-4 flex justify-between items-center bg-[#0a0a0a] hover:bg-[#111] transition-colors">
                      <span className="text-white font-bold text-base">Invoice footer</span>
                      <span className={`text-orange-400 transform transition-transform ${activeAccordion === 'footer' ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    
                    {activeAccordion === 'footer' && (
                      <div className="px-5 pb-4 animate-fade-in-down">
                        <span className="text-white text-sm block mb-3">Footer Description :</span>
                        <div className="relative">
                          <label className="absolute -top-2 left-3 bg-[#0a0a0a] px-1 text-[10px] font-bold text-slate-500">bill description</label>
                          <textarea 
                            value={receiptConfig.footerText} 
                            onChange={(e) => setReceiptConfig({...receiptConfig, footerText: e.target.value})} 
                            rows="4" 
                            className="w-full bg-transparent border border-white/20 rounded-lg p-3 pt-4 text-white outline-none focus:border-blue-500 resize-none" 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                <div className="p-4 bg-[#111] border-t border-white/10 shrink-0">
                  <button onClick={() => setView('main')} className="w-full bg-slate-300 hover:bg-white text-black font-bold text-lg py-4 rounded-xl transition-colors">
                    Update Settings
                  </button>
                </div>
              </div>
            )}

          </div>

          <div className="flex-1 flex flex-col items-center bg-slate-100 p-6 rounded-3xl border border-slate-200">
            <h4 className="font-bold text-slate-500 mb-4 uppercase text-xs tracking-wider">Live Preview</h4>
            
            <div className={`p-4 bg-white text-black font-sans shadow-sm mx-auto mt-4`} style={{ width: printerSize === '58mm' ? '260px' : '320px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                
              {/* --- NEW LOGO DISPLAY --- */}
              {receiptConfig?.logoUrl && (
                <div className="flex justify-center mb-2">
                  <img src={receiptConfig.logoUrl} alt="Store Logo" className="max-h-16 w-auto object-contain filter grayscale" />
                </div>
              )}

              <h2 className="text-center font-bold mb-1 uppercase leading-tight" style={{ fontSize: printerSize === '58mm' ? '18px' : '22px' }}>
                {receiptConfig?.headerText || storeDetails?.name || 'STOREFRONT POS'}
              </h2>
              
              <div className="text-center text-slate-800 mb-2 leading-tight" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                {storeDetails?.address && <div>{storeDetails.address}</div>}
                {receiptConfig?.showPhone && storeDetails?.phone && <div>Tel: +91 {storeDetails.phone}</div>}
                {receiptConfig?.showEmail && storeDetails?.email && <div>Email: {storeDetails.email}</div>}
                {receiptConfig?.showGst && storeDetails?.gstNo && <div>GSTIN: <span className="uppercase">{storeDetails.gstNo}</span></div>}
              </div>

              <div className="text-center font-bold mb-2 mt-3 tracking-widest" style={{ fontSize: printerSize === '58mm' ? '14px' : '16px' }}>
                INVOICE
              </div>
              
              <div className="flex justify-between text-slate-800 mb-1" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                <span>{new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true })}</span>
                <span>Invoice : 00022</span>
              </div>
              
              <div className="border-b border-dashed border-black mb-2"></div>

              {receiptConfig?.showCustomerDetails && (
                <>
                  <div className="text-slate-800 mb-2" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                    <div className="font-semibold">Customer Details :</div>
                    <div>Name : Kanvya Sala School</div>
                    <div>Contact : 9993749215</div>
                  </div>
                  <div className="border-b border-dashed border-black mb-2"></div>
                </>
              )}

              <div className="flex justify-between font-bold text-black mb-1 uppercase" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                <span className="w-[35%]">ITEM</span>
                <span className="w-[15%] text-center">QTY</span>
                <span className="w-[15%] text-center">MRP</span>
                <span className="w-[15%] text-center">RATE</span>
                <span className="w-[20%] text-right">TOTAL</span>
              </div>
              <div className="border-b border-dashed border-black mb-2"></div>
              
              <div className="space-y-2 mb-2 text-slate-800" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                <div className="flex justify-between items-start">
                  <span className="w-[35%] pr-1 break-words">Apron{receiptConfig?.showMeasuringUnit ? ' (pc)' : ''}</span>
                  <span className="w-[15%] text-center">3</span>
                  <span className="w-[15%] text-center">{receiptConfig?.showMrp ? '30' : '-'}</span>
                  <span className="w-[15%] text-center">21</span>
                  <span className="w-[20%] text-right">63.00</span>
                </div>
              </div>
              <div className="border-b border-dashed border-black mb-1"></div>
              
              <div className="flex justify-end text-black font-semibold mb-1" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                <span>Rs 63.00</span>
              </div>
              <div className="border-b border-dashed border-black mb-2"></div>

              <div className="flex justify-between items-start text-slate-800 mb-2" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                <div className="flex flex-col">
                  {receiptConfig?.showTotalItems && <span>Items : 1</span>}
                  {receiptConfig?.showTotalQty && <span>Total Qty : 3</span>}
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex justify-between w-[120px]">
                    <span>Sub Total</span>
                    <span>Rs 63.00</span>
                  </div>
                </div>
              </div>
              <div className="border-b border-dashed border-black mb-3"></div>

              <div className="flex justify-center items-center gap-3 font-bold text-black mb-1" style={{ fontSize: printerSize === '58mm' ? '20px' : '26px' }}>
                <span>Total : Rs</span>
                <span>63.00</span>
              </div>
              
              {receiptConfig?.showSaveAmount && (
                <div className="text-center text-slate-800 mb-3" style={{ fontSize: printerSize === '58mm' ? '9px' : '11px' }}>
                  You saved Rs 27.00 on this purchase
                </div>
              )}
              <div className="border-b border-dashed border-black mb-2"></div>

              {receiptConfig?.showPaymentMode && (
                <>
                  <div className="text-center text-slate-800" style={{ fontSize: printerSize === '58mm' ? '10px' : '12px' }}>
                    <div className="mb-0.5">Payment Mode</div>
                    <div>Cash : Rs 63.00</div>
                  </div>
                  <div className="border-b border-dashed border-black mt-2 mb-3"></div>
                </>
              )}

              <div className="text-center text-slate-800 leading-snug whitespace-pre-wrap" style={{ fontSize: printerSize === '58mm' ? '9px' : '11px' }}>
                {receiptConfig?.footerText || "Thank You . Visit again!!"}
              </div>
            </div>

          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-4">
            <div className="text-4xl">🔫</div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Barcode Scanner</h3>
              <p className="text-sm text-slate-500">Verify your USB or Bluetooth scanner is working correctly.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-bold text-slate-700">How to setup:</h4>
              <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                <li>Plug in your USB scanner or pair it via System Bluetooth.</li>
                <li>Ensure your computer treats the scanner as a "Keyboard".</li>
                <li>Click the test box on the right and scan an item!</li>
              </ol>
            </div>
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center">
              <label className="font-bold text-blue-800 mb-2">Scanner Test Area</label>
              <input ref={scannerInputRef} type="text" value={testScan} onChange={(e) => setTestScan(e.target.value)} onKeyDown={handleTestScan} placeholder="Click here & pull trigger..." className="w-full max-w-xs p-3 text-center border-2 border-blue-300 rounded-xl outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all font-mono" />
              <div className="mt-4 h-6">
                {lastScanSuccess ? <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-full text-sm animate-pulse">✅ {lastScanSuccess}</span> : <span className="text-slate-400 text-sm italic">Waiting for scan...</span>}
              </div>
            </div>
          </div>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}} />
    </div>
  );
}