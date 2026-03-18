// API base URL — auto-detects dev vs production
const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:5000/api'
  : '/api';

// Product Data State (Fetched from API)
let products = [];
// Cart State
let cart = [];

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
    initFacebookSDK();
    await loadNavMenus();
    await fetchProducts();
    setupEventListeners();
    updateCartUI();
});

// ── Facebook SDK Init ──────────────────────────────────────────────────────
function initFacebookSDK() {
    window.fbAsyncInit = function() {
        FB.init({
            appId: '1234567890', // TODO: Replace with your Facebook App ID
            cookie: true,
            xfbml: true,
            version: 'v19.0'
        });
    };
}

function loginWithFacebook() {
    if (typeof FB === 'undefined') {
        showToast('Facebook SDK ยังไม่พร้อม กรุณาลองใหม่');
        return;
    }
    FB.login(function(response) {
        if (response.authResponse) {
            handleFacebookLogin(response.authResponse.accessToken);
        }
    }, { scope: 'email,public_profile' });
}

async function handleFacebookLogin(accessToken) {
    authSubmitText.classList.add('opacity-0');
    authSpinner.classList.remove('hidden');
    authSubmitBtn.disabled = true;
    authError.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/auth/facebook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Facebook login failed');

        localStorage.setItem('btmusicdrive_token', data.token);
        currentUser = data.user;
        updateUserUI();
        toggleAuthModal();
        showToast('เข้าสู่ระบบด้วย Facebook สำเร็จ!');
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
window.loginWithFacebook = loginWithFacebook;

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
    { label: 'เกี่ยวกับ', url: '#about', icon: null },
    { label: 'ติดตามพัสดุ', url: 'track-order.html', icon: 'ph ph-package' },
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
        const iconHtml = m.icon ? `<i class="${m.icon} text-base"></i> ` : '';
        if (m.children && m.children.length > 0) {
            const submenu = m.children.map(c =>
                `<a href="${c.url}" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary">${c.icon ? `<i class="${c.icon}"></i> ` : ''}${c.label}</a>`
            ).join('');
            return `<div class="relative group">
                <button class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50">
                    ${iconHtml}${m.label} <i class="ph ph-caret-down text-xs ml-1"></i>
                </button>
                <div class="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    ${submenu}
                </div>
            </div>`;
        }
        return `<a href="${m.url}" class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-gray-50">${iconHtml}${m.label}</a>`;
    }).join('');

    // Mobile
    mobile.innerHTML = menus.map(m => {
        const iconHtml = m.icon ? `<i class="${m.icon}"></i> ` : '';
        let html = `<a href="${m.url}" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 flex items-center gap-2">${iconHtml}${m.label}</a>`;
        if (m.children && m.children.length > 0) {
            html += m.children.map(c =>
                `<a href="${c.url}" class="block pl-8 pr-3 py-2 rounded-md text-sm text-gray-600 hover:text-primary hover:bg-gray-50">${c.icon ? `<i class="${c.icon}"></i> ` : ''}${c.label}</a>`
            ).join('');
        }
        return html;
    }).join('') + `<a href="admin.html" id="admin-nav-link-mobile" class="hidden px-3 py-2 rounded-md text-base font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 flex items-center gap-2"><i class="ph ph-shield-check"></i> Admin Dashboard</a>`;
}

// Fetch Products from API or fallback to local JSON
async function fetchProducts() {
    try {
        productsContainer.innerHTML = '<div class="col-span-full text-center py-10"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p class="mt-4 text-gray-500">Loading products...</p></div>';
        
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
        
        products = await response.json();
        renderProducts();
    } catch (error) {
        console.error('Error:', error);
        productsContainer.innerHTML = '<div class="col-span-full text-center py-10 text-red-500"><i class="ph ph-warning-circle text-4xl mb-2"></i><p>Failed to load products. Please check if the server is running.</p></div>';
    }
}

// Render Products
function renderProducts() {
    productsContainer.innerHTML = '';
    
    products.forEach((product, index) => {
        // Create product card
        const productCard = document.createElement('div');
        productCard.className = `bg-white rounded-2xl overflow-hidden product-card border border-gray-100 animate-fade-in-up`;
        productCard.style.animationDelay = `${index * 0.1}s`;
        
        // Generate stars HTML
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(product.rating)) {
                starsHtml += `<i class="ph-fill ph-star text-yellow-400 text-sm"></i>`;
            } else if (i === Math.ceil(product.rating) && !Number.isInteger(product.rating)) {
                starsHtml += `<i class="ph-fill ph-star-half text-yellow-400 text-sm"></i>`;
            } else {
                starsHtml += `<i class="ph ph-star text-gray-300 text-sm"></i>`;
            }
        }

        // Badge HTML
        const badgeHtml = product.badge ? 
            `<span class="absolute top-4 left-4 bg-white px-3 py-1 rounded-full text-xs font-bold text-gray-900 shadow-sm">${product.badge}</span>` : '';

        productCard.innerHTML = `
            <a href="product.html?id=${product.id}" class="block relative h-64 overflow-hidden group cursor-pointer">
                <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                ${badgeHtml}
                <div class="absolute inset-0 bg-black bg-opacity-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button class="add-to-cart-btn bg-white text-gray-900 hover:bg-primary hover:text-white font-bold py-3 px-6 rounded-full shadow-lg transition-colors flex items-center" data-id="${product.id}" onclick="event.preventDefault();event.stopPropagation();">
                        <i class="ph ph-shopping-cart mr-2 text-lg"></i> Add to Cart
                    </button>
                </div>
                <button class="absolute top-4 right-4 bg-white p-2 rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-colors z-10" onclick="event.preventDefault();event.stopPropagation();">
                    <i class="ph ph-heart text-xl"></i>
                </button>
            </a>
            <div class="p-5">
                <div class="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">${product.category?.name || product.category || ''}</div>
                <a href="product.html?id=${product.id}" class="block"><h3 class="text-lg font-bold text-gray-900 mb-2 truncate hover:text-primary transition-colors">${product.name}</h3></a>
                <div class="flex items-center mb-3">
                    <div class="flex mr-2">
                        ${starsHtml}
                    </div>
                    <span class="text-xs text-gray-500">(${product.reviews})</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xl font-bold text-gray-900">฿${product.price.toFixed(2)}</span>
                    <button class="md:hidden add-to-cart-btn-mobile text-primary hover:text-indigo-800 p-2" data-id="${product.id}">
                        <i class="ph-fill ph-plus-circle text-3xl"></i>
                    </button>
                </div>
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
    cartBtn.addEventListener('click', toggleCart);
    closeCartBtn.addEventListener('click', toggleCart);
    cartOverlay.addEventListener('click', () => {
        if (!cartSidebar.classList.contains('translate-x-full')) toggleCart();
        if (!authModal.classList.contains('hidden')) toggleAuthModal();
    });
    
    // Auth Toggle
    authBtn.addEventListener('click', () => {
        if (currentUser) {
            handleLogout();
        } else {
            toggleAuthModal();
        }
    });
    closeAuthBtn.addEventListener('click', toggleAuthModal);

    // Close auth modal when clicking on backdrop (outside modal content)
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) toggleAuthModal();
    });
    
    authToggleBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        updateAuthUI();
    });

    authForm.addEventListener('submit', handleAuthSubmit);

    // Mobile Menu Toggle
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar.classList.add('shadow-md', 'bg-opacity-95', 'backdrop-blur-sm');
        } else {
            navbar.classList.remove('shadow-md', 'bg-opacity-95', 'backdrop-blur-sm');
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
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Local state update (optimistic UI)
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            image: product.image || product.imageUrl,
            category: product.category?.name || product.category || '',
            quantity: 1
        });
    }

    updateCartUI();
    showToast(`Added ${product.name} to cart`);
    
    // Auto-open cart on desktop
    if (window.innerWidth >= 768 && cartSidebar.classList.contains('translate-x-full')) {
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
    cartCount.textContent = totalItems;
    
    // Show/Hide Empty Message
    if (cart.length === 0) {
        emptyCartMsg.style.display = 'block';
        cartItemsContainer.innerHTML = '';
        cartItemsContainer.appendChild(emptyCartMsg);
        cartTotal.textContent = '฿0.00';
        return;
    }
    
    emptyCartMsg.style.display = 'none';
    
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
                <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 flex flex-col">
                <div class="flex justify-between">
                    <h4 class="text-sm font-bold text-gray-900 line-clamp-2 pr-4">${item.name}</h4>
                    <button class="remove-item-btn text-gray-400 hover:text-red-500 transition-colors flex-shrink-0" data-id="${item.id}">
                        <i class="ph ph-trash text-lg"></i>
                    </button>
                </div>
                <p class="text-sm text-gray-500 mt-1">${item.category?.name || item.category || ''}</p>
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
    cartTotal.textContent = `฿${total.toFixed(2)}`;
    
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
        <p class="text-sm font-medium">${message}</p>
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
