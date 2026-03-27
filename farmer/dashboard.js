// Farmer Dashboard: Integrated Firebase Cloud Interaction
import { db, collection, addDoc, getDocs, getDoc, query, where, onSnapshot, updateDoc, doc, serverTimestamp, deleteDoc } from "../assets/firebase-config.js";

// Bulletproof Global Handlers
window.openFarmerModal = () => {
    const modal = document.getElementById('modalOverlay');
    if (modal) {
        modal.classList.add('active');
        const form = document.getElementById('addProduceForm');
        if (form) form.reset();
    }
};

window.confirmFarmerLogout = () => {
    if (confirm("Log out of FarmConnect?")) {
        localStorage.clear();
        window.location.href = "../index.html"; // Redirect to Role Select
    }
};

// -- Edit and Delete Global Helpers --
window.deleteCrop = async (id, name) => {
    if (confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "products", id));
        } catch (e) {
            console.error("Error deleting crop", e);
            alert("Failed to delete the crop. Please try again.");
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

// Helper to get relevant Unsplash images based on crop name
function getCropImage(name) {
    const crop = (name || "").toLowerCase();
    const images = {
        mango: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400",
        potato: "https://images.unsplash.com/photo-1518977676601-b53f02bad675?auto=format&fit=crop&q=80&w=400",
        tomato: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400",
        chilli: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=400",
        onion: "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=400",
        wheat: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=400",
        rice: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400",
        banana: "https://images.unsplash.com/photo-1571771894821-ad9b58a33646?auto=format&fit=crop&q=80&w=400",
        apple: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400"
    };

    for (let key in images) {
        if (crop.includes(key)) return images[key];
    }
    // Fallback to a general organic farm image
    return "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&q=80&w=400";
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
                    imageUrl: getCropImage(cropName),
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
                <div class="p-icon">🌿</div>
                <h3 class="p-name">${item.name}</h3>
                <p class="p-meta">${item.qty} ${item.unit} Available</p>
                <div class="p-price">₹${item.price} / ${item.unit}</div>
                <div class="p-actions">
                    <button class="p-btn p-btn-edit" onclick="openEditModal('${id}', '${escName}', '${item.qty}', '${item.price}')">Edit</button>
                    <button class="p-btn p-btn-del" onclick="deleteCrop('${id}', '${escName}')">Delete</button>
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
            row.className = 'order-row-item';
            row.innerHTML = `
                <div class="o-detail"><span class="o-label">Buyer</span><span class="o-value">${neg.buyerName || 'Client'}</span></div>
                <div class="o-detail"><span class="o-label">Crop</span><span class="o-value">${neg.productName}</span></div>
                <div class="o-detail"><span class="o-label">Offered Price</span><span class="o-value" style="color: #2fb362; font-weight: 800;">₹${neg.offeredPrice || 0}</span></div>
                <div class="negotiation-actions">
                    <button class="n-btn n-btn-accept" onclick="updateStatus('${docSnap.id}', 'accepted')">Accept</button>
                    <button class="n-btn n-btn-reject" onclick="updateStatus('${docSnap.id}', 'rejected')">Reject</button>
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
            return;
        }

        list.innerHTML = '';
        let totalCount = 0;
        
        snapshot.forEach((docSnap) => {
            const order = docSnap.data();
            totalCount++;
            
            const row = document.createElement('div');
            row.className = 'order-row-item';
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1.5fr 1fr 2fr 1fr 1fr';
            row.style.alignItems = 'center';
            row.style.padding = '1rem 1.5rem';
            row.style.gap = '1rem';
            
            const dateStr = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString() : 'Just now';
            
            row.innerHTML = `
                <div class="o-detail"><span class="o-label">Buyer</span><span class="o-value">${order.buyerName || 'Client'}</span></div>
                <div class="o-detail"><span class="o-label">Date</span><span class="o-value">${dateStr}</span></div>
                <div class="o-detail"><span class="o-label">Items</span><span class="o-value" style="font-weight:600;">${order.productName}</span></div>
                <div class="o-detail"><span class="o-label">Amount</span><span class="o-value" style="color: #2fb362; font-weight: 800; font-size:1.1rem;">₹${order.totalAmount}</span></div>
                <div class="o-detail" style="text-align: right;">
                    <span style="background:#eafaf1; color:#2fb362; padding: 6px 16px; border-radius: 50px; font-size: 0.8rem; font-weight: 700; border: 1px solid #c8e6c9;">Paid ✅</span>
                </div>
            `;
            list.appendChild(row);
        });

        if (activeOrdersCount) activeOrdersCount.textContent = totalCount;
    });
});

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
