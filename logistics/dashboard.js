import { db } from "../buyer/firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize immediately - ES Modules are deferred by default, no DOMContentLoaded needed
initLogisticsHub();

function initLogisticsHub() {
    const listContainer = document.getElementById('shipment-list');
    const logisticsCity = localStorage.getItem('logisticsCity') || 'Nashik';
    
    // Update UI Header with active City
    const subtitle = document.querySelector('.main-content header p');
    if (subtitle) subtitle.textContent = `Real-time management for "Home Delivery" orders in ${logisticsCity}.`;

    // Listen only for orders in THIS city that opted for "Home Delivery"
    const q = query(
        collection(db, "buyer_orders"), 
        where("deliveryMethod", "==", "Home Delivery"),
        where("buyerCity", "==", logisticsCity)
    );

    onSnapshot(q, (snapshot) => {
        if (!listContainer) return;
        
        let html = '';
        let stats = { pending: 0, transit: 0 };

        if (snapshot.empty) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; background: var(--surface); border-radius: var(--radius-xl); border: 2px dashed var(--border-strong);">
                    <div style="font-size: 3.5rem; margin-bottom: 1.5rem; opacity: 0.1;">🚚</div>
                    <h3 style="font-weight: 850; margin-bottom: 0.5rem; color: var(--text-main);">No Deliveries Found</h3>
                    <p style="color: var(--text-muted); font-weight: 500;">New marketplace orders with Home Delivery will appear here.</p>
                </div>`;
            updateStats(0, 0);
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const logStatus = data.logisticsStatus || 'pending_pickup';

            if (logStatus === 'pending_pickup') stats.pending++;
            if (logStatus === 'in_transit') stats.transit++;

            // Skip completed ones for the active view
            if (logStatus === 'delivered') return;

            html += renderShipmentCard(id, data, logStatus);
        });

        listContainer.innerHTML = html || `
            <div style="text-align: center; padding: 5rem 2rem; background: var(--surface); border-radius: var(--radius-xl); border: 2px dashed var(--border-strong);">
                <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem;"></i>
                <p style="color: var(--text-muted); font-weight: 600;">Daily target met! All shipments processed.</p>
            </div>`;
            
        updateStats(stats.pending, stats.transit);
    });
}

function renderShipmentCard(id, data, logStatus) {
    let statusPill = '';
    let actionBtn = '';

    if (logStatus === 'pending_pickup') {
        statusPill = `<span class="status-pill status-pending"><i class="fa-solid fa-tractor"></i> At Farm</span>`;
        actionBtn = `<button class="btn btn-action" onclick="updateShipment('${id}', 'in_transit')">Pickup Shipment</button>`;
    } else if (logStatus === 'in_transit') {
        statusPill = `<span class="status-pill status-transit"><i class="fa-solid fa-truck-fast"></i> Out for Delivery</span>`;
        actionBtn = `<button class="btn btn-action btn-delivered" onclick="updateShipment('${id}', 'delivered')">Confirm Delivery</button>`;
    }

    return `
        <div class="order-card animate-fade">
            <div class="order-icon">
                <i class="fa-solid fa-box-open"></i>
            </div>
            <div class="order-details">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em;">#${id.substring(0,8).toUpperCase()}</span>
                    ${statusPill}
                </div>
                <h3 style="font-weight: 850; color: var(--text-main); font-size: 1.25rem;">${data.productName}</h3>
                <div style="display: flex; gap: 2rem; margin-top: 0.75rem;">
                    <div>
                        <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: block;">Pickup At Farm</span>
                        <span style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">🧑‍🌾 ${data.farmerName} (${data.location || 'Nashik'})</span>
                    </div>
                    <div style="font-size: 1.25rem; opacity: 0.3;">➡️</div>
                    <div>
                        <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: block;">Deliver To Buyer</span>
                        <span style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">🏬 ${data.buyerName} (${data.buyerCity || 'Mumbai'})</span>
                    </div>
                </div>
            </div>
            <div>
                ${actionBtn}
            </div>
        </div>
    `;
}

function updateStats(pending, transit) {
    const p = document.getElementById('stat-pending');
    const t = document.getElementById('stat-transit');
    if (p) p.textContent = pending;
    if (t) t.textContent = transit;
}

window.updateShipment = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "buyer_orders", orderId);
        
        const updates = {
            logisticsStatus: newStatus,
            updatedAt: serverTimestamp()
        };

        // If it's delivered, we also update the main order status
        if (newStatus === 'delivered') {
            updates.status = 'delivered';
        }

        await updateDoc(orderRef, updates);
        console.log(`Shipment ${orderId} updated to ${newStatus}`);
    } catch (err) {
        console.error("Update failed:", err);
        alert("Failed to update status. Please try again.");
    }
}
