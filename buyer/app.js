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
    productGrid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80'}')">
                <span class="category-badge">${p.category || 'Produce'}</span>
            </div>
            <div class="product-info">
                <h3>${p.name}</h3>
                <p class="farmer-location">📍 ${p.location || 'Maharashtra'}</p>
                <div class="price-unit">₹${p.price} <span>/ ${p.unit || 'kg'}</span></div>
                <p class="min-order">Min Order: ${p.minOrder || '50kg'}</p>
                <button class="btn btn-primary start-neg-btn" onclick="startNegotiation('${p.id}', '${p.farmerId}', '${p.name}', '${p.farmerName}')">Negotiate Price</button>
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
