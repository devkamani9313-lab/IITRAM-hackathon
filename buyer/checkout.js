import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

window.confirmAndProceed = async () => {
    if (!currentUser) {
        alert("Please log in to place an order.");
        window.location.href = "login.html";
        return;
    }

    // Capture order data (mocking from the UI for now, usually from a cart)
    const orderData = {
        buyerId: currentUser.uid,
        productName: "Fresh Red Tomatoes (Bulk)", // In a real app, this would be from the cart
        farmerName: "Farmer Ram Singh",
        totalAmount: 904.25,
        status: "pending",
        paymentMethod: "pending_selection",
        createdAt: serverTimestamp()
    };

    try {
        const docRef = await addDoc(collection(db, "buyer_orders"), orderData);
        console.log("Order created with ID: ", docRef.id);
        
        // Save order ID to localStorage for the payment pages to reference
        localStorage.setItem('lastOrderId', docRef.id);
        
        // Redirect to payment selection
        window.location.href = "payment-details.html";
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Order failed. Please try again.");
    }
};
