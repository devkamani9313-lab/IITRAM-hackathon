// Farmer Dashboard: Integrated Firebase Cloud Interaction
import { db, collection, addDoc, getDocs, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from "../assets/firebase-config.js";

// Bulletproof Global Handlers
window.openFarmerModal = () => {
    const modal = document.getElementById('modalOverlay');
    if (modal) {
        modal.classList.add('active');
        const form = document.getElementById('addProduceForm');
        if (form) form.reset();
        const title = modal.querySelector('h2');
        if (title) title.textContent = "List Fresh Produce";
    }
};

window.confirmFarmerLogout = () => {
    if (confirm("Log out of FarmConnect?")) {
        localStorage.clear();
        window.location.href = "../index.html"; // Redirect to Role Select
    }
};

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
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";

            try {
                await addDoc(collection(db, "products"), {
                    name: document.getElementById('prodName').value,
                    qty: document.getElementById('prodQty').value,
                    unit: document.getElementById('prodUnit').value,
                    category: document.getElementById('prodCategory')?.value || "vegetables",
                    price: Number(document.getElementById('prodPrice').value),
                    farmerId,
                    farmerName: farmName,
                    location: farmerLoc,
                    imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400",
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

    // 3. Real-Time Product List
    const produceGrid = document.getElementById('produceGrid');
    const qProducts = query(collection(db, "products"), where("farmerId", "==", farmerId));
    onSnapshot(qProducts, (snapshot) => {
        if (!produceGrid) return;
        produceGrid.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const card = document.createElement('div');
            card.className = 'premium-card-item';
            card.innerHTML = `
                <div class="p-icon">🌿</div>
                <h3 class="p-name">${item.name}</h3>
                <p class="p-meta">${item.qty} ${item.unit} Available</p>
                <div class="p-price">₹${item.price} / ${item.unit}</div>
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
                <div class="negotiation-actions">
                    <button class="n-btn n-btn-accept" onclick="updateStatus('${docSnap.id}', 'accepted')">Accept</button>
                    <button class="n-btn n-btn-reject" onclick="updateStatus('${docSnap.id}', 'rejected')">Reject</button>
                </div>
            `;
            list.appendChild(row);
        });
    });
});

// Update Status Global Helper
window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, "negotiations", id), { status });
};
