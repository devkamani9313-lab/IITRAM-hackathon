import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Helper to convert mobile number to a dummy email for Firebase Auth
const mobileToEmail = (mobile) => `${mobile.replace(/\s+/g, '')}@farmconnect.com`;

// Handle Registration
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const mobile = document.getElementById('reg-mobile').value;
        const location = document.getElementById('reg-location').value;
        const password = document.getElementById('reg-password').value;

        const email = mobileToEmail(mobile);

        try {
            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Store additional metadata in Firestore
            await setDoc(doc(db, "buyers", user.uid), {
                name: name,
                mobile: mobile,
                location: location,
                role: "buyer",
                createdAt: new Date().toISOString()
            });

            alert("Account created successfully!");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error during registration:", error);
            alert("Registration failed: " + error.message);
        }
    });
}

// Handle Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mobile = document.getElementById('login-mobile').value;
        const password = document.getElementById('login-password').value;

        const email = mobileToEmail(mobile);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Logged in successfully!");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error during login:", error);
            alert("Login failed: " + error.message);
        }
    });
}

// Check auth state
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is signed in:", user.uid);
        // If we are on login.html, redirect to index.html
        if (window.location.pathname.includes("login.html")) {
            // window.location.href = "index.html";
        }
    } else {
        console.log("No user signed in.");
    }
});
