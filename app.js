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
    investments: 'screen-list',
    borrow: 'screen-borrow',
    rewards: 'screen-rewards',
    activities: 'screen-activities'
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
        setTabNavActive('investments');
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
    const order = {
        id: ++state.orderSeq,
        totalUsdc: state.usdcAmount,
        goldAmount: state.goldAmount
    };
    state.pendingOrder = order;
    renderGoldActivityFeed();

    navTo('screen-confirmed');
    startSettlementSimulation();
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
