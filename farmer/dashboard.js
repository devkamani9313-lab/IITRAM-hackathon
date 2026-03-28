// Farmer Dashboard: Integrated Firebase Cloud Interaction
import { db, collection, addDoc, getDocs, getDoc, query, where, onSnapshot, updateDoc, doc, serverTimestamp, deleteDoc } from "../assets/firebase-config.js";

// Health Score Metrics (State)
let deliveredCount = 0;
let refundAcceptedCount = 0;
let salesChart = null; // High-level analytics instance
let currentChartFilter = 'daily'; // Default view
let lastOrdersData = []; // Cache for instant switching

// Global Image Fallbacks
const categoryFallbacks = {
    fruits: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&q=80&w=400", // Combined Fruit Spread
    vegetables: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=400", // Combined Vegetable Assortment
    grains: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400", // Combined Grains in Bowls
    cereals: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400"
};

// -- Core UI Helpers (Required for Inline HTML Handlers) --
window.openFarmerModal = () => {
    const modal = document.getElementById('modalOverlay');
    if (modal) {
        modal.classList.add('active');
        const form = document.getElementById('addProduceForm');
        if (form) {
            form.reset();
            // Reset market price UI
            document.getElementById('minPriceDisplay').textContent = "₹ --";
            document.getElementById('maxPriceDisplay').textContent = "₹ --";
            document.getElementById('marketTrendStatus').style.opacity = 0;
        }
    }
};

// --- NEW: Market Intelligence Engine ---
let currentMin = 0;
let currentMax = 0;

window.fetchMarketTrend = async () => {
    const crop = document.getElementById('prodName').value;
    const unit = document.getElementById('prodUnit').value;
    const status = document.getElementById('marketTrendStatus');
    const minD = document.getElementById('minPriceDisplay');
    const maxD = document.getElementById('maxPriceDisplay');
    const city = localStorage.getItem('farmerLocation') || "Nashik";

    if (!crop || crop.length < 3) return;

    status.style.opacity = 1;
    status.textContent = `🔋 Analyzing ${city} Market Trends...`;

    // Simulate API Latency (Agmarknet)
    await new Promise(r => setTimeout(r, 600));

    // Base market values (Simulated lookup table)
    const basePrices = {
        mango: { min: 450, max: 800, unit: 'Dozen' },
        potato: { min: 14, max: 28, unit: 'kg' },
        tomato: { min: 20, max: 45, unit: 'kg' },
        onion: { min: 18, max: 55, unit: 'kg' },
        wheat: { min: 22, max: 35, unit: 'kg' },
        rice: { min: 35, max: 70, unit: 'kg' },
        apple: { min: 80, max: 180, unit: 'kg' },
        grapes: { min: 60, max: 120, unit: 'kg' },
        orange: { min: 40, max: 90, unit: 'kg' },
        chilli: { min: 45, max: 95, unit: 'kg' }
    };

    let lookup = null;
    for (let key in basePrices) {
        if (crop.toLowerCase().includes(key)) {
            lookup = basePrices[key];
            break;
        }
    }

    if (!lookup) {
        // Dynamic fallback for unknown crops
        lookup = { min: 30, max: 100, unit: 'kg' };
    }

    // Adjust for City multiplier
    let cityMultiplier = 1.0;
    if (city.includes("Mumbai")) cityMultiplier = 1.25;
    if (city.includes("Pune")) cityMultiplier = 1.15;

    // Final Calculation
    currentMin = Math.round(lookup.min * cityMultiplier);
    currentMax = Math.round(lookup.max * cityMultiplier);

    // If unit doesn't match base, convert (roughly)
    if (unit === 'Tons') { currentMin *= 1000; currentMax *= 1000; }
    if (unit === 'Quintal') { currentMin *= 100; currentMax *= 100; }
    // Note: Mango/Dozen logic is handled by basePrice definition if matched

    minD.textContent = `₹${currentMin}`;
    maxD.textContent = `₹${currentMax}`;
    status.textContent = `✅ Live ${city} Hub Rate Sync Complete`;
    
    // Auto-update price validation msg
    validateFarmerPrice();
};

window.validateFarmerPrice = () => {
    const val = Number(document.getElementById('prodPrice').value);
    const msg = document.getElementById('priceValidationMsg');
    
    if (!val || !currentMin) return;

    if (val < currentMin) {
        msg.textContent = "⚠️ Warning: Your price is below the market floor. You might lose profit.";
        msg.style.color = "#ec4899"; // pink
    } else if (val > currentMax) {
        msg.textContent = "⚠️ Warning: Your price is above the market ceiling. Buyers may prefer other farms.";
        msg.style.color = "#f59e0b"; // amber
    } else {
        msg.textContent = "✨ Excellent! Your price is perfectly in line with market trends.";
        msg.style.color = "#10b981"; // emerald
    }
};

window.confirmFarmerLogout = () => {
    if (confirm("Log out of FarmConnect?")) {
        localStorage.clear();
        window.location.href = "../index.html"; 
    }
};

window.deleteCrop = async (id, name) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
        try {
            await deleteDoc(doc(db, "products", id));
        } catch (e) {
            alert("Failed to delete the crop.");
        }
    }
};

window.openEditModal = (id, name, qty, price) => {
    const modal = document.getElementById('editModalOverlay');
    if (modal) {
        document.getElementById('editProdId').value = id;
        document.getElementById('editProdNameDisplay').textContent = name;
        document.getElementById('editProdQty').value = qty;
        document.getElementById('editProdPrice').value = price;
        modal.classList.add('active');
    }
};

// Helper for dynamic images if the farmer didn't specify a unique one
function getCropImage(name, currentUrl, category) {
    const crop = (name || "").toLowerCase();
    const cat = (category || "").toLowerCase();

    const images = {
        mango: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400",
        potato: "https://images.unsplash.com/photo-1518977676601-b53f02bad675?auto=format&fit=crop&q=80&w=400",
        tomato: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400",
        "green chilli": "https://images.unsplash.com/photo-1590740924043-4328f645228c?auto=format&fit=crop&q=80&w=400",
        chilli: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=400",
        onion: "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=400",
        wheat: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=400",
        rice: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400",
        carrot: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=400",
        orange: "https://images.unsplash.com/photo-1557800636-894a64c1696f?auto=format&fit=crop&q=80&w=400",
        grapes: "https://images.unsplash.com/photo-1537640538966-79f369b41f8f?auto=format&fit=crop&q=80&w=400",
        apple: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400",
        banana: "https://images.unsplash.com/photo-1571771894821-ad9b58a33646?auto=format&fit=crop&q=80&w=400",
        corn: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&q=80&w=400",
        lemon: "https://images.unsplash.com/photo-1568569350062-ebad051a3d1d?auto=format&fit=crop&q=80&w=400",
        garlic: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&q=80&w=400",
        ginger: "https://images.unsplash.com/photo-1599307767316-776533bb941c?auto=format&fit=crop&q=80&w=400",
        vegetable: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=400",
        fruit: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&q=80&w=400",
        grain: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400"
    };

    const keywordMatch = (function() {
        if (crop.includes("green chilli")) return images["green chilli"];
        for (let key in images) {
            if (crop.includes(key)) return images[key];
        }
        return null;
    })();

    if (keywordMatch) return keywordMatch;
    
    // Category Fallback logic
    if (!currentUrl || currentUrl === "" || currentUrl === "undefined" || currentUrl.includes("tomato") || currentUrl.includes("0651230702") || currentUrl.includes("featured")) {
        return categoryFallbacks[cat] || categoryFallbacks.vegetables;
    }

    return currentUrl;
}

// Global helper for dynamic crop emojis (New)
function getCropEmoji(name) {
    const crop = (name || "").toLowerCase();
    if (crop.includes("mango")) return "🥭";
    if (crop.includes("chilli") || crop.includes("chili")) return "🌶️";
    if (crop.includes("potato")) return "🥔";
    if (crop.includes("tomato")) return "🍅";
    if (crop.includes("onion")) return "🧅";
    if (crop.includes("wheat") || crop.includes("rice") || crop.includes("grain")) return "🌾";
    if (crop.includes("banana")) return "🍌";
    if (crop.includes("apple")) return "🍎";
    if (crop.includes("carrot")) return "🥕";
    if (crop.includes("corn")) return "🌽";
    return "🌿"; 
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session & UI Setup
    const farmerId = localStorage.getItem('farmerId');
    const farmName = localStorage.getItem('farmName');
    const farmerLoc = localStorage.getItem('farmerLocation');

    if (!farmerId) {
        window.location.href = "index.html";
        return;
    }

    const displayFarmName = document.getElementById('displayFarmName');
    if (displayFarmName) displayFarmName.textContent = farmName;

    // Trigger Weather Forecast
    fetchWeather(farmerLoc);

    // 2. Form Submission (Listing Crops)
    const addProduceForm = document.getElementById('addProduceForm');
    if (addProduceForm) {
        addProduceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addProduceForm.querySelector('button');
            const cropName = document.getElementById('prodName').value;
            
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";

            try {
                await addDoc(collection(db, "products"), {
                    name: cropName,
                    qty: document.getElementById('prodQty').value,
                    unit: document.getElementById('prodUnit').value,
                    category: document.getElementById('prodCategory')?.value || "vegetables",
                    price: Number(document.getElementById('prodPrice').value),
                    farmerId,
                    farmerName: farmName,
                    location: farmerLoc,
                    imageUrl: getCropImage(cropName, "", document.getElementById('prodCategory')?.value),
                    isOrganic: true,
                    createdAt: serverTimestamp()
                });
                document.getElementById('modalOverlay').classList.remove('active');
                addProduceForm.reset();
            } catch (err) {
                console.error(err);
                alert("Error saving crop.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Post to Marketplace 🚀";
            }
        });
    }

    // Edit Submission
    const editProduceForm = document.getElementById('editProduceForm');
    if (editProduceForm) {
        editProduceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = editProduceForm.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.textContent = "Updating...";

            try {
                const id = document.getElementById('editProdId').value;
                const newQty = document.getElementById('editProdQty').value;
                const newPrice = Number(document.getElementById('editProdPrice').value);
                
                await updateDoc(doc(db, "products", id), {
                    qty: newQty,
                    price: newPrice
                });
                
                document.getElementById('editModalOverlay').classList.remove('active');
            } catch (err) {
                console.error(err);
                alert("Error updating crop details.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Confirm";
            }
        });
    }

    // 3. Real-Time Product List
    const produceGrid = document.getElementById('produceGrid');
    const qProducts = query(collection(db, "products"), where("farmerId", "==", farmerId));
    onSnapshot(qProducts, (snapshot) => {
        if (!produceGrid) return;
        produceGrid.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const id = docSnap.id;
            const card = document.createElement('div');
            card.className = 'premium-card-item';
            
            // Note: Safe encoding of variables for the inline onclick handlers
            const escName = (item.name || "").replace(/'/g, "\\'");
            
            card.innerHTML = `
                <div class="p-icon">${getCropEmoji(item.name)}</div>
                <h3 class="p-name">${item.name}</h3>
                <p class="p-meta">${item.qty} ${item.unit} Available</p>
                <div class="p-price">₹${item.price} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">/ ${item.unit}</span></div>
                <div class="p-actions">
                    <button class="p-btn" onclick="openEditModal('${id}', '${escName}', '${item.qty}', '${item.price}')">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button class="p-btn p-btn-del" onclick="deleteCrop('${id}', '${escName}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;
            produceGrid.appendChild(card);
        });
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = snapshot.empty ? 'block' : 'none';
        document.getElementById('totalProducts').textContent = snapshot.size;
    });

    // 4. Negotiations Listener
    const qNegs = query(collection(db, "negotiations"), where("farmerId", "==", farmerId), where("status", "==", "active"));
    onSnapshot(qNegs, (snapshot) => {
        const list = document.getElementById('negotiationList');
        if (!list) return;
        list.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const neg = docSnap.data();
            const row = document.createElement('div');
            row.className = 'order-row-item negotiation-row-align';
            row.innerHTML = `
                <div class="o-detail"><span class="o-label">Buyer</span><span class="o-value">${neg.buyerName || 'Client'}</span></div>
                <div class="o-detail"><span class="o-label">Crop</span><span class="o-value">${neg.productName}</span></div>
                <div class="o-detail"><span class="o-label">Offered Price</span><span class="o-value" style="color: var(--primary); font-weight: 800;">₹${neg.offeredPrice || 0}</span></div>
                <div class="negotiation-actions">
                    <button class="n-btn n-btn-accept" onclick="updateStatus('${docSnap.id}', 'accepted')">
                        <i class="fa-solid fa-check"></i> Accept
                    </button>
                    <button class="n-btn n-btn-reject" onclick="updateStatus('${docSnap.id}', 'rejected')">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                </div>
            `;
            list.appendChild(row);
        });
    });

    // 5. Orders Listener (Completed Purchases)
    const qOrders = query(collection(db, "buyer_orders"), where("farmerId", "==", farmerId));
    onSnapshot(qOrders, (snapshot) => {
        const list = document.getElementById('salesHistoryList');
        const activeOrdersCount = document.getElementById('activeOrders');
        
        if (!list) return;
        
        if (snapshot.empty) {
            list.innerHTML = `
                <div class="order-empty-message">
                    <p>No sales history yet. Your paid orders will appear here automatically.</p>
                </div>`;
            if (activeOrdersCount) activeOrdersCount.textContent = "0";
            // Update chart with zeros
            lastOrdersData = [];
            updateSalesChart([]);
            return;
        }

        list.innerHTML = '';
        let totalCount = 0;
        lastOrdersData = snapshot.docs.map(d => d.data());
        
        snapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            totalCount++;
            
            const row = document.createElement('div');
            row.className = 'order-row-item';
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1.2fr 0.8fr 1.5fr 1fr 1fr 1fr';
            row.style.alignItems = 'center';
            row.style.padding = '1.25rem 2rem';
            row.style.gap = '1.5rem';
            
            const dateStr = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'Just now';
            const status = order.status || 'pending';
            const isDelivered = status === 'delivered';
            
            row.innerHTML = `
                <div class="o-detail"><span class="o-label">Buyer</span><span class="o-value">${order.buyerName || 'Client'}</span></div>
                <div class="o-detail"><span class="o-label">Date</span><span class="o-value">${dateStr}</span></div>
                <div class="o-detail"><span class="o-label">Items</span><span class="o-value" style="font-weight:800;">${order.productName}</span></div>
                <div class="o-detail"><span class="o-label">Amount</span><span class="o-value" style="color: var(--primary); font-weight: 900;">₹${order.totalAmount}</span></div>
                <div class="o-detail">
                    <span class="o-label">Logistics</span>
                    <span class="status-tag ${isDelivered ? 'delivered' : 'pending'}">${status.toUpperCase()}</span>
                </div>
                <div class="o-detail" style="text-align: right;">
                    ${!isDelivered 
                        ? `<button class="btn-fulfill" onclick="updateOrderStatus('${orderId}', 'delivered')">
                            <i class="fa-solid fa-truck-fast"></i> Deliver
                           </button>` 
                        : `<span class="fulfillment-done"><i class="fa-solid fa-circle-check"></i> Fulfilled</span>`
                    }
                </div>
            `;
            list.appendChild(row);
        });

        if (activeOrdersCount) activeOrdersCount.textContent = totalCount;
        
        // Update Chart with fresh data
        updateSalesChart(lastOrdersData);

        // Count officially delivered orders for health score
        deliveredCount = snapshot.docs.filter(d => d.data().status === 'delivered').length;
        updateHealthScore();
    });

    // 6. Refund Request Listener (Pending actions)
    const qRefunds = query(collection(db, "refund_requests"), where("farmerId", "==", farmerId), where("status", "==", "pending"));
    onSnapshot(qRefunds, (snapshot) => {
        const section = document.getElementById('refundSection');
        const list = document.getElementById('refundList');
        if (!section || !list) return;

        section.style.display = snapshot.empty ? 'none' : 'block';
        list.innerHTML = '';

        snapshot.forEach((docSnap) => {
            const refund = docSnap.data();
            const id = docSnap.id;
            const row = document.createElement('div');
            row.className = 'order-row-item';
            row.style.background = '#fffafa'; // Subtle red tint
            row.innerHTML = `
                <div class="o-detail"><span class="o-label">Buyer</span><span class="o-value">${refund.buyerName}</span></div>
                <div class="o-detail"><span class="o-label">Order</span><span class="o-value">...${refund.orderId.substring(refund.orderId.length - 6)}</span></div>
                <div class="o-detail"><span class="o-label">Crop</span><span class="o-value">${refund.productName}</span></div>
                <div class="o-detail" style="grid-column: span 2;">
                    <span class="o-label">Reason</span>
                    <span class="o-value" style="font-size: 0.85rem; font-style: italic;">"${refund.reason}"</span>
                </div>
                <div class="negotiation-actions">
                    <button class="n-btn n-btn-accept" onclick="handleRefund('${id}', '${refund.orderId}', 'accepted')">
                        <i class="fa-solid fa-check"></i> Approve
                    </button>
                    <button class="n-btn n-btn-reject" onclick="handleRefund('${id}', '${refund.orderId}', 'rejected')">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                </div>
            `;
            list.appendChild(row);
        });
    });

    // 7. Health Score Listener (Accepted refunds only)
    const qHealthNeg = query(collection(db, "refund_requests"), where("farmerId", "==", farmerId), where("status", "==", "accepted"));
    onSnapshot(qHealthNeg, (snapshot) => {
        refundAcceptedCount = snapshot.size;
        updateHealthScore();
    });
});

// -- Performance Logic: Health Score --
function updateHealthScore() {
    const valueEl = document.getElementById('healthScoreValue');
    const labelEl = document.getElementById('healthScoreLabel');
    const tileEl = document.getElementById('healthScoreTile');

    if (!valueEl || !labelEl || !tileEl) return;

    // Formula: (Default 100) - (7% per refund) + (0.5% per delivered order)
    let score = 100 - (refundAcceptedCount * 7) + (deliveredCount * 0.5);
    score = Math.max(0, Math.min(100, Math.round(score)));

    valueEl.textContent = `${score}%`;

    // Tier Levels (Color & Label)
    if (score >= 90) {
        labelEl.textContent = "Excellent Service 🌟";
        tileEl.style.background = "#059669"; // Emerald-600
        tileEl.style.color = "white";
    } else if (score >= 75) {
        labelEl.textContent = "Good Service ✅";
        tileEl.style.background = "#84cc16"; // Lime-500
        tileEl.style.color = "white";
    } else if (score >= 50) {
        labelEl.textContent = "Needs Improvement ⚠️";
        tileEl.style.background = "#f59e0b"; // Amber-500
        tileEl.style.color = "black";
    } else {
        labelEl.textContent = "At Risk ❌";
        tileEl.style.background = "#ef4444"; // Red-500
        tileEl.style.color = "white";
    }
}

// -- Global Helpers for Refunds --
window.handleRefund = async (requestId, orderId, action) => {
    try {
        const confirmMsg = action === 'accepted' ? "Approve this refund? This will mark the order as REFUNDED for the buyer." : "Decline this refund request?";
        if (!confirm(confirmMsg)) return;

        // 1. Update Request Status
        await updateDoc(doc(db, "refund_requests", requestId), {
            status: action,
            updatedAt: serverTimestamp()
        });

        // 2. Update Master Order Status ONLY if accepted
        if (action === 'accepted') {
            await updateDoc(doc(db, "buyer_orders", orderId), {
                status: "refunded",
                refundedAt: serverTimestamp()
            });
        }

        console.log(`Refund ${requestId} handled with action: ${action}`);
    } catch (e) {
        console.error("Error handling refund:", e);
        alert("Failed to process refund. Please try again.");
    }
};

// -- Global Helpers for Fulfillment --
window.updateOrderStatus = async (id, newStatus) => {
    try {
        if (!confirm(`Mark this order as ${newStatus.toUpperCase()}? This will update the buyer's dashboard live.`)) return;
        
        const { updateDoc, doc, serverTimestamp } = await import("../assets/firebase-config.js");
        await updateDoc(doc(db, "buyer_orders", id), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        
        console.log(`Order ${id} updated to ${newStatus}`);
    } catch (e) {
        console.error("Error updating order status:", e);
        alert("Failed to update order status. Please try again.");
    }
};

// Update Status Global Helper
window.updateStatus = async (id, status) => {
    try {
        if (status === 'accepted') {
            // Retrieve negotiation details
            const negDoc = await getDoc(doc(db, "negotiations", id));
            if (negDoc.exists()) {
                const negData = negDoc.data();
                
                // Immediately apply discount to the buyer's active cart if the item is present
                const cartQuery = query(
                    collection(db, "buyer_cart"),
                    where("buyerId", "==", negData.buyerId),
                    where("productId", "==", negData.productId)
                );
                const cartSnapshot = await getDocs(cartQuery);
                
                if (!cartSnapshot.empty) {
                    const cartItem = cartSnapshot.docs[0];
                    await updateDoc(doc(db, "buyer_cart", cartItem.id), {
                        price: negData.offeredPrice
                    });
                }
            }
        }
        
        await updateDoc(doc(db, "negotiations", id), { status });
    } catch (e) {
        console.error("Error updating negotiation status:", e);
        alert("Failed to update status. Please try again.");
    }
};

// -- Utility Logic: Simulated Weather API --
async function fetchWeather(location) {
    const tempEl = document.getElementById('currentTemp');
    const descEl = document.getElementById('weatherDesc');
    if (!tempEl || !descEl) return;

    // Simulation delay for "realism" during demo
    setTimeout(() => {
        const city = (location || "Nashik").split(',')[0].trim();
        const mockData = {
            "Nashik": { temp: 28, desc: "Partly Cloudy • Ideal for Grape Harvest" },
            "Mumbai": { temp: 31, desc: "Sunny • High Humidity" },
            "Nagpur": { temp: 34, desc: "Hot & Clear • Water crops tonight" },
            "Pune": { temp: 26, desc: "Clear Skies • Best for leafy greens" }
        };

        const weather = mockData[city] || { temp: 30, desc: "Sunny • Great Harvest conditions" };
        tempEl.textContent = `${weather.temp}°C`;
        descEl.textContent = weather.desc;
    }, 1200);
}

// -- BI Logic: Multi-Scale Sales Analytics --
window.changeChartFilter = (filter) => {
    currentChartFilter = filter;
    
    // Update UI Toggles
    document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Refresh with current data
    console.log(`Switching chart to ${filter} view...`);
    updateSalesChart(lastOrdersData);
};

function updateSalesChart(orders) {
    const ctx = document.getElementById('salesChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = [];
    const dataPoints = {};
    const now = new Date();

    // 1. Initialize Time Buckets
    if (currentChartFilter === 'daily') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const str = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            labels.push(str);
            dataPoints[str] = 0;
        }
    } else if (currentChartFilter === 'weekly') {
        for (let i = 3; i >= 0; i--) {
            const start = new Date();
            start.setDate(now.getDate() - ((i + 1) * 7 - 1));
            const end = new Date();
            end.setDate(now.getDate() - (i * 7));
            
            const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { day: 'numeric' })}`;
            labels.push(label);
            dataPoints[label] = 0;
        }
    } else if (currentChartFilter === 'monthly') {
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(now.getMonth() - i);
            const str = d.toLocaleDateString('en-US', { month: 'short' });
            labels.push(str);
            dataPoints[str] = 0;
        }
    }

    // 2. Aggregate Revenue (Orders -> Buckets)
    orders.forEach(order => {
        const status = order.status || 'pending';
        if ((status === 'delivered' || status === 'approved') && order.createdAt) {
            const date = order.createdAt.toDate();
            let bucket = null;

            if (currentChartFilter === 'daily') {
                bucket = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (currentChartFilter === 'weekly') {
                const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                const weekIdx = Math.floor(diff / 7);
                if (weekIdx >= 0 && weekIdx <= 3) bucket = labels[3 - weekIdx];
            } else if (currentChartFilter === 'monthly') {
                bucket = date.toLocaleDateString('en-US', { month: 'short' });
            }

            if (bucket && dataPoints.hasOwnProperty(bucket)) {
                dataPoints[bucket] += parseFloat(order.totalAmount || 0);
            }
        }
    });

    const values = labels.map(l => dataPoints[l]);

    // 3. Render / Update Instance
    if (salesChart) {
        salesChart.data.labels = labels;
        salesChart.data.datasets[0].data = values;
        salesChart.update();
    } else {
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        callbacks: { label: (c) => ` Total Revenue: ₹${c.parsed.y.toLocaleString()}` }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { weight: '600' } } },
                    y: { beginAtZero: true, grid: { borderDash: [5, 5] }, ticks: { callback: (v) => '₹' + v } }
                }
            }
        });
    }
}
