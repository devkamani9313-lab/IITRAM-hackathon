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

function updateUI(p) {
    const mainImg = document.querySelector('.main-image');
    if (mainImg) mainImg.src = p.imageUrl || mainImg.src;

    document.querySelector('.product-title').innerText = p.name;
    document.querySelector('.product-category').innerText = `${p.category || 'Fresh Harvest'} • Fresh Harvest`;
    
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

    const btn = document.querySelector('.btn-buy');
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
