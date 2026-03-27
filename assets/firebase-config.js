// Firebase SDK: Modular CDN (v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDK4k1OyasdviHxTgPwPo52dll5hiqzThY",
  authDomain: "farmconnect-hackathon.firebaseapp.com",
  projectId: "farmconnect-hackathon",
  storageBucket: "farmconnect-hackathon.firebasestorage.app",
  messagingSenderId: "398914062477",
  appId: "1:398914062477:web:5224a54c09310aececbac4",
  measurementId: "G-7VBHVSLKPZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export instances to be used globally
export { db, collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, doc };
