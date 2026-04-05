// Global State
const state = {
    pricePerOz: 2450.00,
    usdcAmount: 1000,
    goldAmount: 1000 / 2450.00,
    totalGold: 0,
    settlementInterval: null,
    isSettling: false,
    orderSeq: 0,
    /** @type {{ id: number, totalUsdc: number, goldAmount: number } | null} */
    pendingOrder: null,
    /** Most recent first — { id, totalUsdc, goldAmount, success, endedAt } */
    completedGoldOrders: []
};

const TAB_SCREENS = {
    cash: 'screen-cash',
    invest: 'screen-list',
    borrow: 'screen-borrow',
    activities: 'screen-activities',
    browser: 'screen-browser'
};

const INVESTMENT_SCREENS = new Set([
    'screen-list',
    'screen-detail',
    'screen-buy',
    'screen-review',
    'screen-confirmed',
    'screen-position'
]);

function setTabNavActive(tab) {
    document.querySelectorAll('#bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}

function navToTab(tab) {
    const screenId = TAB_SCREENS[tab];
    if (!screenId) return;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    setTabNavActive(tab);

    document.getElementById('push-notification').classList.add('hidden');
}

function navTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (INVESTMENT_SCREENS.has(screenId)) {
        setTabNavActive('invest');
    }

    document.getElementById('push-notification').classList.add('hidden');
}

function formatSessionOrderTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * @param {{ id: number, totalUsdc: number, goldAmount: number, endedAt?: number }} order
 * @param {'pending' | 'completed' | 'failed'} mode
 */
function createGoldFeedRow(order, mode) {
    const row = document.createElement('div');
    row.className = 'feed-item';
    if (mode === 'pending') row.classList.add('pending');
    if (mode === 'failed') row.classList.add('feed-error');

    const left = document.createElement('div');
    left.className = 'feed-item-left';

    const icon = document.createElement('div');
    icon.className = 'feed-icon';
    if (mode === 'pending') {
        icon.classList.add('spinner');
        icon.textContent = '🪙';
    } else if (mode === 'failed') {
        icon.textContent = '⚠️';
    } else {
        icon.textContent = '🪙';
    }
    left.appendChild(icon);

    const content = document.createElement('div');
    content.className = 'feed-content';
    const strong = document.createElement('strong');
    strong.textContent = 'Bought Gold';
    const span = document.createElement('span');
    if (mode === 'pending') {
        span.textContent = 'Securing... usually ~7 min';
    } else if (mode === 'failed') {
        span.textContent = `Failed · ${formatSessionOrderTime(order.endedAt)}`;
    } else {
        span.textContent = `Completed · ${formatSessionOrderTime(order.endedAt)}`;
    }
    content.appendChild(strong);
    content.appendChild(span);
    left.appendChild(content);

    const amount = document.createElement('div');
    amount.className = 'feed-amount';
    amount.textContent = `${order.totalUsdc.toFixed(2)} USDC`;

    row.appendChild(left);
    row.appendChild(amount);
    return row;
}

function renderGoldActivityFeed() {
    const feedPending = document.getElementById('feed-pending');
    const sectionPending = document.getElementById('section-pending');
    const feedGold = document.getElementById('feed-completed-gold');

    feedPending.innerHTML = '';
    if (state.pendingOrder) {
        sectionPending.style.display = 'block';
        feedPending.appendChild(createGoldFeedRow(state.pendingOrder, 'pending'));
    } else {
        sectionPending.style.display = 'none';
    }

    feedGold.innerHTML = '';
    for (const o of state.completedGoldOrders) {
        feedGold.appendChild(createGoldFeedRow(o, o.success ? 'completed' : 'failed'));
    }
}

function submitAmount() {
    const input = document.getElementById('buy-amount').value;
    const orderAmount = parseFloat(input) || 0;
    const feeAmount = orderAmount * 0.01;

    state.usdcAmount = orderAmount + feeAmount;
    state.goldAmount = orderAmount / state.pricePerOz;

    document.getElementById('review-amount').textContent = `${orderAmount.toFixed(2)} USDC`;
    document.getElementById('review-fee').textContent = `${feeAmount.toFixed(2)} USDC`;

    const estGold = state.goldAmount;
    const minGold = state.goldAmount * 0.99;

    document.getElementById('review-gold-est').textContent = `${estGold.toFixed(3)} oz Gold`;
    document.getElementById('review-gold-min').textContent = `${minGold.toFixed(3)} oz Gold`;
    document.getElementById('review-usdc').textContent = `${state.usdcAmount.toFixed(2)} USDC`;

    navTo('screen-review');
}

function confirmOrder() {
    const btn = document.getElementById('btn-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span>Processing...';

    setTimeout(() => {
        const order = {
            id: ++state.orderSeq,
            totalUsdc: state.usdcAmount,
            goldAmount: state.goldAmount
        };
        state.pendingOrder = order;
        renderGoldActivityFeed();

        btn.disabled = false;
        btn.textContent = 'Confirm Purchase';

        navTo('screen-confirmed');
        startSettlementSimulation();
    }, 1500);
}

function resetApp() {
    clearInterval(state.settlementInterval);
    state.isSettling = false;
    state.orderSeq = 0;
    state.pendingOrder = null;
    state.completedGoldOrders = [];
    document.getElementById('buy-amount').value = 1000;
    document.getElementById('push-notification').classList.add('hidden');

    document.getElementById('section-pending').style.display = 'none';
    renderGoldActivityFeed();

    navToTab('cash');
}

function startSettlementSimulation() {
    if (state.isSettling) return;
    state.isSettling = true;

    const willFail = document.getElementById('dev-force-failure').checked;

    setTimeout(() => {
        if (!state.isSettling) return;

        const order = state.pendingOrder;
        state.pendingOrder = null;

        if (!order) {
            state.isSettling = false;
            renderGoldActivityFeed();
            return;
        }

        const endedAt = Date.now();
        state.completedGoldOrders.unshift({
            id: order.id,
            totalUsdc: order.totalUsdc,
            goldAmount: order.goldAmount,
            success: !willFail,
            endedAt
        });
        renderGoldActivityFeed();

        if (willFail) {
            handleFailure();
        } else {
            handleSuccess();
        }
    }, 5500);
}

function handleSuccess() {
    state.isSettling = false;
    state.totalGold += state.goldAmount;

    document.getElementById('pos-gold').textContent = `${state.totalGold.toFixed(3)} oz`;
    document.getElementById('pos-usdc').textContent = `≈ ${(state.totalGold * state.pricePerOz).toFixed(2)} USDC`;

    showPush('Your gold is ready 🎉 Tap to see your position.', () => {
        navTo('screen-position');
    });
}

function handleFailure() {
    state.isSettling = false;
    showPush('Gold order didn\'t complete. Tap to retry.', () => {
        navTo('screen-buy');
    });
}

function showPush(message, onClick) {
    const push = document.getElementById('push-notification');
    const pushBody = document.getElementById('push-body');

    pushBody.textContent = message;
    push.classList.remove('hidden');

    push.onclick = () => {
        push.classList.add('hidden');
        if (onClick) onClick();
    };

    setTimeout(() => {
        push.classList.add('hidden');
    }, 5000);
}

document.getElementById('buy-amount').addEventListener('input', function () {
    const inputAmount = parseFloat(this.value) || 0;
    const feeAmount = inputAmount * 0.01;
    document.getElementById('buy-fee-display').textContent = `${feeAmount.toFixed(2)} USDC`;
});

navToTab('cash');
renderGoldActivityFeed();
drawGoldChart();

function drawGoldChart() {
    const canvas = document.getElementById('gold-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Simulated gold price data (6 months trend, upward)
    const data = [
        2280, 2310, 2295, 2330, 2320, 2355, 2340, 2370, 2360, 2385,
        2375, 2390, 2410, 2395, 2420, 2405, 2430, 2415, 2440, 2425,
        2450, 2435, 2460, 2445, 2470, 2455, 2480, 2465, 2490, 2450
    ];

    const min = Math.min(...data) - 20;
    const max = Math.max(...data) + 20;
    const padTop = 20;
    const padBottom = 30;
    const padLeft = 10;
    const padRight = 10;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const toX = (i) => padLeft + (i / (data.length - 1)) * chartW;
    const toY = (v) => padTop + chartH - ((v - min) / (max - min)) * chartH;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#E5E5EA';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padTop + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.stroke();
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    grad.addColorStop(0, 'rgba(232, 115, 42, 0.15)');
    grad.addColorStop(1, 'rgba(232, 115, 42, 0)');

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(toX(i), toY(data[i]));
    }
    ctx.lineTo(toX(data.length - 1), h - padBottom);
    ctx.lineTo(toX(0), h - padBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(toX(i), toY(data[i]));
    }
    ctx.strokeStyle = '#E8732A';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // End dot
    const lastX = toX(data.length - 1);
    const lastY = toY(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#E8732A';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // X-axis labels
    const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    ctx.fillStyle = '#8E8E93';
    ctx.font = '11px Barlow, sans-serif';
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
        const x = padLeft + (i / (months.length - 1)) * chartW;
        ctx.fillText(m, x, h - 8);
    });
}
