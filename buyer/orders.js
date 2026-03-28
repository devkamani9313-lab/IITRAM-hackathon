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
let activeOrderData = null; // To store current order info for refunds
let refundListener = null; // To clean up listeners
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
    let stats = { total: 0, delivered: 0, pending: 0, impact: 0 };
    
    orders.forEach((data) => {
        const id = data.id;
        stats.total++;
        
        const status = data.status || 'pending';
        const isDelivered = (status === 'delivered' || status === 'approved');
        
        if (isDelivered) {
            stats.delivered++;
            // Calculate impact: Assume each order represents approx 5kg of local instead of global (0.5kg/kg CO2 saved)
            const qty = parseInt(data.quantity) || 5; 
            stats.impact += (qty * 0.5);
        } else if (status === 'pending') {
            stats.pending++;
        }

        const row = document.createElement("div");
        row.className = "order-row animate-fade";
        row.onclick = () => window.location.href = `order-details.html?id=${id}`;
        
        let statusClass = 'pending';
        let statusText = 'Pending';

        if (status === 'refunded') {
            statusClass = 'archived'; 
            statusText = 'REFUNDED';
        } else if (isDelivered) {
            statusClass = 'approved';
            statusText = 'Delivered';
        }

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
    const totalEl = document.getElementById("stat-total");
    const delEl = document.getElementById("stat-delivered");
    const pendEl = document.getElementById("stat-pending");
    const impactEl = document.getElementById("stat-impact");

    if (totalEl) totalEl.innerText = stats.total;
    if (delEl) delEl.innerText = stats.delivered;
    if (pendEl) pendEl.innerText = stats.pending;
    if (impactEl) impactEl.innerText = `${stats.impact.toFixed(1)} kg`;
}

// -- 3. Load Specific Order Details --
async function loadOrderDetails(orderId) {
    if (!buyerId) return console.log("Guest mode order details.");

    try {
        const docRef = doc(db, "buyer_orders", orderId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const total = parseFloat(data.totalAmount) || 0;
            const tax = total * 0.01;
            const delivery = 50; 
            const grandTotal = total + tax + delivery;

            // Header & Status
            document.getElementById("order-id-display").innerText = `Order #${orderId.substring(0, 8).toUpperCase()}`;
            document.getElementById("farmer-name").innerText = data.farmerName || "Farmer";
            
            const statusBadge = document.getElementById("status-display");
            const status = data.status || 'pending';
            
            if (status === 'refunded') {
                statusBadge.className = 'status-badge archived';
                statusBadge.innerText = 'REFUNDED';
                statusBadge.style.background = '#3b82f6'; // Blue for clarity
            } else if (status === 'delivered' || status === 'approved') {
                statusBadge.className = 'status-badge approved';
                statusBadge.innerText = 'Delivered';
            } else {
                statusBadge.className = 'status-badge pending';
                statusBadge.innerText = 'Pending';
            }

            // Always track and show refund status if the order has been delivered or refunded
            const refundSection = document.getElementById("refund-section");
            if (status === 'delivered' || status === 'refunded' || status === 'approved') {
                if (refundSection) refundSection.style.display = 'block';
                trackRefundStatus(orderId);
            } else {
                if (refundSection) refundSection.style.display = 'none';
            }

            // Premium Table Rows
            const invoiceItems = document.getElementById("invoice-items");
            if (invoiceItems) {
                invoiceItems.innerHTML = `
                <tr>
                    <td>
                        <div style="font-weight: 800; font-size: 1.15rem; color: var(--text-main); letter-spacing: -0.01em;">${data.productName || 'Fresh Harvest'}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-top: 6px;">Certified A-Grade Selection</div>
                    </td>
                    <td class="text-center" style="font-weight: 800; color: var(--text-main);">${data.quantity || '1'} Units</td>
                    <td class="text-right" style="font-weight: 700; color: var(--text-muted);">₹${(total / (data.quantity || 1)).toFixed(2)}</td>
                    <td class="text-right" style="font-weight: 900; color: var(--primary); font-size: 1.1rem;">₹${total.toFixed(2)}</td>
                </tr>
                `;
            }

            // Hyper-Aligned Grid injection
            const netVal = document.getElementById("net-amount-val");
            const taxVal = document.getElementById("tax-fee-val");
            const delVal = document.getElementById("delivery-fee-val");
            const totalVal = document.getElementById("total-amount-val");

            if (netVal) netVal.innerText = `₹${total.toFixed(2)}`;
            if (taxVal) taxVal.innerText = `₹${tax.toFixed(2)}`;
            if (delVal) delVal.innerText = `₹${delivery.toFixed(2)}`;
            if (totalVal) totalVal.innerText = `₹${grandTotal.toFixed(2)}`;

            // Dynamic Seal Timestamp
            const timestampEl = document.querySelector(".timestamp-text");
            if (timestampEl && data.createdAt) {
                const date = data.createdAt.toDate();
                timestampEl.innerText = `Processed on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST`;
            }

            activeOrderData = { id: orderId, ...data };
        }
    } catch (e) {
        console.error("Error loading order details:", e);
    }
}

// -- 4. Refund Lifecycle Logic --
function trackRefundStatus(orderId) {
    const statusDisplay = document.getElementById("refund-status-display");
    const refundForm = document.getElementById("refund-form");
    const refundCard = document.querySelector(".refund-card");

    if (refundListener) refundListener(); // Cleanup

    const q = query(
        collection(db, "refund_requests"), 
        where("orderId", "==", orderId)
    );

    refundListener = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const refund = snapshot.docs[0].data();
            const status = refund.status || "pending";
            
            // Hide selection/form if a request exists
            if (refundCard) refundCard.style.display = "none";
            if (refundForm) refundForm.style.display = "none";
            if (statusDisplay) statusDisplay.style.display = "block";

            const title = document.getElementById("refund-status-title");
            const desc = document.getElementById("refund-status-desc");
            const indicator = statusDisplay.querySelector(".status-indicator");

            if (status === "pending") {
                title.innerText = "Refund Request Pending";
                desc.innerText = "The farmer is reviewing your request. You'll be notified here of the decision.";
                indicator.style.background = "#f59e0b"; // Amber
            } else if (status === "accepted") {
                title.innerText = "Refund Approved";
                desc.innerText = "The farmer has accepted your refund request. The funds will be processed shortly.";
                indicator.style.background = "#10b981"; // Emerald
            } else if (status === "rejected") {
                title.innerText = "Refund Request Declined";
                desc.innerText = "The farmer has declined this request. Please contact support if you believe this is an error.";
                indicator.style.background = "#ef4444"; // Red
            }
        } else {
            // No refund request yet, show standard form if delivered
            if (statusDisplay) statusDisplay.style.display = "none";
            if (refundCard) refundCard.style.display = "flex";
        }
    });
}

// Global Submission Handler
document.addEventListener('submit', async (e) => {
    if (e.target.id === "refund-form") {
        e.preventDefault();
        if (!activeOrderData) return;

        const reason = document.getElementById("refund-reason").value;
        const submitBtn = document.getElementById("submit-refund-btn");
        
        if (!reason.trim()) return alert("Please provide a reason for the refund.");

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            await addDoc(collection(db, "refund_requests"), {
                orderId: activeOrderData.id,
                buyerId: buyerId,
                buyerName: localStorage.getItem('buyerName') || "Buyer",
                farmerId: activeOrderData.farmerId,
                productName: activeOrderData.productName,
                totalAmount: activeOrderData.totalAmount,
                reason: reason,
                status: "pending",
                createdAt: serverTimestamp()
            });

            alert("Refund request submitted successfully!");
        } catch (err) {
            console.error("Error submitting refund:", err);
            alert("Failed to submit refund request.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Submit Application";
        }
    }
});

// -- 5. Premium PDF Generation Logic --
window.downloadInvoice = () => {
    const invoiceElement = document.querySelector(".invoice-box");
    if (!invoiceElement) return alert("Invoice data not found.");

    // Data-Ready Check: Don't print if values are still zero (meaning data hasn't arrived)
    const grandTotalVal = document.getElementById("total-amount-val")?.innerText;
    if (grandTotalVal === "₹0.00" || !grandTotalVal) {
        return alert("Price data is still loading. Please wait 1 second and try again.");
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id') || "UNKNOWN";

    // Setup High-Contrast Mode for PDF
    document.body.classList.add("pdf-printing");
    
    const opt = {
        margin: [0.5, 0.5],
        filename: `FarmConnect_Invoice_${orderId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            letterRendering: true,
            scrollY: 0,
            logging: false
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    const btn = document.querySelector(".btn-lift");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    // Small delay to let the browser settle the "pdf-printing" styles
    setTimeout(() => {
        html2pdf().set(opt).from(invoiceElement).save().then(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            document.body.classList.remove("pdf-printing");
        }).catch(err => {
            console.error("PDF Error:", err);
            btn.innerHTML = originalText;
            btn.disabled = false;
            document.body.classList.remove("pdf-printing");
        });
    }, 250);
};
