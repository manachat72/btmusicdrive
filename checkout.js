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
                    ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-16 h-16 object-cover rounded-lg border border-gray-100">`
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

function selectPaymentMethod(method) {
    const methods = ['card', 'promptpay', 'truemoney'];
    
    methods.forEach(m => {
        const box = document.getElementById(`payment-box-${m}`);
        const labelText = box.querySelector('span');
        
        if (m === method) {
            box.classList.remove('border-gray-200', 'opacity-70');
            box.classList.add('border-2', 'border-primary', 'shadow-sm');
            labelText.classList.remove('text-gray-700');
            labelText.classList.add('text-gray-900');
        } else {
            box.classList.remove('border-2', 'border-primary', 'shadow-sm');
            box.classList.add('border-gray-200', 'opacity-70');
            labelText.classList.add('text-gray-700');
            labelText.classList.remove('text-gray-900');
        }
    });

    const cardForm = document.getElementById('inline-card-form');
    if (method === 'card') {
        cardForm.classList.remove('hidden');
    } else {
        cardForm.classList.add('hidden');
    }
}

function switchPayment(method) {
    // This is the old tab function, kept for backward compatibility if used anywhere else
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
            showPromoError(`โค้ดส่วนลด "${code}" ไม่ถูกต้อง`);
            btn.disabled = false;
            btn.textContent = 'ใช้โค้ด';
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
        { id: 'first-name', label: 'ชื่อ' },
        { id: 'last-name', label: 'นามสกุล' },
        { id: 'email', label: 'อีเมล' },
        { id: 'phone', label: 'เบอร์โทรศัพท์' },
        { id: 'address', label: 'ที่อยู่' },
        { id: 'city', label: 'เขต/อำเภอ' },
        { id: 'state', label: 'จังหวัด' },
        { id: 'zip', label: 'รหัสไปรษณีย์' },
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

// Initialize Omise
Omise.setPublicKey('pkey_test_674nw670v7znhhl0h6x');

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
    
    const totalText = document.getElementById('total-price').textContent.replace('฿', '').replace(/,/g, '');
    const amountInSatangs = Math.round(parseFloat(totalText) * 100);

    const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;

    setLoading(btn, true);
    setLoading(btnMobile, true);

    if (paymentMethod === 'card') {
        const num = document.getElementById('cc-number').value.replace(/\s+/g, '');
        const name = document.getElementById('cc-name').value;
        const expiry = document.getElementById('cc-expiry').value.split('/');
        const month = expiry[0] ? expiry[0].trim() : '';
        const yearVal = expiry[1] ? expiry[1].trim() : '';
        const year = yearVal.length === 2 ? '20' + yearVal : yearVal; // Convert YY to YYYY
        const cvv = document.getElementById('cc-cvv').value;

        if (!num || !name || !month || !year || !cvv) {
            showError('กรุณากรอกข้อมูลบัตรให้ครบถ้วน');
            setLoading(btn, false);
            setLoading(btnMobile, false);
            return;
        }

        Omise.createToken('card', {
            name: name,
            number: num,
            expiration_month: month,
            expiration_year: year,
            security_code: cvv
        }, (statusCode, response) => {
            if (statusCode === 200) {
                processCheckout(response.id);
            } else {
                showError(response.message || 'เกิดข้อผิดพลาดกับข้อมูลบัตรของคุณ');
                setLoading(btn, false);
                setLoading(btnMobile, false);
            }
        });
    } else {
        // PromptPay or TrueMoney
        Omise.createSource(paymentMethod, {
            amount: amountInSatangs,
            currency: 'THB'
        }, (statusCode, response) => {
            if (statusCode === 200) {
                processCheckout(response.id);
            } else {
                showError(response.message || 'เกิดข้อผิดพลาดในการสร้างรายการชำระเงิน');
                setLoading(btn, false);
                setLoading(btnMobile, false);
            }
        });
    }
}

async function processCheckout(omiseToken) {
    const token = localStorage.getItem('btmusicdrive_token');
    const btn = document.getElementById('place-order-btn');
    const btnMobile = document.getElementById('place-order-btn-mobile');
    setLoading(btn, true);
    setLoading(btnMobile, true);
    const normalizedPhone = document.getElementById('phone').value.trim().replace(/\D/g, '');

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
                omiseToken,
                phone: normalizedPhone,
                shippingAddress,
                ...(appliedPromo ? { promoCode: appliedPromo.code } : {})
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'ไม่สามารถชำระเงินได้ กรุณาลองอีกครั้ง');
            setLoading(btn, false);
            setLoading(btnMobile, false);
            return;
        }

        if (data.authorizeUri) {
            window.location.href = data.authorizeUri;
        } else if (data.orderId) {
            window.location.href = `checkout.html?status=success&invoice_no=${encodeURIComponent(data.invoiceNo)}`;
        }

    } catch (e) {
        console.error('Checkout error:', e);
        showError('เกิดข้อผิดพลาดเครือข่าย กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง');
        setLoading(btn, false);
        setLoading(btnMobile, false);
    }
}

// ── Status Checking ──────────────────────────────────────────────────────────

async function checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const invoiceNo = urlParams.get('invoice_no');

    if ((status === 'success' || status === 'pending') && invoiceNo) {
        // Clean up URL immediately
        window.history.replaceState({}, document.title, window.location.pathname);

        // Confirm payment with backend to create the DB order
        const token = localStorage.getItem('btmusicdrive_token');
        let orderId = invoiceNo.slice(-8).toUpperCase();
        let isPending = status === 'pending';

        if (token) {
            try {
                const res = await fetch(`${API_BASE}/payment/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ invoiceNo })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'pending') {
                        isPending = true;
                    } else {
                        orderId = data.id ? data.id.slice(-8).toUpperCase() : orderId;
                    }
                }
            } catch (e) {
                console.warn('Could not confirm order with backend:', e);
            }
        }

        // Clear cart everywhere
        cart = [];
        localStorage.removeItem('cart');

        if (isPending) {
            // Show pending modal for QR / async payment
            const modalContent = document.querySelector('#success-modal .text-center') || document.querySelector('#success-modal > div > div');
            if (modalContent) {
                const icon = modalContent.querySelector('.ph-check-circle, .ph-seal-check');
                if (icon) { icon.className = 'ph ph-clock-countdown text-5xl text-primary'; }
                const title = modalContent.querySelector('h2');
                if (title) { title.textContent = 'กำลังตรวจสอบการชำระเงิน'; }
                const desc = modalContent.querySelector('p');
                if (desc) { desc.textContent = 'กำลังตรวจสอบการชำระเงินของคุณ คุณจะได้รับอีเมลยืนยันเมื่อการชำระเงินสำเร็จ'; }
            }
            document.getElementById('order-id-display').textContent = 'รอการชำระเงิน';
            document.getElementById('success-modal').classList.remove('hidden');
            document.getElementById('success-modal').classList.add('flex');
        } else {
            // Show success modal
            document.getElementById('order-id-display').textContent = `คำสั่งซื้อ #${orderId}`;
            document.getElementById('success-modal').classList.remove('hidden');
            document.getElementById('success-modal').classList.add('flex');
        }

    } else if (status === 'cancelled') {
        showError('การชำระเงินถูกยกเลิก คุณสามารถลองอีกครั้งเมื่อพร้อม');
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
