import { db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// -- 1. Firestore Session Check (Replacement for Firebase Auth) --
const buyerId = localStorage.getItem('buyerId');
const buyerName = localStorage.getItem('buyerName');

let allProducts = [];

// Initialize marketplace immediately with session support
initMarketplace();

async function initMarketplace() {
    await fetchProducts();
    setupFilters();
    updateUIForBuyer();
}

// Function to handle showing/hiding login buttons based on Firestore Session
function updateUIForBuyer() {
    const loginNavBtn = document.getElementById('login-nav-btn');
    const profileArea = document.getElementById('profile-area');
    
    if (buyerId) {
        if (loginNavBtn) loginNavBtn.style.display = 'none';
        if (profileArea) profileArea.style.display = 'flex';
    } else {
        if (loginNavBtn) loginNavBtn.style.display = 'block';
        if (profileArea) profileArea.style.display = 'none';
    }
}

// -- 2. Fetch Products from Firestore --
async function fetchProducts() {
    const productGrid = document.getElementById("product-grid");
    if (!productGrid) return;

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        querySnapshot.forEach((docSnap) => {
            allProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (allProducts.length === 0) {
            productGrid.innerHTML = `
                <div class="empty-state-card" style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <p style="color: var(--text-light);">No crops available in the marketplace yet.</p>
                </div>`;
        } else {
            renderProducts(allProducts);
        }
    } catch (e) {
        console.error("Error fetching products: ", e);
    }
}

function renderProducts(products) {
    const productGrid = document.getElementById("product-grid");
    const countDisplay = document.getElementById("results-count");
    
    if (countDisplay) {
        countDisplay.innerHTML = `Showing <strong>${products.length}</strong> live results`;
    }
    
    productGrid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.onclick = () => window.location.href = `product.html?id=${p.id}`;
        
        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400'}" alt="${p.name}" class="product-image">
                ${p.isOrganic ? '<span class="badge">Organic</span>' : ''}
            </div>
            <div class="product-info" style="padding: 1.5rem;">
                <h3 class="product-name" style="font-weight: 800; font-size: 1.25rem;">${p.name}</h3>
                <div class="farmer-info" style="padding: 0.5rem 0; color: #718096; font-size: 0.9rem;">
                    📍 ${p.location || 'Maharashtra'} • 🧑‍🌾 ${p.farmerName || 'Farmer'}
                </div>
                <div class="price-tag" style="margin-top: 0.5rem; font-weight: 900; color: #2fb362; font-size: 1.4rem;">₹${p.price} <span style="font-size: 0.9rem; color: #a0aec0;">/ ${p.unit || 'kg'}</span></div>
                <button class="add-to-cart" style="width: 100%; margin-top: 1.5rem; background: #eafaf1; color: #2fb362; border: none; padding: 0.8rem; border-radius: 12px; font-weight: 700; cursor: pointer;" onclick="event.stopPropagation(); window.startNegotiation('${p.id}', '${p.farmerId}', '${p.name}')">
                    🤝 Negotiate Price
                </button>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

// -- 3. Search & Filter Logic --
function setupFilters() {
    const searchInput = document.getElementById("product-search");
    const categoryFilter = document.getElementById("category-filter");

    const filterProducts = () => {
        const searchTerm = (searchInput?.value || "").toLowerCase();
        const categoryTerm = categoryFilter?.value || "all";

        const filtered = allProducts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm);
            const matchesCategory = categoryTerm === "all" || p.category.toLowerCase() === categoryTerm;
            return matchesSearch && matchesCategory;
        });
        renderProducts(filtered);
    };

    if (searchInput) searchInput.addEventListener("input", filterProducts);
    if (categoryFilter) categoryFilter.addEventListener("change", filterProducts);
}

// -- 4. Start Negotiation --
window.startNegotiation = async (productId, farmerId, productName) => {
    if (!buyerId) return alert("Please log in as a Buyer first.");

    try {
        // Query shared collection "negotiations"
        const newNeg = await addDoc(collection(db, "negotiations"), {
            buyerId: buyerId,
            buyerName: buyerName,
            farmerId: farmerId || "mock-farmer-id",
            productId: productId,
            productName: productName,
            status: "active",
            createdAt: serverTimestamp()
        });

        alert("Negotiation request sent to the farmer!");
        window.location.href = "index.html";
    } catch (e) {
        console.error("Error starting negotiation: ", e);
        alert("Failed to start negotiation. Please try again.");
    }
};
