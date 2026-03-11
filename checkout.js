const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:5000/api'
  : '/api';

const SHIPPING_COST = 50;
const TAX_RATE = 0.08;

let cart = [];
let currentUser = null;
let appliedPromo = null; // { code, type: 'PERCENT'|'FIXED', value, description }

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    enforceLogin();
    loadUserInfo();
    loadCart();
    checkPaymentStatus();
});

// ── Auth Guard ───────────────────────────────────────────────────────────────

function enforceLogin() {
    const token = localStorage.getItem('btmusicdrive_token');
    if (!token) {
        document.getElementById('auth-guard').classList.remove('hidden');
        document.getElementById('place-order-btn').disabled = true;
        document.getElementById('place-order-btn-mobile').disabled = true;
        document.getElementById('place-order-btn').classList.add('opacity-50', 'cursor-not-allowed');
        document.getElementById('place-order-btn-mobile').classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// ── User Info ────────────────────────────────────────────────────────────────

async function loadUserInfo() {
    const token = localStorage.getItem('btmusicdrive_token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        currentUser = data.user;

        const fullName = currentUser.name || '';
        const parts = fullName.trim().split(' ');
        document.getElementById('first-name').value = parts[0] || '';
        document.getElementById('last-name').value = parts.slice(1).join(' ') || '';
        document.getElementById('email').value = currentUser.email || '';
    } catch (e) {
        console.error('Failed to load user info:', e);
    }
}

// ── Cart Loading ─────────────────────────────────────────────────────────────

async function loadCart() {
    const token = localStorage.getItem('btmusicdrive_token');

    if (token) {
        try {
            const res = await fetch(`${API_BASE}/cart`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                cart = (data.items || []).map(item => ({
                    id: item.productId,
                    name: item.product?.name || 'Product',
                    price: parseFloat(item.product?.price || 0),
                    quantity: item.quantity,
                    image: item.product?.imageUrl || null
                }));
                renderOrderSummary();
                return;
            }
        } catch (e) {
            console.warn('Could not fetch server cart, falling back to localStorage:', e);
        }
    }

    // Fallback: localStorage
    try {
        const raw = localStorage.getItem('cart');
        cart = raw ? JSON.parse(raw) : [];
    } catch {
        cart = [];
    }
    renderOrderSummary();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderOrderSummary() {
    const container = document.getElementById('order-items');

    if (!cart || cart.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                <i class="ph ph-shopping-cart text-4xl mb-2"></i>
                <p class="text-sm">Your cart is empty.</p>
                <a href="index.html" class="mt-3 text-sm text-primary font-medium hover:underline">Browse products</a>
            </div>`;
        updateTotals();
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="flex items-center gap-3">
            <div class="relative flex-shrink-0">
                ${item.image
                    ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-16 h-16 object-cover rounded-lg border border-gray-100">`
                    : `<div class="w-16 h-16 bg-indigo-50 rounded-lg flex items-center justify-center"><i class="ph ph-package text-primary text-2xl"></i></div>`
                }
                <span class="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">${item.quantity}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(item.name)}</p>
                <p class="text-xs text-gray-400">Qty: ${item.quantity}</p>
            </div>
            <p class="text-sm font-bold text-gray-900 flex-shrink-0">฿${(item.price * item.quantity).toFixed(2)}</p>
        </div>
    `).join('');

    updateTotals();
}

function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const discount = calcDiscount(subtotal);
    const discountedSubtotal = subtotal - discount;
    const tax = discountedSubtotal * TAX_RATE;
    const total = discountedSubtotal + SHIPPING_COST + tax;

    document.getElementById('item-count').textContent = itemCount;
    document.getElementById('subtotal-price').textContent = `฿${subtotal.toFixed(2)}`;
    document.getElementById('tax-price').textContent = `฿${tax.toFixed(2)}`;
    document.getElementById('total-price').textContent = `฿${total.toFixed(2)}`;

    const discountRow = document.getElementById('discount-row');
    if (discountRow) {
        if (discount > 0) {
            discountRow.classList.remove('hidden');
            discountRow.querySelector('span:last-child').textContent = `-฿${discount.toFixed(2)}`;
        } else {
            discountRow.classList.add('hidden');
        }
    }

    const shippingRow = document.getElementById('shipping-row');
    if (shippingRow) {
        shippingRow.querySelector('span:last-child').textContent = `฿${SHIPPING_COST.toFixed(2)}`;
        shippingRow.querySelector('span:last-child').className = 'text-gray-900 font-medium';
    }
}

// ── Payment Tabs ──────────────────────────────────────────────────────────────

function switchPayment(method) {
    ['card', 'paypal', 'cod'].forEach(m => {
        document.getElementById(`payment-${m}`).classList.add('hidden');
        const tab = document.getElementById(`tab-${m}`);
        tab.classList.remove('bg-white', 'shadow-sm', 'text-primary');
        tab.classList.add('text-gray-500');
    });

    document.getElementById(`payment-${method}`).classList.remove('hidden');
    const activeTab = document.getElementById(`tab-${method}`);
    activeTab.classList.add('bg-white', 'shadow-sm', 'text-primary');
    activeTab.classList.remove('text-gray-500');
}

// ── Input Formatters ──────────────────────────────────────────────────────────

function formatCardNumber(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 16);
    input.value = val.match(/.{1,4}/g)?.join(' ') || val;
}

function formatExpiry(input) {
    let val = input.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) {
        val = val.substring(0, 2) + ' / ' + val.substring(2);
    }
    input.value = val;
}

// ── Promo Code ────────────────────────────────────────────────────────────────

async function applyPromo() {
    const input = document.getElementById('promo-input');
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    if (appliedPromo) {
        showPromoError('A promo code is already applied. Remove it first.');
        return;
    }

    const btn = document.querySelector('[onclick="applyPromo()"]');
    btn.disabled = true;
    btn.textContent = '...';
    clearPromoError();

    const token = localStorage.getItem('btmusicdrive_token');
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    try {
        const res = await fetch(`${API_BASE}/promo/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ code, cartTotal: subtotal })
        });

        const data = await res.json();

        if (!res.ok) {
            showPromoError(data.error || `Promo code "${code}" is not valid.`);
            btn.disabled = false;
            btn.textContent = 'Apply';
            return;
        }

        appliedPromo = { code: data.code || code, type: data.type, value: data.value, description: data.description };
        renderPromoApplied();
        updateTotals();

    } catch {
        // API unavailable — fallback demo codes
        const DEMO_CODES = {
            'SAVE10':  { type: 'PERCENT', value: 10,  description: '10% off your order' },
            'SAVE50':  { type: 'FIXED',   value: 50,  description: '฿50 off your order' },
            'WELCOME': { type: 'PERCENT', value: 15,  description: '15% welcome discount' },
        };

        if (DEMO_CODES[code]) {
            appliedPromo = { code, ...DEMO_CODES[code] };
            renderPromoApplied();
            updateTotals();
        } else {
            showPromoError(`Promo code "${code}" is not valid.`);
            btn.disabled = false;
            btn.textContent = 'Apply';
        }
    }
}

function removePromo() {
    appliedPromo = null;
    const input = document.getElementById('promo-input');
    input.value = '';
    input.disabled = false;
    document.getElementById('promo-applied-row').classList.add('hidden');
    document.getElementById('discount-row').classList.add('hidden');
    clearPromoError();
    const btn = document.querySelector('[onclick="applyPromo()"]');
    btn.disabled = false;
    btn.textContent = 'Apply';
    updateTotals();
}

function renderPromoApplied() {
    document.getElementById('promo-applied-row').classList.remove('hidden');
    document.getElementById('promo-code-display').textContent = appliedPromo.code;
    document.getElementById('promo-desc-display').textContent = appliedPromo.description || '';
    document.getElementById('promo-input').disabled = true;
    const btn = document.querySelector('[onclick="applyPromo()"]');
    btn.disabled = true;
    btn.textContent = 'Applied';
}

function calcDiscount(subtotal) {
    if (!appliedPromo) return 0;
    if (appliedPromo.type === 'PERCENT') return Math.min(subtotal * (appliedPromo.value / 100), subtotal);
    if (appliedPromo.type === 'FIXED')   return Math.min(appliedPromo.value, subtotal);
    return 0;
}

function showPromoError(msg) {
    const el = document.getElementById('promo-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function clearPromoError() {
    document.getElementById('promo-error').classList.add('hidden');
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateForm() {
    const required = [
        { id: 'first-name', label: 'First name' },
        { id: 'last-name', label: 'Last name' },
        { id: 'email', label: 'Email' },
        { id: 'phone', label: 'Phone number' },
        { id: 'address', label: 'Street address' },
        { id: 'city', label: 'City' },
        { id: 'state', label: 'State' },
        { id: 'zip', label: 'ZIP code' },
    ];

    for (const field of required) {
        const el = document.getElementById(field.id);
        if (!el || !el.value.trim()) {
            el?.focus();
            showError(`${field.label} is required.`);
            return false;
        }
    }

    const paymentCardVisible = !document.getElementById('payment-card').classList.contains('hidden');
    if (paymentCardVisible) {
        const cardNum = document.getElementById('card-number').value.replace(/\s/g, '');
        if (cardNum.length < 16) { showError('Enter a valid 16-digit card number.'); return false; }
        if (!document.getElementById('card-name').value.trim()) { showError('Cardholder name is required.'); return false; }
        const expiry = document.getElementById('card-expiry').value.replace(/\s/g, '');
        if (expiry.length < 4) { showError('Enter a valid expiry date.'); return false; }
        const cvv = document.getElementById('card-cvv').value;
        if (cvv.length < 3) { showError('Enter a valid CVV.'); return false; }
    }

    return true;
}

// ── Place Order ───────────────────────────────────────────────────────────────

async function placeOrder() {
    hideError();

    const token = localStorage.getItem('btmusicdrive_token');
    if (!token) {
        showError('You must be logged in to place an order.');
        return;
    }

    if (cart.length === 0) {
        showError('Your cart is empty.');
        return;
    }

    if (!validateForm()) return;

    const btn = document.getElementById('place-order-btn');
    const btnMobile = document.getElementById('place-order-btn-mobile');
    setLoading(btn, true);
    setLoading(btnMobile, true);

    const shippingAddress = [
        document.getElementById('address').value.trim(),
        document.getElementById('address2').value.trim(),
        document.getElementById('city').value.trim(),
        document.getElementById('state').value.trim(),
        document.getElementById('zip').value.trim(),
        document.getElementById('country').value
    ].filter(Boolean).join(', ');

    try {
        const res = await fetch(`${API_BASE}/payment/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                ...(appliedPromo ? { promoCode: appliedPromo.code } : {})
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Failed to initiate checkout. Please try again.');
            setLoading(btn, false);
            setLoading(btnMobile, false);
            return;
        }

        // Redirect to Stripe Checkout URL
        window.location.href = data.url;

    } catch (e) {
        console.error('Checkout error:', e);
        showError('Network error. Please check your connection and try again.');
        setLoading(btn, false);
        setLoading(btnMobile, false);
    }
}

// ── Status Checking ──────────────────────────────────────────────────────────

async function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const sessionId = urlParams.get('session_id');

    if (status === 'success' && sessionId) {
        // Clean up URL immediately
        window.history.replaceState({}, document.title, window.location.pathname);

        // Confirm payment with backend to create the DB order
        const token = localStorage.getItem('btmusicdrive_token');
        let orderId = sessionId.slice(-8).toUpperCase();

        if (token) {
            try {
                const res = await fetch(`${API_BASE}/payment/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ sessionId })
                });
                if (res.ok) {
                    const order = await res.json();
                    orderId = order.id ? order.id.slice(-8).toUpperCase() : orderId;
                }
            } catch (e) {
                console.warn('Could not confirm order with backend:', e);
            }
        }

        // Clear cart everywhere
        cart = [];
        localStorage.removeItem('cart');

        // Show success modal
        document.getElementById('order-id-display').textContent = `Order #${orderId}`;
        document.getElementById('success-modal').classList.remove('hidden');
        document.getElementById('success-modal').classList.add('flex');

    } else if (status === 'cancelled') {
        showError('Payment was cancelled. You can try again when you are ready.');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showError(msg) {
    document.getElementById('checkout-error-text').textContent = msg;
    document.getElementById('checkout-error').classList.remove('hidden');
    document.getElementById('checkout-error').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
    document.getElementById('checkout-error').classList.add('hidden');
}

function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner animate-spin mr-2"></i> Processing...';
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-lock-key mr-2"></i> Place Order';
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}