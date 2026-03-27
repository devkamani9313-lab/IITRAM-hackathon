import { db } from "./firebase-config.js";
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    updateDoc,
    doc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// -- 1. Global Session & Logout Handlers --
const buyerId = localStorage.getItem('buyerId');
const buyerName = localStorage.getItem('buyerName');

window.logoutBuyer = () => {
    if (confirm("Log out of FarmConnect?")) {
        localStorage.removeItem('buyerId');
        localStorage.removeItem('buyerName');
        window.location.href = "login.html";
    }
};

// Global listener for the logout button (fixes the marketplace logout issue)
document.addEventListener('click', (e) => {
    if (e.target.id === 'logout-btn' || e.target.closest('#logout-btn')) {
        e.preventDefault();
        window.logoutBuyer();
    }
});

let allProducts = [];

// Initialize marketplace immediately with session support
initMarketplace();

function initMarketplace() {
    setupFilters();
    updateUIForBuyer();
    listenToProducts();
    listenToCart();
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

// -- 2. Listen to Real-Time Products from Firestore --
function listenToProducts() {
    const productGrid = document.getElementById("product-grid");
    if (!productGrid) return;
    
    onSnapshot(collection(db, "products"), (snapshot) => {
        allProducts = [];
        snapshot.forEach((docSnap) => {
            allProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (allProducts.length === 0) {
            productGrid.innerHTML = `
                <div class="empty-state-card" style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <p style="color: var(--text-light);">No crops available in the marketplace yet. Farmers are growing more!</p>
                </div>`;
            document.getElementById("results-count").innerHTML = `Showing <strong>0</strong> live results`;
        } else {
            applyCurrentFilters();
        }
    }, (error) => {
        console.error("Error listening to products: ", error);
        productGrid.innerHTML = `<p style="color:red;">Error loading products.</p>`;
    });
}

function applyCurrentFilters() {
    const searchInput = document.getElementById("product-search");
    const categoryFilter = document.getElementById("category-filter");
    
    const searchTerm = (searchInput?.value || "").toLowerCase();
    const categoryTerm = categoryFilter?.value || "all";

    const filtered = allProducts.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchTerm) || false;
        const matchesCategory = categoryTerm === "all" || p.category?.toLowerCase() === categoryTerm;
        return matchesSearch && matchesCategory;
    });
    
    renderProducts(filtered);
}

// Helper for dynamic images if the farmer didn't specify a unique one
function getCropImage(name, currentUrl) {
    const tomatoUrl = "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400";
    const potatoUrl = "https://images.unsplash.com/photo-1518977676601-b53f02bad675?auto=format&fit=crop&q=80&w=400";
    
    // Robustness Check: If we have NO url or it's the old generic tomato, heal it.
    if (!currentUrl || currentUrl === tomatoUrl || currentUrl === "" || currentUrl === "undefined") {
        const crop = (name || "").toLowerCase();
        const images = {
            mango: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400",
            potato: potatoUrl,
            tomato: tomatoUrl,
            chilli: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=400",
            onion: "https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=400",
            wheat: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d0200?auto=format&fit=crop&q=80&w=400",
            rice: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400"
        };

        for (let key in images) {
            if (crop.includes(key)) return images[key];
        }
        return "https://placehold.co/400x300/eafaf1/2fb362?text=Image+Not+Available";
    }

    return currentUrl;
}

function renderProducts(products) {
    const productGrid = document.getElementById("product-grid");
    const countDisplay = document.getElementById("results-count");
    
    if (countDisplay) {
        countDisplay.innerHTML = `Showing <strong>${products.length}</strong> live results`;
    }
    
    productGrid.innerHTML = "";

    const noImagePlaceholder = "https://placehold.co/400x300/eafaf1/2fb362?text=Image+Not+Available";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card";
        
        const safeName = p.name || 'Produce';
        const safeFarmer = p.farmerName || 'Farmer';
        const rawImg = getCropImage(safeName, p.imageUrl);
        const safeLocation = p.location || 'Maharashtra';
        const safeUnit = p.unit || 'kg';
        const safePrice = Number(p.price) || 0;
        
        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${rawImg}" 
                     alt="${safeName.replace(/"/g, '&quot;')}" 
                     class="product-image"
                     onerror="this.src='${noImagePlaceholder}'">
                ${p.isOrganic ? '<span class="badge">Organic</span>' : ''}
            </div>
            <div class="product-info" style="padding: 1.5rem;">
                <h3 class="product-name" style="font-weight: 800; font-size: 1.25rem;">${safeName}</h3>
                <div class="farmer-info" style="padding: 0.5rem 0; color: #718096; font-size: 0.9rem;">
                    📍 ${safeLocation} • 🧑‍🌾 ${safeFarmer}
                </div>
                <div class="price-tag" style="margin-top: 0.5rem; font-weight: 900; color: #2fb362; font-size: 1.4rem;">₹${safePrice} <span style="font-size: 0.9rem; color: #a0aec0;">/ ${safeUnit}</span></div>
                
                <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
                    <button class="add-to-cart btn-negotiate" style="flex: 1; background: #eafaf1; color: #2fb362; border: none; padding: 0.8rem; border-radius: 12px; font-weight: 700; cursor: pointer;">
                        🤝 Negotiate
                    </button>
                    <button class="add-to-cart btn-add" style="flex: 1; background: var(--primary-color); color: white; border: none; padding: 0.8rem; border-radius: 12px; font-weight: 700; cursor: pointer;">
                        🛒 Add
                    </button>
                </div>
            </div>
        `;

        // Safe DOM Event Attachments
        card.addEventListener('click', () => { window.location.href = `product.html?id=${p.id}`; });

        const btnNegotiate = card.querySelector('.btn-negotiate');
        btnNegotiate.addEventListener('click', (e) => {
            e.stopPropagation();
            window.startNegotiation(p.id, p.farmerId, safeName);
        });

        const btnAdd = card.querySelector('.btn-add');
        btnAdd.addEventListener('click', (e) => {
            e.stopPropagation();
            window.addToCart(p.id, safeName, p.farmerId, safeFarmer, safePrice, rawImg, safeUnit);
        });

        productGrid.appendChild(card);
    });
}

// -- 3. Search & Filter Logic --
function setupFilters() {
    const searchInput = document.getElementById("product-search");
    const categoryFilter = document.getElementById("category-filter");

    if (searchInput) searchInput.addEventListener("input", applyCurrentFilters);
    if (categoryFilter) categoryFilter.addEventListener("change", applyCurrentFilters);
}

// -- 4. Cart Features --
window.addToCart = async (productId, productName, farmerId, farmerName, price, imageUrl, unit) => {
    if (!buyerId) return alert("Please log in as a Buyer first.");

    let finalPrice = Number(price);

    try {
        // Check if there is an accepted negotiation for this product
        const negQ = query(
            collection(db, "negotiations"), 
            where("buyerId", "==", buyerId), 
            where("productId", "==", productId),
            where("status", "==", "accepted")
        );
        const negSnap = await getDocs(negQ);
        if (!negSnap.empty) {
            finalPrice = Number(negSnap.docs[0].data().offeredPrice);
            console.log("Using negotiated price: ", finalPrice);
        }

        // Quick check if item already in cart
        const q = query(collection(db, "buyer_cart"), where("buyerId", "==", buyerId), where("productId", "==", productId));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            // Document exists, update quantity AND price (in case negotiation was accepted after adding)
            const item = snap.docs[0];
            await updateDoc(doc(db, "buyer_cart", item.id), {
                qty: item.data().qty + 1,
                price: finalPrice // Update price to latest (either original or negotiated)
            });
        } else {
            // Create new cart item
            await addDoc(collection(db, "buyer_cart"), {
                buyerId,
                productId,
                productName,
                farmerId,
                farmerName,
                price: finalPrice,
                imageUrl,
                unit,
                qty: 1,
                addedAt: serverTimestamp()
            });
        }
        alert("Added to Cart!");
    } catch (e) {
        console.error("Error adding to cart: ", e);
        alert("Failed to add to cart.");
    }
};

function listenToCart() {
    if (!buyerId) {
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(b => b.textContent = "0");
        return;
    }
    
    const q = query(collection(db, "buyer_cart"), where("buyerId", "==", buyerId));
    onSnapshot(q, (snapshot) => {
        let totalQty = 0;
        snapshot.forEach(d => { totalQty += d.data().qty; });
        
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(b => b.textContent = totalQty);
    });
}

// -- 5. Start Negotiation --
window.startNegotiation = async (productId, farmerId, productName) => {
    if (!buyerId) return alert("Please log in as a Buyer first.");

    try {
        await addDoc(collection(db, "negotiations"), {
            buyerId: buyerId,
            buyerName: buyerName,
            farmerId: farmerId || "mock-farmer-id",
            productId: productId,
            productName: productName,
            status: "active",
            createdAt: serverTimestamp()
        });

        alert("Negotiation request sent to the farmer!");
        window.location.href = "index.html"; // Just reload or go to neg dashboard
    } catch (e) {
        console.error("Error starting negotiation: ", e);
        alert("Failed to start negotiation. Please try again.");
    }
};
