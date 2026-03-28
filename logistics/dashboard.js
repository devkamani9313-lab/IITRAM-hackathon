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

// Initialize immediately
let map;
let mapLayers = [];

// NEW: Case-insensitive city registry with expanded Indian Hubs
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

// Helper: Normalized coord lookup (Case Invariant)
function getCoords(cityName) {
    const cityClean = (cityName || "").toLowerCase().trim();
    const coords = geocodingRegistry[cityClean];
    
    if (!coords) {
        console.warn(`[FarmConnect Map Sync] Unmapped City: ${cityName}. Defaulting to MH region.`);
        return [19.5, 74.5]; // Maharashtra Center Fallback
    }
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
}

function updateMapMarkers(shipments) {
    if (!map) return;

    // Clear old layers
    mapLayers.forEach(layer => map.removeLayer(layer));
    mapLayers = [];

    shipments.forEach(item => {
        const fromCoord = getCoords(item.location);
        const toCoord = getCoords(item.buyerCity);

        // Add Farm Marker (Pickup)
        const farmMarker = L.marker(fromCoord, {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">🚜</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).bindPopup(`<b>Farm Pickup:</b> ${item.farmerName}<br>${item.location || 'Nashik District'}`).addTo(map);
        mapLayers.push(farmMarker);

        // Add Buyer Marker (Delivery)
        const buyerMarker = L.marker(toCoord, {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">🏬</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).bindPopup(`<b>Consumer Delivery:</b> ${item.buyerName}<br>${item.buyerCity}`).addTo(map);
        mapLayers.push(buyerMarker);

        // Draw Route (Dashed Line)
        const polyline = L.polyline([fromCoord, toCoord], {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10',
            lineJoin: 'round'
        }).addTo(map);
        mapLayers.push(polyline);
    });

    // Auto-fit bounds if we have shipments
    if (mapLayers.length > 0) {
        const group = new L.featureGroup(mapLayers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

initMap();
initLogisticsHub();

function initLogisticsHub() {
    const listContainer = document.getElementById('shipment-list');
    const logisticsCity = localStorage.getItem('logisticsCity') || 'Nashik';
    
    // Update UI Header with active City
    const subtitle = document.querySelector('.main-content header p');
    if (subtitle) subtitle.textContent = `Real-time management for "Home Delivery" orders in ${logisticsCity}.`;

    // Listen for ALL "Home Delivery" orders and filter in JS for robustness (case-insensitivity)
    const q = query(
        collection(db, "buyer_orders"), 
        where("deliveryMethod", "==", "Home Delivery")
    );

    onSnapshot(q, (snapshot) => {
        if (!listContainer) return;
        
        let html = '';
        let stats = { pending: 0, transit: 0 };
        const allShipments = [];
        const cityLower = logisticsCity.toLowerCase().trim();

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Case-insensitive city matching
            const orderBuyerCity = (data.buyerCity || "").toLowerCase().trim();
            if (orderBuyerCity !== cityLower) return;

            const logStatus = data.logisticsStatus || 'pending_pickup';

            if (logStatus === 'pending_pickup') stats.pending++;
            if (logStatus === 'in_transit') stats.transit++;

            // Collect for Map (active shipments)
            if (logStatus !== 'delivered') {
                allShipments.push({ id, ...data });
                html += renderShipmentCard(id, data, logStatus);
            }
        });

        if (allShipments.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 5rem 2rem; background: var(--surface); border-radius: var(--radius-xl); border: 2px dashed var(--border-strong);">
                    <div style="font-size: 3.5rem; margin-bottom: 1.5rem; opacity: 0.1;">🚚</div>
                    <h3 style="font-weight: 850; margin-bottom: 0.5rem; color: var(--text-main);">No Deliveries Found</h3>
                    <p style="color: var(--text-muted); font-weight: 500;">Orders for <b>${logisticsCity}</b> with Home Delivery will appear here.</p>
                </div>`;
            updateStats(0, 0);
            updateMapMarkers([]); 
            return;
        }

        listContainer.innerHTML = html;
        updateStats(stats.pending, stats.transit);
        
        console.log(`[Map Sync] Plotting ${allShipments.length} shipments on the Supply Chain Map.`);
        updateMapMarkers(allShipments);
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
