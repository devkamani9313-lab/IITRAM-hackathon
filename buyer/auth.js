import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Handle Registration
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const mobile = document.getElementById('reg-mobile').value;
        const location = document.getElementById('reg-location').value;
        const password = document.getElementById('reg-password').value;
        const submitBtn = registerForm.querySelector('button');

        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Account...";

        try {
            // Check if mobile already exists in the "users" collection
            const q = query(collection(db, "users"), where("mobile", "==", mobile));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                alert("This mobile number is already registered!");
                submitBtn.disabled = false;
                submitBtn.textContent = "Create Account";
                return;
            }

            // Save new user (Buyer role) into "users"
            await addDoc(collection(db, "users"), {
                name,
                mobile,
                location,
                password,
                role: "buyer",
                createdAt: new Date().toISOString()
            });

            alert("Account created successfully! Please login.");
            // Switch to login tab
            if (typeof window.switchTab === 'function') {
                window.switchTab('login');
            } else {
                location.reload();
            }
        } catch (error) {
            console.error("Error during registration:", error);
            alert("Registration failed. Please try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
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
        const submitBtn = loginForm.querySelector('button');

        submitBtn.disabled = true;
        submitBtn.textContent = "Logging in...";

        try {
            // Find buyer in "users" collection (NOT Firebase Auth)
            const q = query(
                collection(db, "users"), 
                where("mobile", "==", mobile), 
                where("password", "==", password),
                where("role", "==", "buyer")
            );
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("Invalid mobile number or password for Buyer account.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Login to Dashboard";
                return;
            }

            // Success: Store simple session
            const userDoc = querySnapshot.docs[0];
            const data = userDoc.data();
            localStorage.setItem('buyerId', userDoc.id);
            localStorage.setItem('buyerName', data.name);
            localStorage.setItem('userLocation', data.location || 'Maharashtra');
            
            alert("Logged in successfully!");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error during login:", error);
            alert("Login failed. Please try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Login to Dashboard";
        }
    });
}

// Global Event Delegation & Explicit Window Handler for Logout
window.logoutBuyer = () => {
    if (confirm("Log out of FarmConnect?")) {
        localStorage.removeItem('buyerId');
        localStorage.removeItem('buyerName');
        localStorage.removeItem('userLocation');
        window.location.href = "login.html";
    }
};

document.body.addEventListener('click', (e) => {
    if (e.target.id === 'logout-btn' || e.target.classList.contains('nav-logout')) {
        e.preventDefault();
        window.logoutBuyer();
    }
});

// Logic to show/hide profile on the nav
document.addEventListener('DOMContentLoaded', () => {
    const buyerId = localStorage.getItem('buyerId');
    const loginNavBtn = document.getElementById('login-nav-btn');
    const profileArea = document.getElementById('profile-area');

    if (buyerId) {
        if (loginNavBtn) loginNavBtn.style.display = 'none';
        if (profileArea) profileArea.style.display = 'flex';
    } else {
        if (loginNavBtn) loginNavBtn.style.display = 'block';
        if (profileArea) profileArea.style.display = 'none';
        
        // Redirect if trying to view restricted pages without login
        const path = window.location.pathname;
        if (path.endsWith("index.html") || path.endsWith("/") || path.includes("orders.html") || path.includes("checkout.html")) {
            // Only alert for sub-pages, root index can just redirect quietly for a better UX
            if (path.includes("orders.html") || path.includes("checkout.html")) {
                alert("Please login as a Buyer first.");
            }
            window.location.href = "login.html";
        }
    }
});
