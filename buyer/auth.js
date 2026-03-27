import { db, collection, addDoc, getDocs, query, where, doc, getDoc } from "./firebase-config.js";

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

// Logic to show/hide profile on the nav
document.addEventListener('DOMContentLoaded', () => {
    const buyerId = localStorage.getItem('buyerId');
    const loginNavBtn = document.getElementById('login-nav-btn');
    const profileArea = document.getElementById('profile-area');
    const authContainer = document.getElementById('auth-container');

    if (buyerId) {
        if (loginNavBtn) loginNavBtn.style.display = 'none';
        if (profileArea) profileArea.style.display = 'flex';
        
        // Handle Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                if (confirm("Log out of FarmConnect?")) {
                    localStorage.removeItem('buyerId');
                    localStorage.removeItem('buyerName');
                    window.location.href = "login.html";
                }
            };
        }
    } else {
        if (loginNavBtn) loginNavBtn.style.display = 'block';
        if (profileArea) profileArea.style.display = 'none';
        
        // Redirect if trying to view orders without login
        if (window.location.pathname.includes("orders.html") || window.location.pathname.includes("checkout.html")) {
            alert("Please login as a Buyer first.");
            window.location.href = "login.html";
        }
    }
});
