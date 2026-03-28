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

// Initialize state
let map;
let mapLayers = [];
const logisticsCity = localStorage.getItem('logisticsCity') || 'Nashik';

// --- TAB SWITCHING & UI NAVIGATION ---
window.switchTab = (target) => {
    // 1. Sidebar states
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${target}`);
    if (navItem) navItem.classList.add('active');

    // 2. Section states
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const section = document.getElementById(`section-${target}`);
    if (section) section.classList.add('active');

    // 3. Header updates
    const title = document.getElementById('view-title');
    const subtitle = document.getElementById('view-subtitle');
    const stats = document.getElementById('stats-container');

    if (target === 'active') {
        if (title) title.textContent = "Logistics Hub";
        if (subtitle) subtitle.textContent = `Active management for "Home Delivery" in ${logisticsCity}.`;
        if (stats) stats.style.display = 'flex';
        moveMap('map-slot-active');
    } else if (target === 'history') {
        if (title) title.textContent = "Delivery History";
        if (subtitle) subtitle.textContent = `View all successful completions in ${logisticsCity}.`;
        if (stats) stats.style.display = 'flex';
        // Hide map in history view to keep it clean
        const mapEl = document.getElementById('map-command-center');
        if (mapEl) mapEl.style.display = 'none';
    } else if (target === 'map') {
        if (title) title.textContent = "Network Intelligence";
        if (subtitle) subtitle.textContent = "Full-screen supply chain visualization.";
        if (stats) stats.style.display = 'none';
        moveMap('map-slot-full');
    }
};

function moveMap(slotId) {
    const mapEl = document.getElementById('map-command-center');
    const slot = document.getElementById(slotId);
    if (!mapEl || !slot) return;
    
    mapEl.style.display = 'block';
    slot.appendChild(mapEl);
    
    // Resize Leaflet to fit new container dimensions
    if (map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// --- GEOCODING & MAPPING ---
const geocodingRegistry = {
    "nashik": [19.9975, 73.7898],
    "mumbai": [19.0760, 72.8777],
    "surat": [21.1702, 72.8311],
    "pune": [18.5204, 73.8567],
    "ahmedabad": [23.0225, 72.5714],
    "nagpur": [21.1458, 79.0882],
    "rajkot": [22.3039, 70.8022],
    "vadodara": [22.3072, 73.1812],
    "bangalore": [12.9716, 77.5946],
    "delhi": [28.6139, 77.2090],
    "hyderabad": [17.3850, 78.4867],
    "chennai": [13.0827, 80.2707],
    "kolkata": [22.5726, 88.3639],
    "jaipur": [26.9124, 75.7873],
    "lucknow": [26.8467, 80.9462],
    "amravati": [20.9320, 77.7523],
    "aurangabad": [19.8762, 75.3433],
    "solapur": [17.6599, 75.9064],
    "hubli": [15.3647, 75.1240]
};

function getCoords(cityName) {
    const cityClean = (cityName || "").toLowerCase().trim();
    const coords = geocodingRegistry[cityClean];
    if (!coords) return [19.5, 74.5]; // Fallback
    return coords;
}

function initMap() {
    const mapElement = document.getElementById('map-command-center');
    if (!mapElement) return;

    map = L.map('map-command-center', {
        zoomControl: false,
        scrollWheelZoom: false
    }).setView([19.5, 73.5], 7); 

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; Leaflet | &copy; CARTO'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    // Initial placement
    moveMap('map-slot-active');
}

// --- DATA SYNC & RENDERING ---
function initLogisticsHub() {
    const listContainer = document.getElementById('shipment-list');
    const historyContainer = document.getElementById('history-list');
    if (!listContainer || !historyContainer) return;

    const q = query(
        collection(db, "buyer_orders"), 
        where("deliveryMethod", "==", "Home Delivery")
    );

    onSnapshot(q, (snapshot) => {
        let activeHtml = '';
        let historyHtml = '';
        let stats = { pending: 0, transit: 0 };
        const mapShipments = [];
        const cityLower = logisticsCity.toLowerCase().trim();

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const orderBuyerCity = (data.buyerCity || "").toLowerCase().trim();
            if (orderBuyerCity !== cityLower) return;

            const logStatus = data.logisticsStatus || 'pending_pickup';

            if (logStatus === 'delivered') {
                historyHtml += renderHistoryCard(id, data);
            } else {
                if (logStatus === 'pending_pickup') stats.pending++;
                if (logStatus === 'in_transit') stats.transit++;
                
                mapShipments.push({ id, ...data });
                activeHtml += renderShipmentCard(id, data, logStatus);
            }
        });

        // 1. Update Active View
        if (mapShipments.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem; background: var(--surface); border-radius: var(--radius-xl); border: 2px dashed var(--border-strong);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.1;">🚚</div>
                    <h3 style="font-weight: 850; color: var(--text-main);">No Active Deliveries</h3>
                    <p style="color: var(--text-muted);">New marketplace orders for ${logisticsCity} will appear here.</p>
                </div>`;
        } else {
            listContainer.innerHTML = activeHtml;
        }

        // 2. Update History View
        if (historyHtml === '') {
            historyContainer.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; background: var(--surface); border-radius: var(--radius-xl); border: 1px solid var(--border-subtle); opacity: 0.6;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No completed deliveries found yet for this region.</p>
                </div>`;
        } else {
            historyContainer.innerHTML = historyHtml;
        }

        updateStats(stats.pending, stats.transit);
        updateMapMarkers(mapShipments);
    });
}

function renderShipmentCard(id, data, logStatus) {
    let statusPill = '';
    let actionBtn = '';

    if (logStatus === 'pending_pickup') {
        statusPill = `<span class="status-pill status-pending">🚜 At Farm</span>`;
        actionBtn = `<button class="btn btn-action" onclick="updateShipment('${id}', 'in_transit')">Pickup Shipment</button>`;
    } else if (logStatus === 'in_transit') {
        statusPill = `<span class="status-pill status-transit">🚚 In Transit</span>`;
        actionBtn = `<button class="btn btn-action btn-delivered" onclick="updateShipment('${id}', 'delivered')">Confirm Delivery</button>`;
    }

    return `
        <div class="order-card animate-fade">
            <div class="order-icon"><i class="fa-solid fa-box-open"></i></div>
            <div class="order-details">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted);">#${id.substring(0,8).toUpperCase()}</span>
                    ${statusPill}
                </div>
                <h3 style="font-weight: 850; color: var(--text-main); font-size: 1.25rem;">${data.productName}</h3>
                <div style="display: flex; gap: 2rem; margin-top: 0.75rem;">
                    <div>
                        <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: block;">Pickup</span>
                        <span style="font-weight: 700; font-size: 0.9rem;">🧑‍🌾 ${data.farmerName}</span>
                    </div>
                    <div style="font-size: 1.25rem; opacity: 0.3;">➡️</div>
                    <div>
                        <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: block;">Deliver</span>
                        <span style="font-weight: 700; font-size: 0.9rem;">🏬 ${data.buyerName}</span>
                    </div>
                </div>
            </div>
            <div>${actionBtn}</div>
        </div>
    `;
}

function renderHistoryCard(id, data) {
    return `
        <div class="order-card" style="opacity: 0.8; border-color: var(--border-subtle);">
            <div class="order-icon" style="background: #f0fdf4; color: #10b981;"><i class="fa-solid fa-check-double"></i></div>
            <div class="order-details">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted);">#${id.substring(0,8).toUpperCase()}</span>
                    <span class="status-pill status-delivered">✅ Delivered</span>
                </div>
                <h3 style="font-weight: 850; color: var(--text-main); font-size: 1.15rem;">${data.productName}</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
                    From <b>${data.farmerName}</b> to <b>${data.buyerName}</b> successfully.
                </p>
            </div>
        </div>
    `;
}

function updateMapMarkers(shipments) {
    if (!map) return;
    mapLayers.forEach(layer => map.removeLayer(layer));
    mapLayers = [];

    shipments.forEach(item => {
        const fromCoord = getCoords(item.location);
        const toCoord = getCoords(item.buyerCity);

        const farm = L.marker(fromCoord, {
            icon: L.divIcon({ className: 'custom-div-icon', html: `🚜`, iconSize: [30, 30], iconAnchor: [15, 15] })
        }).addTo(map);
        
        const buyer = L.marker(toCoord, {
            icon: L.divIcon({ className: 'custom-div-icon', html: `🏬`, iconSize: [30, 30], iconAnchor: [15, 15] })
        }).addTo(map);

        const line = L.polyline([fromCoord, toCoord], { color: '#f59e0b', weight: 3, dashArray: '10, 10' }).addTo(map);
        mapLayers.push(farm, buyer, line);
    });

    if (mapLayers.length > 0) {
        const group = new L.featureGroup(mapLayers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
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
        const updates = { logisticsStatus: newStatus, updatedAt: serverTimestamp() };
        if (newStatus === 'delivered') updates.status = 'delivered';
        await updateDoc(orderRef, updates);
    } catch (err) {
        console.error(err);
        alert("Action failed.");
    }
}

// Initial Launch
initMap();
initLogisticsHub();
