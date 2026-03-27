import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    onSnapshot,
    query,
    where,
    updateDoc,
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const buyerId = localStorage.getItem('buyerId');
const buyerName = localStorage.getItem('buyerName');
let realCartItems = [];
let cartTotalAmount = 0;

if (!buyerId) {
    alert("Please log in to checkout.");
    window.location.href = "login.html";
} else {
    // Listen to real cart
    listenToBuyerCart();
}

// Global state for checkout math
let deliveryFee = 45;

window.setDeliveryMode = (mode) => {
    const optHome = document.getElementById('opt-home');
    const optPickup = document.getElementById('opt-pickup');
    const addressGroup = document.getElementById('delivery-address-group');
    const deliveryDisplay = document.getElementById('cart-delivery');

    if (mode === 'pickup') {
        deliveryFee = 0;
        optPickup.classList.add('active');
        optHome.classList.remove('active');
        addressGroup.style.display = 'none';
        deliveryDisplay.textContent = '₹0.00';
    } else {
        deliveryFee = 45;
        optHome.classList.add('active');
        optPickup.classList.remove('active');
        addressGroup.style.display = 'block';
        deliveryDisplay.textContent = '₹45.00';
    }
    
    // Force a recount
    calculateTotals();
};

let currentCartSubtotal = 0;

window.calculateTotals = () => {
    const gstRate = 0.05;
    const tax = currentCartSubtotal * gstRate;
    cartTotalAmount = currentCartSubtotal + deliveryFee + tax;

    document.getElementById('cart-subtotal').textContent = `₹${currentCartSubtotal.toFixed(2)}`;
    document.getElementById('cart-tax').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `₹${cartTotalAmount.toFixed(2)}`;
};

function listenToBuyerCart() {
    const q = query(collection(db, "buyer_cart"), where("buyerId", "==", buyerId));
    onSnapshot(q, (snapshot) => {
        realCartItems = [];
        currentCartSubtotal = 0;
        let totalItems = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            realCartItems.push({ id: docSnap.id, ...data });
            currentCartSubtotal += data.price * data.qty;
            totalItems += data.qty;
        });

        // Update nav badge
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(b => b.textContent = totalItems);

        renderCheckoutCart();
        calculateTotals();
    });
}

function renderCheckoutCart() {
    const cartContainer = document.getElementById('real-cart-items');
    
    if (realCartItems.length === 0) {
        cartContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                <i class="fa-solid fa-cart-arrow-down" style="font-size: 3rem; margin-bottom: 1rem; color: #e2e8f0;"></i>
                <p>Your cart is empty.</p>
                <button class="btn" style="margin-top: 15px; background: var(--primary-color); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;" onclick="window.location.href='index.html'">Go to Marketplace</button>
            </div>`;
        currentCartSubtotal = 0;
        calculateTotals();
        return;
    }

    let html = '';
    realCartItems.forEach(item => {
        const safeName = (item.productName || '').replace(/'/g, "\\'");
        html += `
            <div class="cart-item">
                <img src="${item.imageUrl}" class="cart-item-img" alt="${safeName}">
                <div class="item-info">
                    <h4 class="item-name">${safeName}</h4>
                    <p class="item-farmer">${item.farmerName} • ${item.unit}</p>
                </div>
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty - 1})">-</button>
                    <span class="qty-val">${item.qty}</span>
                    <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty + 1})">+</button>
                </div>
                <div class="item-price">₹${item.price * item.qty}</div>
            </div>
        `;
    });

    cartContainer.innerHTML = html;
}

window.updateCartQty = async (cartItemId, newQty) => {
    if (newQty < 1) {
        await deleteDoc(doc(db, "buyer_cart", cartItemId));
    } else {
        await updateDoc(doc(db, "buyer_cart", cartItemId), {
            qty: newQty
        });
    }
}

window.confirmAndProceed = async () => {
    if (!buyerId) {
        alert("Please log in to place an order.");
        window.location.href = "login.html";
        return;
    }

    if (realCartItems.length === 0) {
        return alert("Your cart is empty! Add products before checking out.");
    }

    // Pass the calculated total to the Payment Modal
    document.getElementById('payment-modal-total').textContent = `₹${cartTotalAmount.toFixed(2)}`;
    document.getElementById('paymentModalOverlay').style.display = 'flex';
};

window.processPayment = async () => {
    const payBtn = document.getElementById('paySecurelyBtn');
    payBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    payBtn.disabled = true;

    // Get selected payment method
    const selectedMethod = document.querySelector('input[name="pay-method"]:checked').value;

    try {
        // Group items by farmer so farmers get their own distinct orders
        const ordersByFarmer = {};

        realCartItems.forEach(item => {
            if (!ordersByFarmer[item.farmerId]) {
                ordersByFarmer[item.farmerId] = {
                    farmerId: item.farmerId,
                    farmerName: item.farmerName,
                    items: [],
                    subtotal: 0
                };
            }
            ordersByFarmer[item.farmerId].items.push(`${item.qty}x ${item.productName}`);
            ordersByFarmer[item.farmerId].subtotal += (item.qty * item.price);
        });

        // Calculate proportions (Delivery split, GST 5% proportional)
        const farmerCount = Object.keys(ordersByFarmer).length;
        const deliveryPerFarmer = deliveryFee / farmerCount;

        const orderPromises = [];
        for (const fId in ordersByFarmer) {
            const fData = ordersByFarmer[fId];
            const gst = fData.subtotal * 0.05;
            const finalFarmerAmount = fData.subtotal + gst + deliveryPerFarmer;

            const orderData = {
                buyerId: buyerId,
                buyerName: buyerName || "Wholesale Buyer",
                farmerId: fData.farmerId, // Exact route mapping for the Farmer Dashboard
                farmerName: fData.farmerName,
                productName: fData.items.join(", "),
                totalAmount: Number(finalFarmerAmount.toFixed(2)),
                status: "paid", // The mock payment was successful
                paymentMethod: selectedMethod,
                deliveryMethod: deliveryFee === 0 ? "Self Pickup" : "Home Delivery",
                createdAt: serverTimestamp()
            };
            
            orderPromises.push(addDoc(collection(db, "buyer_orders"), orderData));
        }

        // Wait for all individual farmer orders to submit
        await Promise.all(orderPromises);
        
        // Clear all items from the cart in the database now that they are ordered
        const deletePromises = realCartItems.map(item => deleteDoc(doc(db, "buyer_cart", item.id)));
        await Promise.all(deletePromises);
        
        alert("Payment Successful! Your orders have been sent to the farmers.");
        window.location.href = "orders.html"; 
    } catch (e) {
        console.error("Error processing payment: ", e);
        alert("Payment processing failed. Please try again.");
        payBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Securely Now';
        payBtn.disabled = false;
    }
};
