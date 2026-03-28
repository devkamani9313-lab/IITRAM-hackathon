import { db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    getDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const buyerId = localStorage.getItem('buyerId');
let allOrders = []; // Store orders for local filtering

// -- 1. Authentication Guard --
if (buyerId) {
    initOrders();
} else {
    // UI Preview Mode
    initOrders();
}

function initOrders() {
    // If we're on the list page
    if (document.getElementById('orders-list')) {
        loadOrdersList();
        setupSearch();
    }
    
    // If we're on the details page
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    if (orderId) {
        loadOrderDetails(orderId);
    }
}

function setupSearch() {
    const searchInput = document.getElementById("product-search");
    if (!searchInput) return;
    
    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allOrders.filter(o => 
            (o.productName || "").toLowerCase().includes(term) ||
            (o.farmerName || "").toLowerCase().includes(term) ||
            (o.id || "").toLowerCase().includes(term)
        );
        renderOrders(filtered);
    });
}

// -- 2. Load Orders Table --
function loadOrdersList() {
    if (!buyerId) return console.log("Guest mode order list.");

    const q = query(
        collection(db, "buyer_orders"), 
        where("buyerId", "==", buyerId)
    );

    onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrders(allOrders);
    });
}

function renderOrders(orders) {
    const list = document.getElementById("orders-list");
    if (!list) return;
    
    list.innerHTML = "";
    let stats = { total: 0, delivered: 0, pending: 0 };
    
    orders.forEach((data) => {
        const id = data.id;
        stats.total++;
        if (data.status === 'delivered') stats.delivered++;
        else stats.pending++;

            const row = document.createElement("div");
            row.className = "order-row animate-fade";
            row.onclick = () => window.location.href = `order-details.html?id=${id}`;
            
            const statusClass = (data.status === 'delivered' || data.status === 'approved') ? 'approved' : 'pending';
            const statusText = data.status === 'delivered' ? 'Delivered' : 'Pending';
            const displayId = id.substring(0, 8).toUpperCase();
            const displayDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'Today';

            row.innerHTML = `
                <div class="order-id">#${displayId}</div>
                <div class="product-name">${data.productName || 'Produce'}</div>
                <div class="farmer-name">${data.farmerName || 'Farmer'}</div>
                <div class="amount">₹${data.totalAmount || '0'}</div>
                <div class="status-cell">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="order-date">${displayDate}</div>
                <div class="action-cell">
                    <button class="btn-text">View Details</button>
                </div>
            `;
            list.appendChild(row);
        });

        // Update stats
        document.getElementById("stat-total").innerText = stats.total;
        document.getElementById("stat-delivered").innerText = stats.delivered;
        document.getElementById("stat-pending").innerText = stats.pending;
}

// -- 3. Load Specific Order Details --
async function loadOrderDetails(orderId) {
    if (!buyerId) return console.log("Guest mode order details.");

    try {
        const docRef = doc(db, "buyer_orders", orderId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Set text content
            document.getElementById("order-id-display").innerText = `Order #${orderId.substring(0, 8).toUpperCase()}`;
            document.getElementById("farmer-name").innerText = data.farmerName || "Farmer";
            
            const statusBadge = document.getElementById("status-display");
            const isDelivered = (data.status === 'delivered' || data.status === 'approved');
            
            statusBadge.className = `status-badge ${isDelivered ? 'approved' : 'pending'}`;
            statusBadge.innerText = isDelivered ? 'Delivered' : 'Pending';

            // Check Visibility of Refund Section (Only for Delivered)
            const refundSection = document.getElementById("refund-section");
            if (refundSection) {
                refundSection.style.display = isDelivered ? 'block' : 'none';
            }

        }
    } catch (e) {
        console.error("Error loading order details:", e);
    }
}

// -- 4. Handle Refund Requests --
const refundForm = document.getElementById("refund-form");
if (refundForm) {
    refundForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const reason = document.getElementById("refund-reason").value;
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('id');

        if (!reason) return alert("Please provide a reason for the refund request.");

        try {
            await addDoc(collection(db, "refund_requests"), {
                buyerId: buyerId,
                orderId: orderId,
                reason: reason,
                status: "pending", // Refund request starts as red (pending)
                submittedAt: serverTimestamp()
            });
            alert("Refund request submitted successfully! Someone will contact you shortly.");
            refundForm.reset();
        } catch (e) {
            console.error("Error submitting refund:", e);
            alert("Submission failed. Please try again.");
        }
    });
}

// Placeholder for Download Invoice
window.downloadInvoice = () => {
    alert("Downloading PDF Invoice... (Feature is currently in development)");
};
