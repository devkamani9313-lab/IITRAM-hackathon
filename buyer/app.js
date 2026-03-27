import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    serverTimestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let allProducts = [];

// -- 1. Authentication Guard (Bypassed) --
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initMarketplace();
    } else {
        console.log("No user found. Running in UI Preview Mode.");
        // Still initializing to allow the UI to show with sample data
        initMarketplace();
    }
});

async function initMarketplace() {
    await fetchProducts();
    setupFilters();
}

// -- 2. Fetch Products from Firestore --
async function fetchProducts() {
    const productGrid = document.getElementById("product-grid");
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        querySnapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });

        // If no products exist yet (new setup), show a message or mock data could be added here
        if (allProducts.length === 0) {
            console.log("No products in Firestore. Using sample data for demonstration.");
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
        card.style.cursor = "pointer";
        card.onclick = () => window.location.href = `product.html?id=${p.id}`;
        
        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400'}" alt="${p.name}" class="product-image">
                ${p.isOrganic ? '<span class="badge">Organic</span>' : (p.isWholesale ? '<span class="badge" style="color: #2b6cb0;">Wholesale</span>' : '')}
            </div>
            <div class="product-info">
                <h3 class="product-name">${p.name}</h3>
                <div class="farmer-info">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${p.farmerName || 'Farmer'} • ${p.location || 'Maharashtra'}</span>
                </div>
                <div class="price-tag">₹${p.price} <span>/ ${p.unit || 'kg'}</span></div>
                <button class="add-to-cart" onclick="event.stopPropagation();">
                    <i class="fa-solid fa-plus"></i> Add to Cart
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
        const searchTerm = searchInput.value.toLowerCase();
        const categoryTerm = categoryFilter.value;

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
window.startNegotiation = async (productId, farmerId, productName, farmerName) => {
    if (!currentUser) return alert("Please log in to start a negotiation.");

    try {
        // Check if negotiation already exists
        const q = query(
            collection(db, "negotiations"),
            where("buyerId", "==", currentUser.uid),
            where("productId", "==", productId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
            window.location.href = "negotiations.html";
            return;
        }

        // Create new negotiation
        const newNeg = await addDoc(collection(db, "negotiations"), {
            buyerId: currentUser.uid,
            farmerId: farmerId || "mock-farmer-id",
            farmerName: farmerName || "Farmer Ramesh",
            productId: productId,
            productName: productName,
            status: "active",
            lastMessage: "Negotiation started",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        // Add initial message
        await addDoc(collection(db, "negotiations", newNeg.id, "messages"), {
            senderId: currentUser.uid,
            content: `I'm interested in ${productName}. Can we discuss the price?`,
            type: "text",
            timestamp: serverTimestamp()
        });

        window.location.href = "negotiations.html";
    } catch (e) {
        console.error("Error starting negotiation: ", e);
        alert("Failed to start negotiation. Please try again.");
    }
};

// Logout logic
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.onclick = () => {
        signOut(auth).then(() => {
            window.location.href = "login.html";
        });
    };
}
