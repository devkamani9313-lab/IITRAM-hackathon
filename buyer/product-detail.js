import { auth, db } from "./firebase-config.js";
import { 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let currentProduct = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

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
    if (!currentUser) return alert("Please log in to make an offer.");
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
            where("buyerId", "==", currentUser.uid),
            where("productId", "==", currentProduct.id)
        );
        const existing = await getDocs(q);

        if (existing.empty) {
            // Create new negotiation
            const newNeg = await addDoc(collection(db, "negotiations"), {
                buyerId: currentUser.uid,
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
                senderId: currentUser.uid,
                content: `My offer is ₹${offeredPrice} for this crop.`,
                type: "negotiation",
                timestamp: serverTimestamp()
            });
        }
    } catch (e) {
        console.error("Error saving negotiation:", e);
    }
};

window.addEventListener('DOMContentLoaded', loadProductDetails);
