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
const productsContainer = document.getElementById('products-container');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const emptyCartMsg = document.getElementById('empty-cart-msg');
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
document.addEventListener('DOMContentLoaded', async () => {
    await loadNavMenus();
    await fetchProducts();
    setupEventListeners();
    updateCartUI();
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

// ── Dynamic Navigation Menus ───────────────────────────────────────────────
const DEFAULT_MENUS = [
    { label: 'หน้าแรก', url: '#', icon: null },
    { label: 'สินค้า', url: '#shop', icon: null },
    { label: 'หมวดหมู่', url: '#categories', icon: null },
    { label: 'เกี่ยวกับ', url: 'about.html', icon: null },
    { label: 'ติดต่อเรา', url: 'contact.html', icon: 'ph ph-envelope' },
    { label: 'ติดตามพัสดุ', url: '/track-order', icon: 'ph ph-package' },
];

async function loadNavMenus() {
    let menus = DEFAULT_MENUS;
    try {
        const res = await fetch(`${API_BASE}/menus`);
        if (res.ok) {
            const data = await res.json();
            if (data.length > 0) menus = data;
        }
    } catch { /* use defaults */ }
    renderNavMenus(menus);
}

function renderNavMenus(menus) {
    const desktop = document.getElementById('desktop-nav');
    const mobile = document.getElementById('mobile-nav');
    if (!desktop || !mobile) return;

    // Desktop
    desktop.innerHTML = menus.map(m => {
        const iconHtml = m.icon ? `<i class="${escapeHtml(m.icon)} text-base"></i> ` : '';
        if (m.children && m.children.length > 0) {
            const submenu = m.children.map(c =>
                `<a href="${escapeHtml(c.url)}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary">${c.icon ? `<i class="${escapeHtml(c.icon)}"></i> ` : ''}${escapeHtml(c.label)}</a>`
            ).join('');
            return `<div class="relative group">
                <button class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50">
                    ${iconHtml}${escapeHtml(m.label)} <i class="ph ph-caret-down text-xs ml-1"></i>
                </button>
                <div class="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    ${submenu}
                </div>
            </div>`;
        }
        return `<a href="${escapeHtml(m.url)}" class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50">${iconHtml}${escapeHtml(m.label)}</a>`;
    }).join('');

    // Mobile
    mobile.innerHTML = menus.map((m, i) => {
        const iconHtml = m.icon ? `<i class="${escapeHtml(m.icon)}"></i>` : '';
        if (m.children && m.children.length > 0) {
            const submenu = m.children.map(c =>
                `<a href="${escapeHtml(c.url)}" class="block pl-7 pr-3 py-2 rounded-md text-sm text-gray-400 hover:text-primary hover:bg-white/10 flex items-center gap-2">${c.icon ? `<i class="${escapeHtml(c.icon)}"></i>` : ''}${escapeHtml(c.label)}</a>`
            ).join('');
            return `<div class="mob-has-sub">
                <button type="button" class="mob-sub-toggle w-full flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-primary hover:bg-white/10" data-sub="${i}" aria-expanded="false">
                    ${iconHtml}
                    <span class="flex-1 text-left">${escapeHtml(m.label)}</span>
                    <i class="ph ph-caret-down mob-caret text-sm transition-transform duration-200"></i>
                </button>
                <div class="mob-sub-panel hidden" data-sub="${i}">
                    ${submenu}
                </div>
            </div>`;
        }
        return `<a href="${escapeHtml(m.url)}" class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-primary hover:bg-white/10 flex items-center gap-2">${iconHtml}${escapeHtml(m.label)}</a>`;
    }).join('') + `<a href="/admin" id="admin-nav-link-mobile" class="hidden px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-primary hover:bg-white/10 flex items-center gap-2"><i class="ph ph-shield-check"></i> Admin Dashboard</a>`;

    bindMobileNavDropdowns(mobile);
}

function bindMobileNavDropdowns(mobile) {
    if (mobile._subMenuBound) return;
    mobile._subMenuBound = true;

    mobile.addEventListener('click', (event) => {
        const toggleBtn = event.target.closest('.mob-sub-toggle');
        if (toggleBtn && mobile.contains(toggleBtn)) {
            const key = toggleBtn.dataset.sub;
            const panel = mobile.querySelector(`.mob-sub-panel[data-sub="${key}"]`);
            const caret = toggleBtn.querySelector('.mob-caret');
            if (!panel) return;

            const isOpen = !panel.classList.contains('hidden');
            panel.classList.toggle('hidden', isOpen);
            toggleBtn.setAttribute('aria-expanded', String(!isOpen));
            caret?.classList.toggle('rotate-180', !isOpen);
            return;
        }

        const navLink = event.target.closest('a[href]');
        if (!navLink || !mobile.contains(navLink)) return;

        closeMobileNavMenu(mobile);
    });
}

function closeMobileNavMenu(mobile) {
    document.getElementById('mobile-menu')?.classList.add('hidden');
    mobile.querySelectorAll('.mob-sub-panel').forEach(panel => panel.classList.add('hidden'));
    mobile.querySelectorAll('.mob-sub-toggle').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    mobile.querySelectorAll('.mob-caret').forEach(caret => caret.classList.remove('rotate-180'));
}

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
                <div class="flex items-baseline gap-1.5 flex-wrap mb-2">
                    <span class="text-sm sm:text-base font-extrabold text-primary">${fmtP(product.price)}</span>
                    ${origHtml}
                </div>
                <button class="add-to-cart-btn w-full bg-primary hover:bg-amber-700 active:scale-95 text-white font-bold py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all" data-id="${escapeHtml(product.id)}" onclick="event.preventDefault();event.stopPropagation();">
                    <i class="ph ph-shopping-cart text-sm sm:text-base"></i> เพิ่มลงตะกร้า
                </button>
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
    // Cart Toggle
    if (cartBtn) cartBtn.addEventListener('click', toggleCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', toggleCart);
    if (cartOverlay) cartOverlay.addEventListener('click', () => {
        if (cartSidebar && !cartSidebar.classList.contains('translate-x-full')) toggleCart();
        if (authModal && !authModal.classList.contains('hidden')) toggleAuthModal();
    });
    
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
        showToast('Successfully logged in with Google!');
        
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
        showToast(isLoginMode ? 'Successfully logged in!' : 'Account created successfully!');
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
        showToast('Logged out successfully');
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
function toggleCart() {
    if (!cartSidebar || !cartOverlay) return;
    const isCartOpen = !cartSidebar.classList.contains('translate-x-full');
    
    if (isCartOpen) {
        // Close Cart
        cartSidebar.classList.add('translate-x-full');
        cartOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    } else {
        // Open Cart
        cartSidebar.classList.remove('translate-x-full');
        cartOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

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
            updateCartUI();
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
            showToast('Local cart synced with your account');
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

    updateCartUI();
    showToast(`Added ${product.name} to cart`);
    if (typeof fbq === 'function') fbq('track', 'AddToCart', {
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        contents: [{ id: product.id, quantity: 1, item_price: product.price }],
        value: product.price,
        currency: 'THB'
    });
    if (typeof ttq !== 'undefined') ttq.track('AddToCart', { content_id: product.id, content_name: product.name, quantity: 1, price: product.price, currency: 'THB' });
    
    // Auto-open cart on desktop
    if (window.innerWidth >= 768 && cartSidebar && cartSidebar.classList.contains('translate-x-full')) {
        toggleCart();
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

async function removeFromCart(productId) {
    // Local state update
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('btmusicdrive_cart', JSON.stringify(cart));
    if (typeof _loadCartFromStorage === 'function') _loadCartFromStorage();
    if (typeof _updateCartUI === 'function') _updateCartUI();
    updateCartUI();
    
    // Sync with backend if logged in
    if (currentUser) {
        const token = localStorage.getItem('btmusicdrive_token');
        try {
            await fetch(`${API_BASE}/cart/items/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Error removing item from cart:', error);
        }
    }
}

async function updateQuantity(productId, newQuantity) {
    if (newQuantity < 1) return;
    
    // Local state update
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity = newQuantity;
        localStorage.setItem('btmusicdrive_cart', JSON.stringify(cart));
        if (typeof _loadCartFromStorage === 'function') _loadCartFromStorage();
        if (typeof _updateCartUI === 'function') _updateCartUI();
        updateCartUI();
        
        // Sync with backend if logged in
        if (currentUser) {
            const token = localStorage.getItem('btmusicdrive_token');
            try {
                await fetch(`${API_BASE}/cart/items/${productId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ quantity: newQuantity })
                });
            } catch (error) {
                console.error('Error updating item quantity:', error);
            }
        }
    }
}

function updateCartUI() {
    // Update Cart Count Badge
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;
    
    // If cart sidebar elements don't exist on this page, just save and return
    if (!cartItemsContainer) return;
    
    // Show/Hide Empty Message
    if (cart.length === 0) {
        if (emptyCartMsg) emptyCartMsg.style.display = 'block';
        cartItemsContainer.innerHTML = '';
        if (emptyCartMsg) cartItemsContainer.appendChild(emptyCartMsg);
        if (cartTotal) cartTotal.textContent = '฿0.00';
        return;
    }
    
    if (emptyCartMsg) emptyCartMsg.style.display = 'none';
    
    // Render Cart Items
    cartItemsContainer.innerHTML = '';
    
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItemEl = document.createElement('div');
        cartItemEl.className = 'flex gap-4 py-4 border-b border-gray-100 animate-fade-in-up';
        
        cartItemEl.innerHTML = `
            <div class="w-20 h-24 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 flex flex-col">
                <div class="flex justify-between">
                    <h4 class="text-sm font-bold text-gray-900 line-clamp-2 pr-4">${escapeHtml(item.name)}</h4>
                    <button class="remove-item-btn text-gray-400 hover:text-red-500 transition-colors flex-shrink-0" data-id="${escapeHtml(item.id)}">
                        <i class="ph ph-trash text-lg"></i>
                    </button>
                </div>
                <p class="text-sm text-gray-500 mt-1">${escapeHtml(item.category?.name || item.category || '')}</p>
                <div class="flex justify-between items-end mt-auto pt-2">
                    <div class="flex items-center border border-gray-200 rounded-md">
                        <button class="qty-btn minus-btn px-2 py-1 text-gray-500 hover:text-primary transition-colors" data-id="${item.id}">
                            <i class="ph ph-minus text-xs"></i>
                        </button>
                        <span class="px-2 text-sm font-medium w-8 text-center">${item.quantity}</span>
                        <button class="qty-btn plus-btn px-2 py-1 text-gray-500 hover:text-primary transition-colors" data-id="${item.id}">
                            <i class="ph ph-plus text-xs"></i>
                        </button>
                    </div>
                    <span class="font-bold text-gray-900">฿${itemTotal.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        cartItemsContainer.appendChild(cartItemEl);
    });
    
    // Update Total
    if (cartTotal) cartTotal.textContent = `฿${total.toFixed(2)}`;
    
    // Attach event listeners to new cart item buttons
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            console.log('Remove item clicked:', id);
            removeFromCart(id);
        });
    });
    
    document.querySelectorAll('.minus-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const item = cart.find(i => i.id === id);
            if(item) updateQuantity(id, item.quantity - 1);
        });
    });
    
    document.querySelectorAll('.plus-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const item = cart.find(i => i.id === id);
            if(item) updateQuantity(id, item.quantity + 1);
        });
    });
}

// Toast Notification System
function showToast(message) {
    // Check if toast container exists, if not create it
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-300';
    
    toast.innerHTML = `
        <div class="bg-green-500 rounded-full p-1">
            <i class="ph ph-check text-white"></i>
        </div>
        <p class="text-sm font-medium">${escapeHtml(message)}</p>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0');
        
        // Remove from DOM after animation completes
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
