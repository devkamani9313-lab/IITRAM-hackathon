// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
