const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:5000/api'
  : '/api';

// ── Shipping Config — reads from admin localStorage settings, falls back to defaults
const SHIPPING_COST = Number(localStorage.getItem('btmd_shipping_cost') ?? 35);
const FREE_SHIPPING_THRESHOLD = Number(localStorage.getItem('btmd_free_shipping_threshold') ?? 200);
const TAX_RATE = 0;

let cart = [];
let currentUser = null;
let appliedPromo = null;

// Stripe state
let stripeInstance = null;
let stripeElements = null;       // for card
let stripePaymentElement = null;  // for card
let stripePromptPayElements = null;       // for promptpay
let stripePromptPayElement = null;        // for promptpay
let stripeClientSecret = null;
let stripePaymentIntentId = null;
let stripeInvoiceNo = null;
let currentStripeMethod = null;  // 'card' or 'promptpay'

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    enforceLogin();
    loadUserInfo();
    loadCart();
    initAddressDropdowns();
    initStripe();
});

// ── Stripe Init ──────────────────────────────────────────────────────────────

async function initStripe() {
    try {
        if (typeof Stripe === 'undefined') {
            hideStripeOptions();
            return;
        }

        const res = await fetch(`${API_BASE}/config/stripe`);
        if (!res.ok) { hideStripeOptions(); return; }
        const data = await res.json();

        if (data.publishableKey) {
            stripeInstance = Stripe(data.publishableKey);
        } else {
            hideStripeOptions();
        }
    } catch (e) {
        console.warn('Stripe init failed:', e);
        hideStripeOptions();
    }
}

function hideStripeOptions() {
    const cardBox = document.getElementById('payment-box-card');
    const promptpayBox = document.getElementById('payment-box-promptpay');
    if (cardBox) cardBox.style.display = 'none';
    if (promptpayBox) promptpayBox.style.display = 'none';
}

// ── Payment Method Toggle ────────────────────────────────────────────────────

function onPaymentMethodChange() {
    const selected = document.querySelector('input[name="payment_method"]:checked')?.value;

    // Update active states
    document.querySelectorAll('.payment-box').forEach(box => box.classList.remove('active'));

    // Hide all stripe sections
    document.getElementById('stripe-card-section')?.classList.add('hidden');
    document.getElementById('stripe-promptpay-section')?.classList.add('hidden');

    if (selected === 'card') {
        document.getElementById('payment-box-card')?.classList.add('active');
        document.getElementById('stripe-card-section')?.classList.remove('hidden');
        mountStripeElement('card');
    } else if (selected === 'promptpay') {
        document.getElementById('payment-box-promptpay')?.classList.add('active');
        document.getElementById('stripe-promptpay-section')?.classList.remove('hidden');
        mountStripeElement('promptpay');
    } else {
        document.getElementById('payment-box-cod')?.classList.add('active');
    }
}

// ── Mount Stripe Payment Element ─────────────────────────────────────────────

async function mountStripeElement(method) {
    if (!stripeInstance) return;

    // Already mounted for this method
    if (method === 'card' && stripePaymentElement) return;
    if (method === 'promptpay' && stripePromptPayElement) return;

    const token = localStorage.getItem('btmusicdrive_token');
    if (!token) return;

    const containerId = method === 'card' ? 'stripe-card-element' : 'stripe-promptpay-element';
    const container = document.getElementById(containerId);
    if (!container) return;

    // Compute shipping address + phone for PaymentIntent
    const phone = document.getElementById('phone')?.value.trim().replace(/\D/g, '') || '';
    const shippingAddress = [
        document.getElementById('address')?.value.trim(),
        document.getElementById('address2')?.value.trim(),
        document.getElementById('city')?.value.trim(),
        document.getElementById('state')?.value.trim(),
        document.getElementById('zip')?.value.trim(),
        document.getElementById('country')?.value || 'TH'
    ].filter(Boolean).join(', ');

    try {
        container.innerHTML =
            '<div class="flex items-center justify-center py-6 text-gray-400"><i class="ph ph-spinner animate-spin text-2xl mr-2"></i> กำลังโหลด...</div>';

        // Create a new PaymentIntent if we don't have one or method changed
        if (!stripeClientSecret || currentStripeMethod !== method) {
            const res = await fetch(`${API_BASE}/payment/create-payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    shippingAddress: shippingAddress || 'pending',
                    phone: phone || '0000000000',
                    ...(appliedPromo ? { promoCode: appliedPromo.code } : {})
                })
            });

            const data = await res.json();

            if (!res.ok) {
                container.innerHTML =
                    `<p class="text-red-500 text-sm py-3">${data.error || 'ไม่สามารถโหลดช่องทางชำระเงินได้'}</p>`;
                return;
            }

            stripeClientSecret = data.clientSecret;
            stripePaymentIntentId = data.paymentIntentId;
            stripeInvoiceNo = data.invoiceNo;
            currentStripeMethod = method;
        }

        const appearance = {
            theme: 'stripe',
            variables: {
                colorPrimary: '#8B7355',
                fontFamily: 'Inter, sans-serif',
                borderRadius: '8px',
            },
        };

        container.innerHTML = '';

        if (method === 'card') {
            stripeElements = stripeInstance.elements({
                clientSecret: stripeClientSecret,
                appearance,
                locale: 'th',
            });
            stripePaymentElement = stripeElements.create('payment', {
                layout: 'tabs',
                paymentMethodOrder: ['card'],
                fields: { billingDetails: 'auto' },
            });
            stripePaymentElement.mount(`#${containerId}`);
        } else {
            stripePromptPayElements = stripeInstance.elements({
                clientSecret: stripeClientSecret,
                appearance,
                locale: 'th',
            });
            stripePromptPayElement = stripePromptPayElements.create('payment', {
                layout: 'tabs',
                paymentMethodOrder: ['promptpay'],
                fields: { billingDetails: 'auto' },
            });
            stripePromptPayElement.mount(`#${containerId}`);
        }

    } catch (e) {
        console.error('Mount Stripe element error:', e);
        container.innerHTML =
            '<p class="text-red-500 text-sm py-3">ไม่สามารถโหลดช่องทางชำระเงินได้ กรุณารีเฟรชหน้า</p>';
    }
}

// ── Auth Guard ────────────────────────────────────────────────────────────────

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

// ── User Info ─────────────────────────────────────────────────────────────────

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
        const fullNameField = document.getElementById('full-name');
        if (fullNameField) fullNameField.value = fullName;

        const parts = fullName.trim().split(' ');
        const firstNameField = document.getElementById('first-name');
        const lastNameField = document.getElementById('last-name');
        const emailField = document.getElementById('email');
        if (firstNameField) firstNameField.value = parts[0] || '';
        if (lastNameField) lastNameField.value = parts.slice(1).join(' ') || '';
        if (emailField) emailField.value = currentUser.email || '';
    } catch (e) {
        console.error('Failed to load user info:', e);
    }
}

// ── Cart Loading ──────────────────────────────────────────────────────────────

async function loadCart() {
    const token = localStorage.getItem('btmusicdrive_token');

    if (token) {
        try {
            // Ensure local items are synced to server before fetching
            const raw = localStorage.getItem('btmusicdrive_cart');
            try {
                const localCart = raw ? JSON.parse(raw) : [];
                if (localCart.length > 0) {
                    const itemsToSync = localCart.map(item => ({
                        productId: item.id,
                        quantity: item.quantity
                    }));
                    await fetch(`${API_BASE}/cart/sync`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ items: itemsToSync })
                    });
                }
            } catch (e) {
                console.warn('Failed to sync local cart:', e);
            }

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
                // Ensure UI is updated with the server's truth
                localStorage.setItem('btmusicdrive_cart', JSON.stringify(cart));
                if (typeof _loadCartFromStorage === 'function') _loadCartFromStorage();
                if (typeof _updateCartUI === 'function') _updateCartUI();

                renderOrderSummary();
                return;
            }
        } catch (e) {
            console.warn('Could not fetch server cart, falling back to localStorage:', e);
        }
    }

    try {
        const raw = localStorage.getItem('btmusicdrive_cart');
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
                <p class="text-sm">ตะกร้าของคุณว่างอยู่</p>
                <a href="index.html" class="mt-3 text-sm text-primary font-medium hover:underline">เลือกดูสินค้า</a>
            </div>`;
        updateTotals();
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="flex items-center gap-3">
            <div class="relative flex-shrink-0">
                ${item.image
                    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="w-16 h-16 object-cover rounded-lg border border-gray-100">`
                    : `<div class="w-16 h-16 bg-stone-100 rounded-lg flex items-center justify-center"><i class="ph ph-package text-primary text-2xl"></i></div>`
                }
                <span class="absolute -top-2 -right-2 w-5 h-5 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">${item.quantity}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(item.name)}</p>
                <p class="text-xs text-gray-400">จำนวน: ${item.quantity}</p>
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
    const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = discountedSubtotal + shippingCost + tax;

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
        if (shippingCost === 0) {
            shippingRow.querySelector('span:last-child').textContent = 'ฟรี';
            shippingRow.querySelector('span:last-child').className = 'text-green-600 font-semibold';
        } else {
            shippingRow.querySelector('span:last-child').textContent = `฿${shippingCost.toFixed(2)}`;
            shippingRow.querySelector('span:last-child').className = 'text-gray-900 font-medium';
        }
    }
}



// ── Promo Code ────────────────────────────────────────────────────────────────

async function applyPromo() {
    const input = document.getElementById('promo-input');
    const code = input.value.trim().toUpperCase();
    if (!code) return;

    if (appliedPromo) {
        showPromoError('มีโค้ดส่วนลดถูกใช้อยู่แล้ว กรุณาลบออกก่อน');
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
            body: JSON.stringify({ code, subtotal })
        });

        const data = await res.json();

        if (!res.ok) {
            showPromoError(data.error || `โค้ดส่วนลด "${code}" ไม่ถูกต้อง`);
            btn.disabled = false;
            btn.textContent = 'ใช้โค้ด';
            return;
        }

        appliedPromo = { code: data.code || code, type: data.type, value: data.value, description: data.description };
        renderPromoApplied();
        updateTotals();

    } catch {
        showPromoError('ไม่สามารถตรวจสอบโค้ดส่วนลดได้ กรุณาลองใหม่อีกครั้ง');
        btn.disabled = false;
        btn.textContent = 'ใช้โค้ด';
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
    btn.textContent = 'ใช้โค้ด';
    updateTotals();
}

function renderPromoApplied() {
    document.getElementById('promo-applied-row').classList.remove('hidden');
    document.getElementById('promo-code-display').textContent = appliedPromo.code;
    document.getElementById('promo-desc-display').textContent = appliedPromo.description || '';
    document.getElementById('promo-input').disabled = true;
    const btn = document.querySelector('[onclick="applyPromo()"]');
    btn.disabled = true;
    btn.textContent = 'ใช้แล้ว';
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
        { id: 'full-name', label: 'ชื่อ - นามสกุล' },
        { id: 'phone', label: 'เบอร์โทรศัพท์' },
        { id: 'address', label: 'ที่อยู่' },
        { id: 'zip', label: 'รหัสไปรษณีย์' },
        { id: 'province', label: 'จังหวัด' },
        { id: 'district', label: 'อำเภอ / เขต' },
        { id: 'subdistrict', label: 'ตำบล / แขวง' },
    ];

    for (const field of required) {
        const el = document.getElementById(field.id);
        if (!el || !el.value.trim()) {
            el?.focus();
            showError(`กรุณากรอก${field.label}`);
            return false;
        }
    }

    return true;
}

// ── Place Order ───────────────────────────────────────────────────────────────

async function placeOrder() {
    hideError();

    const token = localStorage.getItem('btmusicdrive_token');
    if (!token) {
        showError('คุณต้องเข้าสู่ระบบก่อนสั่งซื้อ');
        return;
    }

    if (cart.length === 0) {
        showError('ตะกร้าของคุณว่างอยู่');
        return;
    }

    if (!validateForm()) return;

    const btn = document.getElementById('place-order-btn');
    const btnMobile = document.getElementById('place-order-btn-mobile');
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';

    const normalizedPhone = document.getElementById('phone').value.trim().replace(/\D/g, '');
    if (!/^(06|08|09)\d{8}$/.test(normalizedPhone)) {
        showError('เบอร์โทรศัพท์ไม่ถูกต้อง ต้องเป็น 10 หลัก ขึ้นต้นด้วย 06, 08 หรือ 09');
        return;
    }
    const shippingAddress = [
        document.getElementById('address').value.trim(),
        document.getElementById('address2')?.value.trim(),
        document.getElementById('city')?.value.trim(),
        document.getElementById('state')?.value.trim(),
        document.getElementById('zip').value.trim(),
        document.getElementById('country')?.value || 'TH'
    ].filter(Boolean).join(', ');

    setLoading(btn, true);
    setLoading(btnMobile, true);

    if (paymentMethod === 'card' || paymentMethod === 'promptpay') {
        await processStripeOrder(paymentMethod, shippingAddress, normalizedPhone, btn, btnMobile);
    } else {
        await processCodOrder(shippingAddress, normalizedPhone, btn, btnMobile);
    }
}

// ── Stripe Order (Card / PromptPay) ──────────────────────────────────────────

async function processStripeOrder(method, shippingAddress, phone, btn, btnMobile) {
    const token = localStorage.getItem('btmusicdrive_token');

    const elements = method === 'card' ? stripeElements : stripePromptPayElements;
    const paymentElement = method === 'card' ? stripePaymentElement : stripePromptPayElement;

    if (!stripeInstance || !elements || !paymentElement) {
        showError('กรุณาเลือกวิธีชำระเงินและรอให้โหลดเสร็จก่อน');
        setLoading(btn, false);
        setLoading(btnMobile, false);
        return;
    }

    if (!stripeClientSecret) {
        showError('ระบบชำระเงินยังไม่พร้อม กรุณาลองใหม่');
        setLoading(btn, false);
        setLoading(btnMobile, false);
        return;
    }

    try {
        // Confirm payment with Stripe
        const { error, paymentIntent } = await stripeInstance.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.origin + '/checkout.html',
            },
            redirect: 'if_required',
        });

        if (error) {
            const errorId = method === 'card' ? 'stripe-card-error' : 'stripe-promptpay-error';
            const stripeError = document.getElementById(errorId);
            if (stripeError) {
                stripeError.textContent = error.message;
                stripeError.classList.remove('hidden');
            }
            showError(error.message || 'การชำระเงินไม่สำเร็จ');
            setLoading(btn, false);
            setLoading(btnMobile, false);
            return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
            // Confirm order on backend
            const confirmRes = await fetch(`${API_BASE}/payment/confirm-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    paymentIntentId: paymentIntent.id,
                    invoiceNo: stripeInvoiceNo,
                })
            });

            const confirmData = await confirmRes.json();

            if (!confirmRes.ok) {
                showError(confirmData.error || 'ไม่สามารถยืนยันคำสั่งซื้อได้');
                setLoading(btn, false);
                setLoading(btnMobile, false);
                return;
            }

            cart = [];
            localStorage.removeItem('btmusicdrive_cart');
            showSuccessModal(confirmData.orderId, method === 'card' ? 'card' : 'promptpay');
        } else if (paymentIntent && paymentIntent.status === 'requires_action') {
            // PromptPay may need redirect for QR — handled by redirect: 'if_required'
            showError('กรุณาดำเนินการชำระเงินให้เสร็จสิ้น');
            setLoading(btn, false);
            setLoading(btnMobile, false);
        }

    } catch (e) {
        console.error('Stripe order error:', e);
        showError('เกิดข้อผิดพลาดในการชำระเงิน กรุณาลองใหม่');
        setLoading(btn, false);
        setLoading(btnMobile, false);
    }
}

// ── COD Order ─────────────────────────────────────────────────────────────────

async function processCodOrder(shippingAddress, phone, btn, btnMobile) {
    const token = localStorage.getItem('btmusicdrive_token');

    try {
        const res = await fetch(`${API_BASE}/payment/cod-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                shippingAddress,
                phone,
                ...(appliedPromo ? { promoCode: appliedPromo.code } : {})
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'ไม่สามารถสร้างคำสั่งซื้อได้');
            setLoading(btn, false);
            setLoading(btnMobile, false);
            return;
        }

        cart = [];
        localStorage.removeItem('btmusicdrive_cart');
        showSuccessModal(data.orderId, 'cod');

    } catch (e) {
        console.error('COD order error:', e);
        showError('เกิดข้อผิดพลาดเครือข่าย กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง');
        setLoading(btn, false);
        setLoading(btnMobile, false);
    }
}

// ── Success Modal ─────────────────────────────────────────────────────────────

function showSuccessModal(orderId, paymentMethod) {
    const shortId = orderId ? String(orderId).slice(-8).toUpperCase() : '';
    const methodTexts = { card: 'ชำระผ่านบัตร', promptpay: 'ชำระผ่านพร้อมเพย์', cod: 'ชำระเงินปลายทาง' };
    const methodText = methodTexts[paymentMethod] || 'ชำระเงินปลายทาง';
    document.getElementById('order-id-display').textContent = `คำสั่งซื้อ #${shortId} (${methodText})`;
    document.getElementById('success-modal').classList.remove('hidden');
    document.getElementById('success-modal').classList.add('flex');
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
        btn.innerHTML = '<i class="ph ph-spinner animate-spin mr-2"></i> กำลังดำเนินการ...';
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-lock-key mr-2"></i> สั่งซื้อ';
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

// ── Thailand Address Dropdown Logic ─────────────────────────────────────────

// Compact Thailand address data: province -> districts -> subdistricts with zip
const TH_ADDRESS_DATA = {
    'กรุงเทพมหานคร': {
        'เขตพระนคร': { 'แขวงพระบรมมหาราชวัง': '10200', 'แขวงวังบูรพาภิรมย์': '10200', 'แขวงวัดราชบพิธ': '10200', 'แขวงสำราญราษฎร์': '10200', 'แขวงศาลเจ้าพ่อเสือ': '10200', 'แขวงเสาชิงช้า': '10200', 'แขวงบวรนิเวศ': '10200', 'แขวงตลาดยอด': '10200', 'แขวงชนะสงคราม': '10200', 'แขวงบ้านพานถม': '10200', 'แขวงบางขุนพรหม': '10200', 'แขวงวัดสามพระยา': '10200' },
        'เขตดุสิต': { 'แขวงดุสิต': '10300', 'แขวงวชิรพยาบาล': '10300', 'แขวงสวนจิตรลดา': '10300', 'แขวงสี่แยกมหานาค': '10300', 'แขวงถนนนครไชยศรี': '10300' },
        'เขตหนองจอก': { 'แขวงกระทุ่มราย': '10530', 'แขวงหนองจอก': '10530', 'แขวงคลองสิบ': '10530', 'แขวงคลองสิบสอง': '10530', 'แขวงโคกแฝด': '10530', 'แขวงคู้ฝั่งเหนือ': '10530', 'แขวงลำผักชี': '10530', 'แขวงลำต้อยติ่ง': '10530' },
        'เขตบางรัก': { 'แขวงมหาพฤฒาราม': '10500', 'แขวงสีลม': '10500', 'แขวงสุริยวงศ์': '10500', 'แขวงบางรัก': '10500', 'แขวงสี่พระยา': '10500' },
        'เขตบางเขน': { 'แขวงอนุสาวรีย์': '10220', 'แขวงท่าแร้ง': '10220' },
        'เขตบางกะปิ': { 'แขวงคลองจั่น': '10240', 'แขวงหัวหมาก': '10240' },
        'เขตปทุมวัน': { 'แขวงรองเมือง': '10330', 'แขวงวังใหม่': '10330', 'แขวงปทุมวัน': '10330', 'แขวงลุมพินี': '10330' },
        'เขตป้อมปราบศัตรูพ่าย': { 'แขวงป้อมปราบ': '10100', 'แขวงวัดเทพศิรินทร์': '10100', 'แขวงคลองมหานาค': '10100', 'แขวงบ้านบาตร': '10100', 'แขวงวัดโสมนัส': '10100' },
        'เขตพระโขนง': { 'แขวงบางจาก': '10260' },
        'เขตมีนบุรี': { 'แขวงมีนบุรี': '10510', 'แขวงแสนแสบ': '10510' },
        'เขตลาดกระบัง': { 'แขวงลาดกระบัง': '10520', 'แขวงคลองสองต้นนุ่น': '10520', 'แขวงคลองสามประเวศ': '10520', 'แขวงลำปลาทิว': '10520', 'แขวงทับยาว': '10520', 'แขวงขุมทอง': '10520' },
        'เขตยานนาวา': { 'แขวงช่องนนทรี': '10120', 'แขวงบางโพงพาง': '10120' },
        'เขตสัมพันธวงศ์': { 'แขวงจักรวรรดิ': '10100', 'แขวงสัมพันธวงศ์': '10100', 'แขวงตลาดน้อย': '10100' },
        'เขตพญาไท': { 'แขวงสามเสนใน': '10400' },
        'เขตธนบุรี': { 'แขวงวัดกัลยาณ์': '10600', 'แขวงหิรัญรูจี': '10600', 'แขวงบางยี่เรือ': '10600', 'แขวงบุคคโล': '10600', 'แขวงตลาดพลู': '10600', 'แขวงดาวคะนอง': '10600', 'แขวงสำเหร่': '10600' },
        'เขตบางกอกใหญ่': { 'แขวงวัดอรุณ': '10600', 'แขวงวัดท่าพระ': '10600' },
        'เขตห้วยขวาง': { 'แขวงห้วยขวาง': '10310', 'แขวงบางกะปิ': '10310', 'แขวงสามเสนนอก': '10310' },
        'เขตคลองสาน': { 'แขวงสมเด็จเจ้าพระยา': '10600', 'แขวงคลองสาน': '10600', 'แขวงบางลำภูล่าง': '10600', 'แขวงคลองต้นไทร': '10600' },
        'เขตตลิ่งชัน': { 'แขวงคลองชักพระ': '10170', 'แขวงตลิ่งชัน': '10170', 'แขวงฉิมพลี': '10170', 'แขวงบางพรม': '10170', 'แขวงบางระมาด': '10170', 'แขวงบางเชือกหนัง': '10170' },
        'เขตบางกอกน้อย': { 'แขวงศิริราช': '10700', 'แขวงบ้านช่างหล่อ': '10700', 'แขวงบางขุนนนท์': '10700', 'แขวงบางขุนศรี': '10700', 'แขวงอรุณอมรินทร์': '10700' },
        'เขตบางขุนเทียน': { 'แขวงท่าข้าม': '10150', 'แขวงแสมดำ': '10150' },
        'เขตภาษีเจริญ': { 'แขวงบางหว้า': '10160', 'แขวงบางด้วน': '10160', 'แขวงบางแวก': '10160', 'แขวงคลองขวาง': '10160', 'แขวงปากคลองภาษีเจริญ': '10160', 'แขวงคูหาสวรรค์': '10160' },
        'เขตหนองแขม': { 'แขวงหนองแขม': '10160', 'แขวงหนองค้างพลู': '10160' },
        'เขตราษฎร์บูรณะ': { 'แขวงราษฎร์บูรณะ': '10140', 'แขวงบางปะกอก': '10140' },
        'เขตบางพลัด': { 'แขวงบางพลัด': '10700', 'แขวงบางอ้อ': '10700', 'แขวงบางบำหรุ': '10700', 'แขวงบางยี่ขัน': '10700' },
        'เขตดินแดง': { 'แขวงดินแดง': '10400' },
        'เขตบึงกุ่ม': { 'แขวงคลองกุ่ม': '10230', 'แขวงนวมินทร์': '10230', 'แขวงนวลจันทร์': '10230' },
        'เขตสาทร': { 'แขวงทุ่งวัดดอน': '10120', 'แขวงยานนาวา': '10120', 'แขวงทุ่งมหาเมฆ': '10120' },
        'เขตบางซื่อ': { 'แขวงบางซื่อ': '10800' },
        'เขตจตุจักร': { 'แขวงลาดยาว': '10900', 'แขวงเสนานิคม': '10900', 'แขวงจันทรเกษม': '10900', 'แขวงจอมพล': '10900', 'แขวงจตุจักร': '10900' },
        'เขตบางคอแหลม': { 'แขวงบางคอแหลม': '10120', 'แขวงวัดพระยาไกร': '10120', 'แขวงบางโคล่': '10120' },
        'เขตประเวศ': { 'แขวงประเวศ': '10250', 'แขวงหนองบอน': '10250', 'แขวงดอกไม้': '10250', 'แขวงสวนหลวง': '10250' },
        'เขตคลองเตย': { 'แขวงคลองเตย': '10110', 'แขวงคลองตัน': '10110', 'แขวงพระโขนง': '10110', 'แขวงคลองเตยเหนือ': '10110' },
        'เขตสวนหลวง': { 'แขวงสวนหลวง': '10250' },
        'เขตจอมทอง': { 'แขวงบางขุนเทียน': '10150', 'แขวงบางค้อ': '10150', 'แขวงบางมด': '10150', 'แขวงจอมทอง': '10150' },
        'เขตดอนเมือง': { 'แขวงสีกัน': '10210' },
        'เขตราชเทวี': { 'แขวงทุ่งพญาไท': '10400', 'แขวงถนนพญาไท': '10400', 'แขวงถนนเพชรบุรี': '10400', 'แขวงมักกะสัน': '10400' },
        'เขตลาดพร้าว': { 'แขวงลาดพร้าว': '10230', 'แขวงจรเข้บัว': '10230' },
        'เขตวัฒนา': { 'แขวงคลองเตยเหนือ': '10110', 'แขวงคลองตันเหนือ': '10110', 'แขวงพระโขนงเหนือ': '10110' },
        'เขตบางแค': { 'แขวงบางแค': '10160', 'แขวงบางแคเหนือ': '10160', 'แขวงบางไผ่': '10160', 'แขวงหลักสอง': '10160' },
        'เขตหลักสี่': { 'แขวงทุ่งสองห้อง': '10210', 'แขวงตลาดบางเขน': '10210' },
        'เขตสายไหม': { 'แขวงสายไหม': '10220', 'แขวงออเงิน': '10220', 'แขวงคลองถนน': '10220' },
        'เขตคันนายาว': { 'แขวงคันนายาว': '10230', 'แขวงรามอินทรา': '10230' },
        'เขตสะพานสูง': { 'แขวงสะพานสูง': '10240' },
        'เขตวังทองหลาง': { 'แขวงวังทองหลาง': '10310' },
        'เขตคลองสามวา': { 'แขวงสามวาตะวันตก': '10510', 'แขวงสามวาตะวันออก': '10510', 'แขวงบางชัน': '10510', 'แขวงทรายกองดิน': '10510', 'แขวงทรายกองดินใต้': '10510' },
        'เขตบางนา': { 'แขวงบางนา': '10260' },
        'เขตทวีวัฒนา': { 'แขวงทวีวัฒนา': '10170', 'แขวงศาลาธรรมสพน์': '10170' },
        'เขตทุ่งครุ': { 'แขวงบางมด': '10140', 'แขวงทุ่งครุ': '10140' },
        'เขตบางบอน': { 'แขวงบางบอน': '10150' },
    },
    'นนทบุรี': {
        'เมืองนนทบุรี': { 'ตำบลสวนใหญ่': '11000', 'ตำบลตลาดขวัญ': '11000', 'ตำบลบางเขน': '11000', 'ตำบลบางกระสอ': '11000', 'ตำบลท่าทราย': '11000', 'ตำบลบางไผ่': '11000' },
        'บางกรวย': { 'ตำบลวัดชลอ': '11130', 'ตำบลบางกรวย': '11130', 'ตำบลบางสีทอง': '11130', 'ตำบลบางขนุน': '11130', 'ตำบลบางขุนกอง': '11130', 'ตำบลบางคูเวียง': '11130', 'ตำบลมหาสวัสดิ์': '11130', 'ตำบลปลายบาง': '11130', 'ตำบลศาลากลาง': '11130' },
        'บางบัวทอง': { 'ตำบลโสนลอย': '11110', 'ตำบลบางบัวทอง': '11110', 'ตำบลบางรักใหญ่': '11110', 'ตำบลบางคูรัด': '11110', 'ตำบลละหาร': '11110', 'ตำบลลำโพ': '11110', 'ตำบลพิมลราช': '11110', 'ตำบลบางรักพัฒนา': '11110' },
        'บางใหญ่': { 'ตำบลบางใหญ่': '11140', 'ตำบลบางแม่นาง': '11140', 'ตำบลบ้านใหม่': '11140', 'ตำบลบางม่วง': '11140', 'ตำบลเสาธงหิน': '11140', 'ตำบลบางเลน': '11140' },
        'ปากเกร็ด': { 'ตำบลปากเกร็ด': '11120', 'ตำบลบางตลาด': '11120', 'ตำบลบ้านใหม่': '11120', 'ตำบลบางพูด': '11120', 'ตำบลบางตะไนย์': '11120', 'ตำบลคลองพระอุดม': '11120', 'ตำบลท่าอิฐ': '11120', 'ตำบลเกาะเกร็ด': '11120', 'ตำบลอ้อมเกร็ด': '11120', 'ตำบลคลองข่อย': '11120', 'ตำบลบางพลับ': '11120', 'ตำบลคลองเกลือ': '11120' },
        'ไทรน้อย': { 'ตำบลไทรน้อย': '11150', 'ตำบลราษฎร์นิยม': '11150', 'ตำบลหนองเพรางาย': '11150', 'ตำบลไทรใหญ่': '11150', 'ตำบลขุนศรี': '11150', 'ตำบลคลองขวาง': '11150', 'ตำบลทวีวัฒนา': '11150' },
    },
    'ปทุมธานี': {
        'เมืองปทุมธานี': { 'ตำบลบางปรอก': '12000', 'ตำบลบ้านใหม่': '12000', 'ตำบลบ้านกลาง': '12000', 'ตำบลบ้านฉาง': '12000', 'ตำบลบ้านกระแชง': '12000', 'ตำบลบางขะแยง': '12000', 'ตำบลบางคูวัด': '12000', 'ตำบลบางหลวง': '12000', 'ตำบลบางเดื่อ': '12000', 'ตำบลบางพูน': '12000', 'ตำบลบางพูด': '12000', 'ตำบลบางกะดี': '12000', 'ตำบลสวนพริกไทย': '12000', 'ตำบลหลักหก': '12000' },
        'คลองหลวง': { 'ตำบลคลองหนึ่ง': '12120', 'ตำบลคลองสอง': '12120', 'ตำบลคลองสาม': '12120', 'ตำบลคลองสี่': '12120', 'ตำบลคลองห้า': '12120', 'ตำบลคลองหก': '12120', 'ตำบลคลองเจ็ด': '12120' },
        'ธัญบุรี': { 'ตำบลประชาธิปัตย์': '12130', 'ตำบลบึงยี่โถ': '12130', 'ตำบลรังสิต': '12110', 'ตำบลลำผักกูด': '12110', 'ตำบลบึงสนั่น': '12110', 'ตำบลบึงน้ำรักษ์': '12110' },
        'ลาดหลุมแก้ว': { 'ตำบลระแหง': '12140', 'ตำบลลาดหลุมแก้ว': '12140', 'ตำบลคูบางหลวง': '12140', 'ตำบลคูขวาง': '12140', 'ตำบลคลองพระอุดม': '12140', 'ตำบลบ่อเงิน': '12140', 'ตำบลหน้าไม้': '12140' },
        'ลำลูกกา': { 'ตำบลคูคต': '12130', 'ตำบลลาดสวาย': '12150', 'ตำบลบึงคำพร้อย': '12150', 'ตำบลลำลูกกา': '12150', 'ตำบลบึงทองหลาง': '12150', 'ตำบลลำไทร': '12150', 'ตำบลบึงคอไห': '12150', 'ตำบลพืชอุดม': '12150' },
        'สามโคก': { 'ตำบลบ้านงิ้ว': '12160', 'ตำบลเชียงรากน้อย': '12160', 'ตำบลบ้านปทุม': '12160', 'ตำบลบ้านนา': '12160', 'ตำบลกระแชง': '12160', 'ตำบลบางเตย': '12160', 'ตำบลบางโพธิ์เหนือ': '12160', 'ตำบลเชียงรากใหญ่': '12160', 'ตำบลคลองควาย': '12160', 'ตำบลสามโคก': '12160', 'ตำบลท้ายเกาะ': '12160' },
        'หนองเสือ': { 'ตำบลบึงบา': '12170', 'ตำบลบึงบอน': '12170', 'ตำบลบึงกาสาม': '12170', 'ตำบลบึงชำอ้อ': '12170', 'ตำบลหนองสามวัง': '12170', 'ตำบลศาลาครุ': '12170', 'ตำบลนพรัตน์': '12170' },
    },
    'สมุทรปราการ': {
        'เมืองสมุทรปราการ': { 'ตำบลปากน้ำ': '10270', 'ตำบลสำโรงเหนือ': '10270', 'ตำบลบางเมือง': '10270', 'ตำบลท้ายบ้าน': '10280', 'ตำบลบางปูใหม่': '10280', 'ตำบลแพรกษาใหม่': '10280', 'ตำบลบางโปรง': '10270', 'ตำบลบางปู': '10280', 'ตำบลบางด้วน': '10270', 'ตำบลบางเมืองใหม่': '10270', 'ตำบลเทพารักษ์': '10270', 'ตำบลแพรกษา': '10280' },
        'บางบ่อ': { 'ตำบลบางบ่อ': '10560', 'ตำบลบ้านระกาศ': '10560', 'ตำบลบางพลีน้อย': '10560', 'ตำบลบางเพรียง': '10560', 'ตำบลคลองด่าน': '10550', 'ตำบลคลองสวน': '10560', 'ตำบลเปร็ง': '10560', 'ตำบลคลองนิยมยาตรา': '10560' },
        'บางพลี': { 'ตำบลบางพลีใหญ่': '10540', 'ตำบลบางแก้ว': '10540', 'ตำบลบางปลา': '10540', 'ตำบลบางโฉลง': '10540', 'ตำบลราชาเทวะ': '10540', 'ตำบลหนองปรือ': '10540' },
        'พระประแดง': { 'ตำบลตลาด': '10130', 'ตำบลบางพึ่ง': '10130', 'ตำบลบางจาก': '10130', 'ตำบลบางครุ': '10130', 'ตำบลบางหญ้าแพรก': '10130', 'ตำบลบางหัวเสือ': '10130', 'ตำบลสำโรงใต้': '10130', 'ตำบลสำโรง': '10130', 'ตำบลสำโรงกลาง': '10130', 'ตำบลบางยอ': '10130', 'ตำบลบางกะเจ้า': '10130', 'ตำบลบางน้ำผึ้ง': '10130', 'ตำบลบางกระสอบ': '10130', 'ตำบลบางกอบัว': '10130', 'ตำบลทรงคนอง': '10130' },
        'พระสมุทรเจดีย์': { 'ตำบลนาเกลือ': '10290', 'ตำบลบ้านคลองสวน': '10290', 'ตำบลแหลมฟ้าผ่า': '10290', 'ตำบลปากคลองบางปลากด': '10290', 'ตำบลในคลองบางปลากด': '10290' },
        'บางเสาธง': { 'ตำบลบางเสาธง': '10570', 'ตำบลศีรษะจรเข้น้อย': '10570', 'ตำบลศีรษะจรเข้ใหญ่': '10570' },
    },
    'เชียงใหม่': {
        'เมืองเชียงใหม่': { 'ตำบลศรีภูมิ': '50200', 'ตำบลพระสิงห์': '50200', 'ตำบลหายยา': '50100', 'ตำบลช้างม่อย': '50300', 'ตำบลช้างคลาน': '50100', 'ตำบลวัดเกต': '50000', 'ตำบลช้างเผือก': '50300', 'ตำบลสุเทพ': '50200', 'ตำบลแม่เหียะ': '50100', 'ตำบลป่าแดด': '50100', 'ตำบลหนองหอย': '50000', 'ตำบลท่าศาลา': '50000', 'ตำบลหนองป่าครั่ง': '50000', 'ตำบลฟ้าฮ่าม': '50000', 'ตำบลป่าตัน': '50300', 'ตำบลสันผีเสื้อ': '50300' },
        'สันกำแพง': { 'ตำบลสันกำแพง': '50130', 'ตำบลทรายมูล': '50130', 'ตำบลร้องวัวแดง': '50130', 'ตำบลบวกค้าง': '50130', 'ตำบลแช่ช้าง': '50130', 'ตำบลออนใต้': '50130', 'ตำบลแม่ปูคา': '50130', 'ตำบลห้วยทราย': '50130', 'ตำบลต้นเปา': '50130', 'ตำบลสันกลาง': '50130' },
        'สันทราย': { 'ตำบลสันทรายหลวง': '50210', 'ตำบลสันทรายน้อย': '50210', 'ตำบลสันพระเนตร': '50210', 'ตำบลสันนาเม็ง': '50210', 'ตำบลสันป่าเปา': '50210', 'ตำบลหนองแหย่ง': '50210', 'ตำบลป่าไผ่': '50210', 'ตำบลเมืองเล็น': '50210', 'ตำบลป่าตุ้ม': '50210', 'ตำบลหนองจ๊อม': '50210' },
    },
    'ขอนแก่น': {
        'เมืองขอนแก่น': { 'ตำบลในเมือง': '40000', 'ตำบลสำราญ': '40000', 'ตำบลโคกสี': '40000', 'ตำบลท่าพระ': '40260', 'ตำบลบ้านทุ่ม': '40000', 'ตำบลเมืองเก่า': '40000', 'ตำบลพระลับ': '40000', 'ตำบลสาวะถี': '40000', 'ตำบลบ้านหว้า': '40000' },
    },
    'นครราชสีมา': {
        'เมืองนครราชสีมา': { 'ตำบลในเมือง': '30000', 'ตำบลโพธิ์กลาง': '30000', 'ตำบลหนองจะบก': '30000', 'ตำบลปรุใหญ่': '30000', 'ตำบลหัวทะเล': '30000', 'ตำบลบ้านเกาะ': '30000', 'ตำบลจอหอ': '30310', 'ตำบลบ้านใหม่': '30000', 'ตำบลพุดซา': '30000' },
    },
    'เชียงราย': {
        'เมืองเชียงราย': { 'ตำบลเวียง': '57000', 'ตำบลรอบเวียง': '57000', 'ตำบลบ้านดู่': '57100', 'ตำบลนางแล': '57100', 'ตำบลแม่ข้าวต้ม': '57100', 'ตำบลแม่ยาว': '57100', 'ตำบลสันทราย': '57000' },
    },
    'ภูเก็ต': {
        'เมืองภูเก็ต': { 'ตำบลตลาดใหญ่': '83000', 'ตำบลตลาดเหนือ': '83000', 'ตำบลเกาะแก้ว': '83000', 'ตำบลรัษฎา': '83000', 'ตำบลวิชิต': '83000', 'ตำบลฉลอง': '83130', 'ตำบลราไวย์': '83130', 'ตำบลกะรน': '83100' },
        'กะทู้': { 'ตำบลกะทู้': '83120', 'ตำบลป่าตอง': '83150', 'ตำบลกมลา': '83150' },
        'ถลาง': { 'ตำบลเทพกระษัตรี': '83110', 'ตำบลศรีสุนทร': '83110', 'ตำบลเชิงทะเล': '83110', 'ตำบลป่าคลอก': '83110', 'ตำบลไม้ขาว': '83110', 'ตำบลสาคู': '83110' },
    },
    'สงขลา': {
        'เมืองสงขลา': { 'ตำบลบ่อยาง': '90000', 'ตำบลเขารูปช้าง': '90000', 'ตำบลเกาะแต้ว': '90000', 'ตำบลพะวง': '90100', 'ตำบลทุ่งหวัง': '90000' },
        'หาดใหญ่': { 'ตำบลหาดใหญ่': '90110', 'ตำบลควนลัง': '90110', 'ตำบลคูเต่า': '90110', 'ตำบลคอหงส์': '90110', 'ตำบลคลองแห': '90110', 'ตำบลคลองอู่ตะเภา': '90110', 'ตำบลฉลุง': '90110', 'ตำบลทุ่งใหญ่': '90110', 'ตำบลทุ่งตำเสา': '90110', 'ตำบลท่าข้าม': '90110', 'ตำบลน้ำน้อย': '90110', 'ตำบลบ้านพรุ': '90250', 'ตำบลพะตง': '90230' },
    },
    'อุดรธานี': {
        'เมืองอุดรธานี': { 'ตำบลหมากแข้ง': '41000', 'ตำบลนิเวศน์': '41000', 'ตำบลบ้านตาด': '41000', 'ตำบลหนองบัว': '41000', 'ตำบลบ้านจั่น': '41000', 'ตำบลหนองนาคำ': '41000', 'ตำบลบ้านเลื่อม': '41000', 'ตำบลเชียงยืน': '41000' },
    },
};

let addressData = TH_ADDRESS_DATA;

function initAddressDropdowns() {
    const provinceEl = document.getElementById('province');
    const districtEl = document.getElementById('district');
    const subdistrictEl = document.getElementById('subdistrict');
    const zipEl = document.getElementById('zip');
    if (!provinceEl) return;

    // Populate provinces
    Object.keys(addressData).sort().forEach(prov => {
        const opt = document.createElement('option');
        opt.value = prov;
        opt.textContent = prov;
        provinceEl.appendChild(opt);
    });

    // Province change -> populate districts
    provinceEl.addEventListener('change', () => {
        const prov = provinceEl.value;
        districtEl.innerHTML = '<option value="">เลือกอำเภอ / เขต</option>';
        subdistrictEl.innerHTML = '<option value="">เลือกตำบล / แขวง</option>';
        subdistrictEl.disabled = true;

        if (prov && addressData[prov]) {
            districtEl.disabled = false;
            Object.keys(addressData[prov]).sort().forEach(dist => {
                const opt = document.createElement('option');
                opt.value = dist;
                opt.textContent = dist;
                districtEl.appendChild(opt);
            });
        } else {
            districtEl.disabled = true;
        }
        syncHiddenFields();
    });

    // District change -> populate subdistricts
    districtEl.addEventListener('change', () => {
        const prov = provinceEl.value;
        const dist = districtEl.value;
        subdistrictEl.innerHTML = '<option value="">เลือกตำบล / แขวง</option>';

        if (prov && dist && addressData[prov] && addressData[prov][dist]) {
            subdistrictEl.disabled = false;
            Object.keys(addressData[prov][dist]).sort().forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = sub;
                subdistrictEl.appendChild(opt);
            });
        } else {
            subdistrictEl.disabled = true;
        }
        syncHiddenFields();
    });

    // Subdistrict change -> auto-fill zip
    subdistrictEl.addEventListener('change', () => {
        const prov = provinceEl.value;
        const dist = districtEl.value;
        const sub = subdistrictEl.value;
        if (prov && dist && sub && addressData[prov]?.[dist]?.[sub]) {
            zipEl.value = addressData[prov][dist][sub];
        }
        syncHiddenFields();
    });

    // Sync full-name to hidden first/last name
    const fullNameEl = document.getElementById('full-name');
    if (fullNameEl) {
        fullNameEl.addEventListener('input', () => {
            const parts = fullNameEl.value.trim().split(' ');
            document.getElementById('first-name').value = parts[0] || '';
            document.getElementById('last-name').value = parts.slice(1).join(' ') || '';
        });
    }
}

function syncHiddenFields() {
    const provinceEl = document.getElementById('province');
    const districtEl = document.getElementById('district');
    document.getElementById('state').value = provinceEl?.value || '';
    document.getElementById('city').value = districtEl?.value || '';
}

function onZipChange(zip) {
    if (zip.length !== 5) return;
    for (const [prov, districts] of Object.entries(addressData)) {
        for (const [dist, subs] of Object.entries(districts)) {
            for (const [sub, code] of Object.entries(subs)) {
                if (code === zip) {
                    const provinceEl = document.getElementById('province');
                    provinceEl.value = prov;
                    provinceEl.dispatchEvent(new Event('change'));
                    setTimeout(() => {
                        const districtEl = document.getElementById('district');
                        districtEl.value = dist;
                        districtEl.dispatchEvent(new Event('change'));
                        setTimeout(() => {
                            document.getElementById('subdistrict').value = sub;
                            syncHiddenFields();
                        }, 50);
                    }, 50);
                    return;
                }
            }
        }
    }
}
