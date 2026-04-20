// Product Data State (Fetched from API)
let products = [];
// Cart State
let cart = JSON.parse(localStorage.getItem('btmusicdrive_cart') || '[]');

// ── Utility: HTML escape to prevent XSS ──────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str ?? '')));
    return div.innerHTML;
}

// DOM Elements
// NOTE: cart/navbar/auth-modal DOM is injected by components.js on DOMContentLoaded,
// so refs must be resolved lazily (not cached at script load).
const productsContainer = document.getElementById('products-container');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const navbar = document.getElementById('navbar');

// Auth DOM Elements
const authBtn = document.getElementById('auth-btn');
const authModal = document.getElementById('auth-modal');
const authModalContent = document.getElementById('auth-modal-content');
const closeAuthBtn = document.getElementById('close-auth-btn');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSubmitText = document.getElementById('auth-submit-text');
const authSpinner = document.getElementById('auth-spinner');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authTitle = document.getElementById('auth-title');
const authError = document.getElementById('auth-error');
const authErrorText = document.getElementById('auth-error-text');
const userGreeting = document.getElementById('user-greeting');

// Auth State
let isLoginMode = true;
let currentUser = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Nav menus are loaded by components.js (_loadNavMenus) — no duplicate fetch.
    // Don't await fetchProducts; let it run async alongside other init.
    fetchProducts();
    setupEventListeners();
    if (typeof _updateCartUI === 'function') _updateCartUI();
});

// ── Password Toggle ────────────────────────────────────────────────────────
function togglePasswordVisibility() {
    const pw = document.getElementById('auth-password');
    const icon = document.getElementById('pw-eye-icon');
    if (pw.type === 'password') {
        pw.type = 'text';
        icon.classList.remove('ph-eye');
        icon.classList.add('ph-eye-slash');
    } else {
        pw.type = 'password';
        icon.classList.remove('ph-eye-slash');
        icon.classList.add('ph-eye');
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// Nav menus: handled entirely by components.js (_loadNavMenus).

// Fetch Products from API or fallback to local JSON
async function fetchProducts() {
    if (productsContainer) {
        productsContainer.innerHTML = '<div class="col-span-full text-center py-10"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p class="mt-4 text-gray-500">Loading products...</p></div>';
    }
    try {
        let response;
        try {
            // First try to fetch from API
            response = await fetch(`${API_BASE}/products`);
            if (!response.ok) throw new Error('API failed');
        } catch (apiError) {
            // Fallback to local products.json if DB is down
            console.log('Database fetch failed, falling back to local JSON', apiError);
            response = await fetch('products.json');
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        
        const json = await response.json();
        products = Array.isArray(json) ? json : (json.data || []);
        if (productsContainer) renderProducts();
    } catch (error) {
        console.error('Error:', error);
        if (productsContainer) productsContainer.innerHTML = '<div class="col-span-full text-center py-10 text-red-500"><i class="ph ph-warning-circle text-4xl mb-2"></i><p>Failed to load products. Please check if the server is running.</p></div>';
    }
}

// Render Products
function renderProducts() {
    if (!productsContainer) return;
    productsContainer.innerHTML = '';
    
    products.forEach((product, index) => {
        // Create product card
        const productCard = document.createElement('div');
        productCard.className = `bg-white rounded-2xl overflow-hidden product-card border border-gray-100 animate-fade-in-up shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:shadow-[0_12px_36px_rgba(139,115,85,0.18)]`;
        productCard.style.animationDelay = `${index * 0.1}s`;
        
        // Generate stars HTML
        const rating = product.rating || 0;
        const reviews = product.reviews || 0;
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(rating)) {
                starsHtml += `<i class="ph-fill ph-star text-yellow-400 text-sm"></i>`;
            } else if (i === Math.ceil(rating) && !Number.isInteger(rating)) {
                starsHtml += `<i class="ph-fill ph-star-half text-yellow-400 text-sm"></i>`;
            } else {
                starsHtml += `<i class="ph ph-star text-gray-300 text-sm"></i>`;
            }
        }

        // Discount badge (หรือ custom badge ถ้าไม่มี originalPrice)
        const hasDiscount = product.originalPrice && product.originalPrice > product.price;
        const discPct = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
        const badgeHtml = hasDiscount
            ? `<span class="absolute top-2 left-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-sm">-${discPct}%</span>`
            : (product.badge ? `<span class="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-gray-900 shadow-sm">${product.badge}</span>` : '');

        // Low stock
        const lowStockHtml = (product.stock > 0 && product.stock <= 5) ?
            `<div class="text-xs font-bold text-red-500 flex items-center gap-1 mt-1.5"><i class="ph ph-warning"></i> เหลือ ${product.stock} ชิ้น!</div>` : '';

        // Wishlist
        const wishlist = JSON.parse(localStorage.getItem('btmusicdrive_wishlist') || '[]');
        const isWishlisted = wishlist.some(w => w.id === product.id);
        const heartClass = isWishlisted ? 'ph-fill ph-heart text-base text-red-500' : 'ph ph-heart text-base';

        // Price display
        const fmtP = p => `฿${Math.round(p).toLocaleString('th-TH')}`;
        const origHtml = hasDiscount
            ? `<span class="text-[10px] sm:text-xs text-gray-400 line-through">${fmtP(product.originalPrice)}</span>`
            : '';

        const _pUrl = product.slug ? `/product/${product.slug}` : `/product?id=${encodeURIComponent(product.id)}`;
        productCard.innerHTML = `
            <a href="${_pUrl}" class="block relative aspect-square overflow-hidden group cursor-pointer">
                <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy">
                ${badgeHtml}
                <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <button class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-colors z-10" data-wishlist="${escapeHtml(product.id)}" onclick="event.preventDefault();event.stopPropagation();">
                    <i class="${heartClass}"></i>
                </button>
            </a>
            <div class="p-2.5 sm:p-4">
                <div class="text-[10px] sm:text-xs text-gray-400 font-medium mb-0.5 uppercase tracking-wider">${escapeHtml(product.category?.name || product.category || '')}</div>
                <a href="${_pUrl}" class="block"><h3 class="text-xs sm:text-sm font-bold text-gray-900 mb-1 line-clamp-2 hover:text-primary transition-colors leading-snug">${escapeHtml(product.name)}</h3></a>
                <div class="hidden sm:flex items-center mb-2">
                    <div class="flex mr-1">${starsHtml}</div>
                    <span class="text-xs text-gray-400">(${reviews})</span>
                </div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    <div class="flex items-baseline gap-1.5 flex-wrap">
                        <span class="text-sm sm:text-base font-extrabold text-primary">${fmtP(product.price)}</span>
                        ${origHtml}
                    </div>
                    <button class="add-to-cart-btn bg-primary hover:bg-amber-700 active:scale-95 text-white font-bold rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg leading-none transition-all flex-shrink-0" data-id="${escapeHtml(product.id)}" onclick="event.preventDefault();event.stopPropagation();" aria-label="เพิ่มลงตะกร้า">+</button>
                </div>
                ${lowStockHtml}
            </div>
        `;
        
        productsContainer.appendChild(productCard);
    });

    // Add event listeners to "Add to Cart" buttons
    document.querySelectorAll('.add-to-cart-btn, .add-to-cart-btn-mobile').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.currentTarget.getAttribute('data-id');
            console.log('Add to cart clicked for product:', productId);
            addToCart(productId);
        });
    });
}

// Event Listeners Setup
function setupEventListeners() {
    // Cart toggle/overlay handlers live in components.js (_toggleCart)
    // Auth Toggle
    if (authBtn) authBtn.addEventListener('click', () => {
        if (currentUser) {
            handleLogout();
        } else {
            toggleAuthModal();
        }
    });
    if (closeAuthBtn) closeAuthBtn.addEventListener('click', toggleAuthModal);

    // Close auth modal when clicking on backdrop (outside modal content)
    if (authModal) authModal.addEventListener('click', (e) => {
        if (e.target === authModal) toggleAuthModal();
    });
    
    if (authToggleBtn) authToggleBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        updateAuthUI();
    });

    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

    // Mobile Menu Toggle
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
        if (mobileMenu) mobileMenu.classList.toggle('hidden');
    });

    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        if (navbar) {
            if (window.scrollY > 10) {
                navbar.classList.add('shadow-md', 'bg-opacity-95', 'backdrop-blur-sm');
            } else {
                navbar.classList.remove('shadow-md', 'bg-opacity-95', 'backdrop-blur-sm');
            }
        }
    });

    // Check auth state on load
    checkAuthState();
}

// Auth Functions
function toggleAuthModal() {
    const isHidden = authModal.classList.contains('hidden');
    
    if (isHidden) {
        authModal.classList.remove('hidden');
        authModal.classList.add('flex');
        setTimeout(() => {
            authModal.classList.remove('opacity-0');
            authModalContent.classList.remove('scale-95');
            authModalContent.classList.add('scale-100');
        }, 10);
        document.body.style.overflow = 'hidden';
    } else {
        authModal.classList.add('opacity-0');
        authModalContent.classList.remove('scale-100');
        authModalContent.classList.add('scale-95');
        
        setTimeout(() => {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
            document.body.style.overflow = '';
            // Reset form
            authForm.reset();
            authError.classList.add('hidden');
        }, 300);
    }
}

function updateAuthUI() {
    authTitle.textContent = isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
    authSubmitText.textContent = isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
    authToggleBtn.textContent = isLoginMode ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
    authError.classList.add('hidden');
    document.getElementById('auth-toggle-text').childNodes[0].nodeValue = isLoginMode ? "ไม่ใช่สมาชิก? " : "มีบัญชีแล้ว? ";
    // Hide remember-me row and forgot password when in register mode
    const rememberRow = document.getElementById('auth-remember-row');
    if (rememberRow) rememberRow.style.display = isLoginMode ? 'flex' : 'none';
}

async function handleGoogleCredentialResponse(response) {
    try {
        const token = response.credential;
        
        // Show loading state
        authSubmitText.classList.add('opacity-0');
        authSpinner.classList.remove('hidden');
        authSubmitBtn.disabled = true;
        authError.classList.add('hidden');
        
        const res = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Google Authentication failed');
        }
        
        // Success
        localStorage.setItem('btmusicdrive_token', data.token);
        currentUser = data.user;
        
        updateUserUI();
        toggleAuthModal();
        if (typeof _showToast === 'function') _showToast('Successfully logged in with Google!');
        
        // Sync cart
        await syncLocalCartToDatabase();
        
    } catch (error) {
        authErrorText.textContent = error.message;
        authError.classList.remove('hidden');
    } finally {
        authSubmitText.classList.remove('opacity-0');
        authSpinner.classList.add('hidden');
        authSubmitBtn.disabled = false;
    }
}

// Ensure function is globally accessible for Google's callback
window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = authEmail.value;
    const password = authPassword.value;
    
    // UI Loading state
    authSubmitText.classList.add('opacity-0');
    authSpinner.classList.remove('hidden');
    authSubmitBtn.disabled = true;
    authError.classList.add('hidden');
    
    try {
        const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Authentication failed');
        }
        
        // Success
        localStorage.setItem('btmusicdrive_token', data.token);
        currentUser = data.user;
        
        updateUserUI();
        toggleAuthModal();
        if (typeof _showToast === 'function') _showToast(isLoginMode ? 'Successfully logged in!' : 'Account created successfully!');
        if (!isLoginMode && typeof fbq === 'function') fbq('track', 'CompleteRegistration');
        if (!isLoginMode && typeof ttq !== 'undefined') ttq.track('CompleteRegistration');

        // Sync cart after login/register
        await syncLocalCartToDatabase();
        
    } catch (error) {
        authErrorText.textContent = error.message;
        authError.classList.remove('hidden');
    } finally {
        authSubmitText.classList.remove('opacity-0');
        authSpinner.classList.add('hidden');
        authSubmitBtn.disabled = false;
    }
}

async function checkAuthState() {
    const token = localStorage.getItem('btmusicdrive_token');
    
    if (!token) return;
    
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateUserUI();
            
            // Fetch saved cart from database
            await fetchUserCart();
        } else {
            // Token invalid or expired
            localStorage.removeItem('btmusicdrive_token');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('btmusicdrive_token');
        currentUser = null;
        updateUserUI();
        if (typeof _showToast === 'function') _showToast('Logged out successfully');
    }
}

function updateUserUI() {
    const icon = authBtn.querySelector('i');
    const adminLink = document.getElementById('admin-nav-link');
    const adminLinkMobile = document.getElementById('admin-nav-link-mobile');

    if (currentUser) {
        icon.classList.remove('ph-user');
        icon.classList.add('ph-fill', 'ph-user-circle', 'text-primary');
        
        const username = currentUser.email.split('@')[0];
        userGreeting.textContent = `Hi, ${username}`;
        userGreeting.classList.remove('hidden');

        // Show admin link only for ADMIN role
        const isAdmin = currentUser.role === 'ADMIN';
        adminLink?.classList.toggle('hidden', !isAdmin);
        adminLinkMobile?.classList.toggle('hidden', !isAdmin);
    } else {
        icon.classList.remove('ph-fill', 'ph-user-circle', 'text-primary');
        icon.classList.add('ph-user');
        userGreeting.classList.add('hidden');
        adminLink?.classList.add('hidden');
        adminLinkMobile?.classList.add('hidden');
    }
}

// Cart Functions
async function fetchUserCart() {
    if (!currentUser) return;
    
    const token = localStorage.getItem('btmusicdrive_token');
    try {
        const response = await fetch(`${API_BASE}/cart`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Transform backend cart items to match frontend structure
            cart = data.items.map(item => ({
                id: item.product.id,
                name: item.product.name,
                price: item.product.price,
                image: item.product.imageUrl,
                category: item.product.categoryId, // Fallback if needed
                quantity: item.quantity
            }));
            localStorage.setItem('btmusicdrive_cart', JSON.stringify(cart));
            if (typeof _loadCartFromStorage === 'function') _loadCartFromStorage();
            if (typeof _updateCartUI === 'function') _updateCartUI();
        }
    } catch (error) {
        console.error('Error fetching cart:', error);
    }
}

async function syncLocalCartToDatabase() {
    if (!currentUser || cart.length === 0) return;
    
    const token = localStorage.getItem('btmusicdrive_token');
    const itemsToSync = cart.map(item => ({
        productId: item.id,
        quantity: item.quantity
    }));
    
    try {
        const response = await fetch(`${API_BASE}/cart/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ items: itemsToSync })
        });
        
        if (response.ok) {
            await fetchUserCart(); // Refresh cart to ensure consistency
            if (typeof _showToast === 'function') _showToast('Local cart synced with your account');
        }
    } catch (error) {
        console.error('Error syncing cart:', error);
    }
}

async function addToCart(productId) {
    // Search in script.js products first, then fallback to shopProducts (from shop.html)
    let product = products.find(p => p.id === productId);
    if (!product && typeof shopProducts !== 'undefined') {
        product = shopProducts.find(p => p.id === productId);
    }
    if (!product) return;

    // Local state update (optimistic UI)
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image || product.imageUrl,
            category: product.category?.name || product.category || '',
            quantity: 1
        });
    }

    localStorage.setItem('btmusicdrive_cart', JSON.stringify(cart));
    if (typeof _loadCartFromStorage === 'function') _loadCartFromStorage();
    if (typeof _updateCartUI === 'function') _updateCartUI();

    if (typeof _showToast === 'function') _showToast(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);
    if (typeof fbq === 'function') fbq('track', 'AddToCart', {
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        contents: [{ id: product.id, quantity: 1, item_price: product.price }],
        value: product.price,
        currency: 'THB'
    });
    if (typeof ttq !== 'undefined') ttq.track('AddToCart', { content_id: product.id, content_name: product.name, quantity: 1, price: product.price, currency: 'THB' });

    // Auto-open cart sidebar on desktop
    if (window.innerWidth >= 768) {
        const sidebar = document.getElementById('cart-sidebar');
        if (sidebar && sidebar.classList.contains('translate-x-full') && typeof _toggleCart === 'function') {
            _toggleCart();
        }
    }

    // Sync with backend if logged in
    if (currentUser) {
        const token = localStorage.getItem('btmusicdrive_token');
        try {
            await fetch(`${API_BASE}/cart/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ productId, quantity: 1 })
            });
        } catch (error) {
            console.error('Error saving item to cart:', error);
        }
    }
}

// Cart UI rendering, toast, removeFromCart, updateQuantity are handled by
// components.js (_updateCartUI, _showToast, _removeFromCart, _updateQty).
