import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBggEhNPsSv-4ev4tQz-4z48-Y0nZQ-zS8",
  authDomain: "shoppos-5b446.firebaseapp.com",
  projectId: "shoppos-5b446",
  storageBucket: "shoppos-5b446.firebasestorage.app",
  messagingSenderId: "769924781362",
  appId: "1:769924781362:web:11eb76907163a11b32732b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database so App.jsx can talk to it!
export const auth = getAuth(app);
export const db = getFirestore(app);