// --- FIREBASE CONFIGURATION ---
// User provided credentials on 2025-12-24

const firebaseConfig = {
    apiKey: "AIzaSyDwPhWfw0GcpzLZjeu5k88zMAT9-8fJH7s",
    authDomain: "student-pickup-9ac78.firebaseapp.com",
    projectId: "student-pickup-9ac78",
    storageBucket: "student-pickup-9ac78.firebasestorage.app",
    messagingSenderId: "972019406700",
    appId: "1:972019406700:web:4a7a1c1e1dc4fa72c24549",
    measurementId: "G-20FRZCCPX0"
};

// Initialize Firebase
// Ensure this script is loaded AFTER the Firebase SDKs in your HTML
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);

    // Initialize Services
    window.db = firebase.firestore();
    window.auth = firebase.auth();

    // Conditionally init storage (only if SDK is present)
    if (firebase.storage) {
        window.storage = firebase.storage();
    }

    // Optional: Analytics
    if (firebase.analytics) {
        firebase.analytics();
    }

    // Enable Offline Persistence (Better User Experience)
    window.db.enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firebase Persistence: Multiple tabs open, persistence disabled');
            } else if (err.code == 'unimplemented') {
                console.warn('Firebase Persistence: Browser not supported');
            }
        });

    console.log("Firebase Initialized");
} else {
    console.error("Firebase SDK not found. Make sure to include the scripts in your HTML head.");
}

// --- GLOBAL UTILS ---

/**
 * Applies dynamic school branding to the page
 * @param {Object} schoolData - The school document data containing 'branding' field
 */
window.applyBranding = function (schoolData) {
    if (!schoolData || !schoolData.branding) return;

    const b = schoolData.branding;
    const root = document.documentElement.style;

    console.log("Applying branding:", b);

    // 1. Apply Colors
    if (b.primaryColor) {
        root.setProperty('--primary', b.primaryColor);
        root.setProperty('--teal', b.primaryColor); // Override base

        // Create a lighter variant for gradients (simple HEX adjustment)
        const light = lightenHex(b.primaryColor, 40);
        root.setProperty('--primary-light', light);
        root.setProperty('--teal-light', light);
    }

    if (b.secondaryColor) {
        root.setProperty('--secondary', b.secondaryColor);
        root.setProperty('--coral', b.secondaryColor); // Override base
    }

    if (b.accentColor) {
        root.setProperty('--accent', b.accentColor);
        root.setProperty('--sand', b.accentColor); // Override base
    }

    // 2. Apply Logo
    if (b.logoUrl) {
        // Update all standard logo images
        const logoSelectors = [
            '.logo img',
            'img.logo',
            '#schoolLogo',
            '.brand-logo'
        ];

        logoSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(img => {
                img.src = b.logoUrl;
                img.style.display = 'block'; // Ensure visibility
            });
        });

        // Also handle "text-only" logos by replacing them or adding the image if container exists
        const logoTextContainers = document.querySelectorAll('.logo');
        logoTextContainers.forEach(container => {
            // If it contains text but no image, maybe Prepend?
            // This is risky if generic, but useful for 'SurePickup' text replacement logic
            // For now, only replace specific IDs or strictly empty ones?
            // Safest: Use specific ID in pages.
            if (container.id === 'navbarLogoContainer') {
                container.innerHTML = `<img src="${b.logoUrl}" alt="School Logo" style="height:40px;">`;
            }
        });
    }
};

// Helper: Lighten Hex Color
function lightenHex(hex, amount) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

    const num = parseInt(hex, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}
