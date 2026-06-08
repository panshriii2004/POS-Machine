import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

// 1. YOUR FIREBASE KEYS (Paste your exact keys here)
const firebaseConfig = {
  apiKey: "AIzaSyBggEhNPsSv-4ev4tQz-4z48-Y0nZQ-zS8",
  authDomain: "shoppos-5b446.firebaseapp.com",
  projectId: "shoppos-5b446",
  storageBucket: "shoppos-5b446.firebasestorage.app",
  messagingSenderId: "769924781362",
  appId: "1:769924781362:web:11eb76907163a11b32732b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("☁️ Connected to Cloud Print Queue. Listening for receipts...");

// 2. LISTEN TO THE CLOUD 24/7
const q = query(collection(db, "print_queue"), where("status", "==", "pending"));

onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === "added") {
      const ticket = change.doc.data();
      const ticketId = change.doc.id;
      console.log(`🖨️ New cloud print job received! (ID: ${ticketId})`);

      try {
        // 3. CONNECT TO USB PRINTER
        let printer = new ThermalPrinter({
          type: PrinterTypes.EPSON, 
          interface: 'printer:TVS-E RP 3230', // <--- CHANGE THIS TO YOUR EXACT WINDOWS PRINTER NAME!
          options: { timeout: 5000 }
        });

        // 4. DESIGN THE RECEIPT
        printer.alignCenter();
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println(ticket.storeDetails.name || "STOREFRONT POS");
        
        printer.setTextNormal();
        printer.bold(false);
        if(ticket.storeDetails.address) printer.println(ticket.storeDetails.address);
        if(ticket.storeDetails.phone) printer.println(`Ph: ${ticket.storeDetails.phone}`);
        printer.drawLine();
        
        printer.alignLeft();
        printer.println(`Cashier: ${ticket.cashierName}`);
        printer.println(`Customer: ${ticket.cart.customerName || 'Walk-in'}`);
        printer.drawLine();

        printer.tableCustom([
          { text: "ITEM", align: "LEFT", width: 0.5, bold: true },
          { text: "QTY", align: "CENTER", width: 0.2, bold: true },
          { text: "TOTAL", align: "RIGHT", width: 0.3, bold: true }
        ]);
        
        ticket.cart.invoice.forEach(item => {
          printer.tableCustom([
            { text: item.name.substring(0, 15), align: "LEFT", width: 0.5 },
            { text: item.quantity.toString(), align: "CENTER", width: 0.2 },
            { text: `Rs.${(item.price * item.quantity).toFixed(2)}`, align: "RIGHT", width: 0.3 }
          ]);
        });

        printer.drawLine();
        printer.alignRight();
        printer.println(`Subtotal: Rs.${ticket.subtotal.toFixed(2)}`);
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println(`TOTAL: Rs.${ticket.total.toFixed(2)}`);
        
        printer.setTextNormal();
        printer.alignCenter();
        printer.drawLine();
        printer.println("Thank you for shopping!");
        printer.cut();

        // 5. PRINT IT!
        await printer.execute();
        
        // 6. DELETE IT FROM THE CLOUD (So it doesn't print twice)
        await deleteDoc(doc(db, "print_queue", ticketId));
        console.log(`✅ Print complete and removed from cloud queue.`);

      } catch (error) {
        console.error("❌ Print failed (is the printer on?):", error);
      }
    }
  });
});