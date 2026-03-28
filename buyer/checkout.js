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
    getDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.openPaymentModal = () => {
    if (realCartItems.length === 0) return alert("Your cart is empty!");
    document.getElementById('modal-pay-amount').textContent = cartTotalAmount.toFixed(2);
    document.getElementById('paymentModalOverlay').style.display = 'flex';
};

window.closePaymentModal = () => {
    document.getElementById('paymentModalOverlay').style.display = 'none';
};

window.selectLogistics = (mode, fee) => {
    deliveryFee = fee;
    const cards = document.querySelectorAll('.option-card');
    cards.forEach(c => c.classList.remove('active'));
    
    if (mode === 'delivery') cards[0].classList.add('active');
    else cards[1].classList.add('active');

    calculateTotals();
};

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
    const serviceFeeRate = 0.01;
    const tax = currentCartSubtotal * serviceFeeRate;
    cartTotalAmount = currentCartSubtotal + deliveryFee + tax;

    document.getElementById('summary-subtotal').textContent = `₹${currentCartSubtotal.toFixed(2)}`;
    document.getElementById('summary-delivery').textContent = `₹${deliveryFee.toFixed(2)}`;
    document.getElementById('summary-tax').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('summary-total').textContent = `₹${cartTotalAmount.toFixed(2)}`;
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
    const cartContainer = document.getElementById('cart-items-container');
    
    if (realCartItems.length === 0) {
        cartContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;">🛒</div>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Your cart is empty.</p>
                <a href="index.html" class="btn btn-outline">Browse Marketplace</a>
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
                    <p class="item-farmer">🧑‍🌾 ${item.farmerName} • ${item.unit}</p>
                </div>
                <div class="quantity-controls">
                    <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty - 1})">−</button>
                    <span class="qty-val" style="font-weight: 800; min-width: 20px; text-align: center;">${item.qty}</span>
                    <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty + 1})">+</button>
                </div>
                <div class="item-price">₹${(item.price * item.qty).toFixed(2)}</div>
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

    const selectedMethod = document.querySelector('input[name="pay-method"]:checked').value;
    const isCOD = selectedMethod === 'cod';

    if (isCOD) {
        payBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Placing Order...';
    } else {
        payBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    }

    try {
        // --- 1. CRITICAL STOCK VALIDATION ---
        for (const item of realCartItems) {
            const productRef = doc(db, "products", item.productId);
            const productSnap = await getDoc(productRef);
            
            if (!productSnap.exists()) {
                alert(`Error: Product "${item.productName}" no longer exists in our marketplace.`);
                payBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Securely Now';
                payBtn.disabled = false;
                return;
            }

            const currentStock = Number(productSnap.data().qty);
            if (item.qty > currentStock) {
                alert(`Stock Unavailable: Only ${currentStock} units of "${item.productName}" remain. Please adjust your cart quantity.`);
                payBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Securely Now';
                payBtn.disabled = false;
                return;
            }
        }

        // --- 2. PREPARE ORDERS ---
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

        const farmerCount = Object.keys(ordersByFarmer).length;
        const deliveryPerFarmer = deliveryFee / farmerCount;

        const orderPromises = [];
        const stockUpdatePromises = [];

        // --- 3. EXECUTE ORDERS & STOCK DECREMENT ---
        for (const fId in ordersByFarmer) {
            const fData = ordersByFarmer[fId];
            const gst = fData.subtotal * 0.05;
            const finalFarmerAmount = fData.subtotal + gst + deliveryPerFarmer;

            const orderData = {
                buyerId: buyerId,
                buyerName: buyerName || "Wholesale Buyer",
                farmerId: fData.farmerId,
                farmerName: fData.farmerName,
                productName: fData.items.join(", "),
                totalAmount: Number(finalFarmerAmount.toFixed(2)),
                status: isCOD ? "placed" : "paid",
                paymentMethod: selectedMethod === 'cod' ? "Cash on Delivery" : selectedMethod.toUpperCase(),
                deliveryMethod: deliveryFee === 0 ? "Self Pickup" : "Home Delivery",
                createdAt: serverTimestamp()
            };
            
            orderPromises.push(addDoc(collection(db, "buyer_orders"), orderData));
        }

        // Prepare stock subtractions for EVERY item purchased
        for (const item of realCartItems) {
            const productRef = doc(db, "products", item.productId);
            const productSnap = await getDoc(productRef);
            const currentStock = Number(productSnap.data().qty);
            stockUpdatePromises.push(updateDoc(productRef, {
                qty: Math.max(0, currentStock - item.qty)
            }));
        }

        // Finalize database updates
        await Promise.all([...orderPromises, ...stockUpdatePromises]);
        
        // Clear all items from the cart in the database now that they are ordered
        const deletePromises = realCartItems.map(item => deleteDoc(doc(db, "buyer_cart", item.id)));
        await Promise.all(deletePromises);
        
        if (isCOD) {
            alert("Order placed successfully! Please pay the farmer ₹" + cartTotalAmount.toFixed(2) + " upon delivery.");
        } else {
            alert("Payment Successful! Your orders have been sent to the farmers.");
        }
        window.location.href = "orders.html"; 
    } catch (e) {
        console.error("Error processing payment: ", e);
        alert("Payment processing failed. Please try again.");
        payBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Securely Now';
        payBtn.disabled = false;
    }
};
