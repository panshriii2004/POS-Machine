import express from 'express';
import cors from 'cors';
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

const app = express();
app.use(cors());
app.use(express.json());

// THIS IS THE API ENDPOINT THE PHONES WILL TALK TO
app.post('/print-receipt', async (req, res) => {
  const { cart, storeDetails, cashierName, subtotal, total } = req.body;

  try {
    // 1. Connect to the USB Printer
    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON, // Works for 95% of Chinese 3-inch thermal printers
      interface: 'printer:TVS-E RP 3230', // <--- IMPORTANT: Change this to your Windows Printer Name!
      characterSet: 'PC858_EURO',
      removeSpecialCharacters: false,
      options: { timeout: 5000 }
    });

    // 2. Design the Receipt
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(storeDetails.name || "STOREFRONT POS");
    
    printer.setTextNormal();
    printer.bold(false);
    if(storeDetails.address) printer.println(storeDetails.address);
    if(storeDetails.phone) printer.println(`Ph: ${storeDetails.phone}`);
    printer.drawLine();
    
    printer.alignLeft();
    printer.println(`Receipt: #${Date.now().toString().slice(-6)}`);
    printer.println(`Cashier: ${cashierName}`);
    printer.println(`Customer: ${cart.customerName || 'Walk-in'}`);
    printer.drawLine();

    // 3. Loop through the cart items
    printer.tableCustom([
      { text: "ITEM", align: "LEFT", width: 0.5, bold: true },
      { text: "QTY", align: "CENTER", width: 0.2, bold: true },
      { text: "TOTAL", align: "RIGHT", width: 0.3, bold: true }
    ]);
    
    cart.invoice.forEach(item => {
      printer.tableCustom([
        { text: item.name.substring(0, 15), align: "LEFT", width: 0.5 },
        { text: item.quantity.toString(), align: "CENTER", width: 0.2 },
        { text: `Rs.${(item.price * item.quantity).toFixed(2)}`, align: "RIGHT", width: 0.3 }
      ]);
    });

    printer.drawLine();
    printer.alignRight();
    printer.println(`Subtotal: Rs.${subtotal.toFixed(2)}`);
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(`TOTAL: Rs.${total.toFixed(2)}`);
    
    printer.setTextNormal();
    printer.alignCenter();
    printer.drawLine();
    printer.println("Thank you for shopping!");
    
    printer.cut();

    // 4. Send it to the hardware!
    await printer.execute();
    console.log("🖨️ Receipt printed successfully!");
    res.status(200).json({ success: true, message: "Printed!" });

  } catch (error) {
    console.error("Print Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start listening on port 3001
app.listen(3001, '0.0.0.0', () => {
  console.log('📡 Print Relay Server is running on port 3001');
});