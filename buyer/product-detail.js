import { db } from "./firebase-config.js";
import { 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    updateDoc,
    serverTimestamp,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const buyerId = localStorage.getItem('buyerId');
const buyerName = localStorage.getItem('buyerName');
let currentProduct = null;

// Global Image Fallbacks
const categoryFallbacks = {
    fruits: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&q=80&w=400", // Combined Fruit Spread
    vegetables: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&w=400", // Combined Vegetable Assortment
    grains: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400", // Combined Grains in Bowls
    cereals: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400"
};

async function loadProductDetails() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) return console.error("No product ID found.");

    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentProduct = { id: docSnap.id, ...docSnap.data() };
            updateUI(currentProduct);
        }
    } catch (e) {
        console.error("Error fetching product details:", e);
    }
}

// Helper for dynamic images if the farmer didn't specify a unique one
function getCropImage(name, currentUrl, category) {
    const crop = (name || "").toLowerCase();
    const cat = (category || "").toLowerCase();

    const images = {
        mango: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400",
        potato: "https://images.unsplash.com/photo-1518977676601-b53f02bad675?auto=format&fit=crop&q=80&w=400",
        tomato: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400",
        "green chilli": "https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?auto=format&fit=crop&q=80&w=400",
        chilli: "https://images.unsplash.com/photo-1601648764658-cf37e8c89b70?auto=format&fit=crop&q=80&w=400",
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

function updateUI(p) {
    const mainImg = document.querySelector('.main-image');
    if (mainImg) {
        mainImg.src = getCropImage(p.name, p.imageUrl, p.category);
        mainImg.onerror = () => { 
            const cat = (p.category || "").toLowerCase();
            mainImg.src = categoryFallbacks[cat] || categoryFallbacks.vegetables;
            mainImg.onerror = null;
        };
    }

    document.querySelector('.product-title').innerText = p.name;
    document.querySelector('.product-category').innerText = `${p.category || 'Fresh Harvest'} • Fresh Harvest`;
    
    // Dynamic Description Generator
    const descMap = {
        mango: "Sweet and succulent premium mangoes, hand-picked at peak ripeness for the perfect flavor profile.",
        tomato: "Firm, vine-ripened organic tomatoes with a robust flavor, ideal for both retail and processing.",
        potato: "High-grade farm potatoes, sorted for size and quality, perfect for long-term storage or immediate distribution.",
        wheat: "Premium golden wheat grains, cleaned and tested for quality, ready for wholesale and export standards.",
        rice: "Selected long-grain rice, aged naturally for superior texture and aroma, sourced from verified local farms.",
        chilli: "Fresh, pungent peppers with deep color and high spiciness, ideal for traditional culinary uses or spice milling.",
    };

    const description = descMap[(p.name || '').toLowerCase()] || `Premium quality ${p.name || 'produce'} sourced directly from verified farms. Consistent supply and wholesale-grade packaging ensured for business partners.`;
    const descEl = document.getElementById('product-description');
    if (descEl) descEl.innerText = description;
    
    const priceDisplay = document.getElementById('display-price-meta');
    if (priceDisplay) priceDisplay.innerText = `₹${p.price} / ${p.unit || 'kg'}`;
    
    const tiers = document.querySelectorAll('.tier-price');
    if (tiers.length >= 3) {
        tiers[0].innerText = `₹${p.price.toFixed(2)}`;
        tiers[1].innerText = `₹${(p.price * 0.9).toFixed(2)}`;
        tiers[2].innerText = `₹${(p.price * 0.78).toFixed(2)}`;
    }

    const farmerNameDiv = document.querySelector('div[style*="font-weight:700"]');
    if (farmerNameDiv) farmerNameDiv.innerText = p.farmerName || 'Farmer Singh';

    const modalInitialText = document.querySelector('#modalInitial p');
    if (modalInitialText) {
        modalInitialText.innerText = `The current price is ₹${p.price}/kg. What is your offer?`;
    }
}

// Global function for the "Send Request" button in the modal
window.sendNegotiationRequest = async () => {
    if (!buyerId) return alert("Please log in to make an offer.");
    if (!currentProduct) return;

    const offeredPrice = document.getElementById('offeredPrice').value;
    if (!offeredPrice || offeredPrice <= 0) return alert("Please enter a valid price.");

    try {
        // Transition UI (Local success state first)
        document.getElementById('modalInitial').style.display = 'none';
        document.getElementById('modalSuccess').style.display = 'block';

        // Check if negotiation already exists
        const q = query(
            collection(db, "negotiations"),
            where("buyerId", "==", buyerId),
            where("productId", "==", currentProduct.id)
        );
        const existing = await getDocs(q);

        if (existing.empty) {
            // Create new negotiation
            const newNeg = await addDoc(collection(db, "negotiations"), {
                buyerId: buyerId,
                buyerName: buyerName || "Wholesale Buyer",
                farmerId: currentProduct.farmerId || "unknown",
                farmerName: currentProduct.farmerName || "Farmer",
                productId: currentProduct.id,
                productName: currentProduct.name,
                status: "active",
                offeredPrice: parseFloat(offeredPrice),
                lastMessage: `New offer: ₹${offeredPrice}`,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });

            await addDoc(collection(db, "negotiations", newNeg.id, "messages"), {
                senderId: buyerId,
                content: `My offer is ₹${offeredPrice} for this crop.`,
                type: "negotiation",
                timestamp: serverTimestamp()
            });
        } else {
            // Update existing negotiation
            const existingDoc = existing.docs[0];
            await updateDoc(doc(db, "negotiations", existingDoc.id), {
                status: "active",
                offeredPrice: parseFloat(offeredPrice),
                lastMessage: `Updated offer: ₹${offeredPrice}`,
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, "negotiations", existingDoc.id, "messages"), {
                senderId: buyerId,
                content: `I've updated my offer to ₹${offeredPrice}.`,
                type: "negotiation",
                timestamp: serverTimestamp()
            });
        }
    } catch (e) {
        console.error("Error saving negotiation:", e);
    }
};

// Global function for the "Add to Cart" button on the Details page
window.addToCartFromPage = async () => {
    if (!buyerId) return alert("Please log in as a Buyer first.");
    if (!currentProduct) return;

    const btn = document.querySelector('.btn-add-cart-main');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    btn.disabled = true;

    try {
        let finalPrice = Number(currentProduct.price);
        
        // Priority: Check if there's an accepted negotiation price for this buyer/product
        const negQ = query(
            collection(db, "negotiations"), 
            where("buyerId", "==", buyerId), 
            where("productId", "==", currentProduct.id),
            where("status", "==", "accepted")
        );
        const negSnap = await getDocs(negQ);
        if (!negSnap.empty) {
            finalPrice = Number(negSnap.docs[0].data().offeredPrice);
            console.log("Using negotiated price for cart:", finalPrice);
        }

        const q = query(collection(db, "buyer_cart"), where("buyerId", "==", buyerId), where("productId", "==", currentProduct.id));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            // Document exists, update quantity AND refresh price
            const itemDoc = snap.docs[0];
            const oldQty = itemDoc.data().qty;
            
            await updateDoc(doc(db, "buyer_cart", itemDoc.id), {
                qty: oldQty + 1,
                price: finalPrice, // Refresh price
                updatedAt: serverTimestamp()
            });
        } else {
            // Add new cart item with finalPrice
            await addDoc(collection(db, "buyer_cart"), {
                buyerId: buyerId,
                productId: currentProduct.id,
                productName: currentProduct.name,
                farmerId: currentProduct.farmerId || "unknown",
                farmerName: currentProduct.farmerName || "Farmer",
                price: finalPrice,
                qty: 1,
                unit: currentProduct.unit || 'kg',
                location: currentProduct.location || 'Maharashtra',
                imageUrl: currentProduct.imageUrl || "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400",
                addedAt: serverTimestamp()
            });
        }
        
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
        setTimeout(() => window.location.href = "checkout.html", 600);
    } catch (e) {
        console.error("Error adding to cart:", e);
        alert("Failed to add to cart.");
        btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Add to Cart';
        btn.disabled = false;
    }
};

window.addEventListener('DOMContentLoaded', loadProductDetails);
