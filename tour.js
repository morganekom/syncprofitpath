// ================================================================
// TOUR.JS — Guided tour engine + "What's New" banner (dashboard)
//
//  • Welcome tour: starts automatically for accounts created after
//    TOUR_AUTOSTART_AFTER, replayable from the "Take a tour" link.
//  • What's New: admin-written announcements show as a banner. "Show me"
//    runs only the tour steps attached to that announcement.
//  • Progress is stored per user in public.tour_progress.
//  • If the tables do not exist yet, everything stays silent.
// ================================================================

(function () {
    // Existing accounts never get the welcome tour automatically.
    const TOUR_AUTOSTART_AFTER = '2026-10-13T00:00:00Z';

    // Keys admin can pick from. Elements are tagged with data-tour="key" in dashboard/index.html.
    const TARGETS = {
        none:         { label: 'No highlight (centered message)' },
        balance:      { label: 'Account balance' },
        deposit:      { label: 'Deposit button' },
        withdraw:     { label: 'Withdraw button' },
        stats:        { label: 'Profit and deposit totals' },
        quickactions: { label: 'Quick actions row' },
        markets:      { label: 'Live markets' },
        activeinv:    { label: 'Active investments' },
        bell:         { label: 'Notification bell' },
        chat:         { label: 'Support chat button' },
        nav_invest:   { label: 'Menu: Investment Plans', sidebar: true },
        nav_deposit:  { label: 'Menu: Deposit', sidebar: true },
        nav_withdraw: { label: 'Menu: Withdraw', sidebar: true },
        nav_history:  { label: 'Menu: Transactions', sidebar: true },
        nav_refer:    { label: 'Menu: Refer & Earn', sidebar: true },
        nav_settings: { label: 'Menu: Settings', sidebar: true },
        // Page walkthrough targets (deposit, invest, withdraw pages)
        dep_coins:  { label: 'Deposit: coins' },
        dep_wallet: { label: 'Deposit: wallet' },
        dep_amount: { label: 'Deposit: amount' },
        dep_proof:  { label: 'Deposit: proof' },
        dep_submit: { label: 'Deposit: submit' },
        inv_hero:   { label: 'Invest: header' },
        inv_plans:  { label: 'Invest: plans' },
        wd_empty:   { label: 'Withdraw: no details' },
        wd_balance: { label: 'Withdraw: balance' },
        wd_method:  { label: 'Withdraw: method' },
        wd_amount:  { label: 'Withdraw: amount' },
        wd_submit:  { label: 'Withdraw: submit' },
    };

    const WELCOME_STEPS = [
        { target: 'none',         title: 'Welcome to SyncProfitPath',
          text: 'Here is a quick tour of where everything lives. It takes under a minute, and you can skip it at any time.' },
        { target: 'balance',      title: 'Your balance',
          text: 'This is the money available in your account. It updates as deposits are approved and profits are paid.' },
        { target: 'deposit',      title: 'Add funds',
          text: 'Start here. Choose a coin, send your payment and upload the proof. We credit your balance once it is confirmed.' },
        { target: 'nav_invest',   title: 'Pick an investment plan',
          text: 'Open Investment Plans to choose between Crypto, Stocks and Real Estate. Each plan shows its daily return and duration.' },
        { target: 'stats',        title: 'Track your growth',
          text: 'Your total profit, deposits, withdrawals and daily interest are summarised here.' },
        { target: 'activeinv',    title: 'Active investments',
          text: 'Every running investment appears here with its progress, so you always know when it matures.' },
        { target: 'withdraw',     title: 'Withdraw your money',
          text: 'When you are ready to cash out, use Withdraw. Your payout details are saved for next time.' },
        { target: 'nav_history',  title: 'Full history',
          text: 'Every deposit, investment and withdrawal is listed under Transactions, with its status.' },
        { target: 'nav_settings', title: 'Verify your identity',
          text: 'Open Settings to complete KYC verification, update your profile and set up your withdrawal details.' },
        { target: 'bell',         title: 'Notifications',
          text: 'Approvals, payouts and new feature announcements show up here.' },
        { target: 'chat',         title: 'Need help?',
          text: 'Chat with our support team any time from this button.' },
        { target: 'none',         title: 'You are all set',
          text: 'Start with a deposit, then choose a plan. You can replay this tour any time from the Take a tour button.' },
    ];

    // Step-by-step guides for the deposit, invest and withdraw pages.
    // Steps whose target is not on screen (for example the withdraw form when
    // no payout details are saved) are skipped automatically.
    const GUIDES = {
        deposit: {
            key: 'guide:deposit',
            button: '.deposit-page-header p',
            steps: [
                { target: 'none',       title: 'How to make a deposit',
                  text: 'Depositing takes four quick steps: choose a coin, send the payment, enter the amount, then upload your proof.' },
                { target: 'dep_coins',  title: '1. Choose a coin',
                  text: 'Pick the cryptocurrency you want to pay with. Choose one you already hold in your own wallet.' },
                { target: 'dep_wallet', title: '2. Send your payment',
                  text: 'After you pick a coin, its wallet address and QR code appear here. Copy the address or scan the code, then send the payment from your own wallet on the network shown.' },
                { target: 'dep_amount', title: '3. Enter the amount',
                  text: 'Type how much you sent. You can pick your own currency and we show the USD value that will be credited.' },
                { target: 'dep_proof',  title: '4. Upload your proof',
                  text: 'Attach a screenshot or receipt of the transaction (max 5MB). This lets us confirm your payment quickly.' },
                { target: 'dep_submit', title: 'Submit',
                  text: 'Review and submit. Your balance is credited once the payment is confirmed. You can follow its status under Transactions.' },
            ],
        },
        invest: {
            key: 'guide:invest',
            button: '.inv-hero-tagline',
            ready: () => { const g = document.getElementById('plansGrid'); return g && g.style.display !== 'none' && g.children.length > 0; },
            steps: [
                { target: 'none',      title: 'How to invest',
                  text: 'Investing uses the balance in your account, so make a deposit first if your balance is empty.' },
                { target: 'inv_hero',  title: 'Daily returns',
                  text: 'Each category shows the range of daily returns its plans can earn.' },
                { target: 'inv_plans', title: 'Choose a plan',
                  text: 'Every card shows the minimum and maximum amount, the daily return and how long the plan runs. Pick the one that fits your budget.' },
                { target: 'inv_plans', title: 'Start investing',
                  text: 'Press the Invest button on a plan and enter your amount. A preview shows your daily return and total return before you confirm. Submitted investments are reviewed, then become active.' },
                { target: 'none',      title: 'Follow your investment',
                  text: 'Active investments appear on your Dashboard with their progress. When a plan matures, the capital and profit are paid to your balance.' },
            ],
        },
        withdraw: {
            key: 'guide:withdraw',
            button: '.withdraw-section > h1',
            ready: () => ['withdrawForm', 'withdrawEmpty'].some(id => { const e = document.getElementById(id); return e && e.getBoundingClientRect().height > 0; }),
            steps: [
                { target: 'none',       title: 'How to withdraw',
                  text: 'Withdrawals go to the bank account or crypto wallet saved in your Settings.' },
                { target: 'wd_empty',   title: 'Add your payout details first',
                  text: 'You have not saved a bank account or wallet yet. Open Settings, add your details, then come back to withdraw.' },
                { target: 'wd_balance', title: 'Your available balance',
                  text: 'This is the most you can withdraw right now.' },
                { target: 'wd_method',  title: 'Choose a method',
                  text: 'Select Bank Account or Crypto Wallet. The saved details for each are shown so you can check them before sending.' },
                { target: 'wd_amount',  title: 'Enter the amount',
                  text: 'Type how much to withdraw. It cannot be more than your available balance.' },
                { target: 'wd_submit',  title: 'Request the withdrawal',
                  text: 'Review the summary and confirm. Requests are reviewed and processed within 1 to 3 business days, and you can track them under Transactions.' },
            ],
        },
    };

    // ── helpers ─────────────────────────────────────────────────
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function currentUserId() {
        try { return (JSON.parse(localStorage.getItem('currentUser') || 'null') || {}).id || null; }
        catch (e) { return null; }
    }

    async function getProgress(uid) {
        try {
            const { data, error } = await db.from('tour_progress').select('key').eq('user_id', uid);
            if (error) return null;
            return new Set((data || []).map(r => r.key));
        } catch (e) { return null; }
    }

    async function markDone(uid, key) {
        try {
            await db.from('tour_progress').upsert({ user_id: uid, key }, { onConflict: 'user_id,key' });
        } catch (e) { /* best effort */ }
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ── tour engine ─────────────────────────────────────────────
    let layer = null, spot = null, tip = null;
    let list = [], idx = 0, token = 0, openedSidebar = false, onEnd = null;

    function targetEl(step) {
        const t = TARGETS[step.target];
        if (!t || step.target === 'none') return null;
        return document.querySelector('[data-tour="' + step.target + '"]');
    }

    function usable(step) {
        if (!step.target || step.target === 'none' || !TARGETS[step.target]) return true;
        const el = targetEl(step);
        if (!el) return false;
        if (TARGETS[step.target].sidebar) return true;      // sidebar may be off-canvas on mobile
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function sidebarVisible() {
        const sb = document.querySelector('.sidebar');
        if (!sb) return false;
        if (getComputedStyle(sb).display === 'none') return false;
        const r = sb.getBoundingClientRect();
        return r.right > 20 && r.left < window.innerWidth - 20;
    }

    function start(steps, opts) {
        end(false, true);                        // clear any tour in progress
        list = (steps || []).filter(s => s && (s.title || s.text)).filter(usable);
        if (!list.length) return;
        onEnd = (opts && opts.onEnd) || null;
        idx = 0;

        layer = document.createElement('div');
        layer.className = 'tour-layer';
        layer.innerHTML = '<div class="tour-block"></div><div class="tour-spot tour-spot--none"></div>' +
                          '<div class="tour-tip" role="dialog" aria-live="polite"></div>';
        document.body.appendChild(layer);
        spot = layer.querySelector('.tour-spot');
        tip  = layer.querySelector('.tour-tip');

        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        document.addEventListener('keydown', onKey);
        show(0, 1);
    }

    function onKey(e) {
        if (!layer) return;
        if (e.key === 'Escape') end(false);
        else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
    }

    function go(d) {
        const n = idx + d;
        if (n >= list.length) return end(true);
        if (n < 0) return;
        show(n, d);
    }

    async function show(i, dir) {
        const my = ++token;
        idx = i;
        const step = list[i];
        const t = TARGETS[step.target];
        const wantsSidebar = !!(t && t.sidebar);

        if (typeof openSidebar === 'function') {
            if (wantsSidebar && !sidebarVisible()) {
                openSidebar(); openedSidebar = true; await sleep(380);
            } else if (!wantsSidebar && openedSidebar) {
                closeSidebar(); openedSidebar = false; await sleep(380);
            }
        }
        if (my !== token || !layer) return;

        const el = targetEl(step);
        if (el && !wantsSidebar) el.scrollIntoView({ block: 'center', inline: 'nearest' });

        tip.style.opacity = '0';
        tip.innerHTML =
            '<div class="tour-dots">' + list.map((_, k) => '<i class="' + (k === i ? 'on' : '') + '"></i>').join('') + '</div>' +
            '<h4>' + esc(step.title) + '</h4><p>' + esc(step.text) + '</p>' +
            '<div class="tour-foot">' +
              '<span class="tour-count">' + (i + 1) + ' of ' + list.length + '</span>' +
              (i < list.length - 1 ? '<button class="tour-skip" data-a="skip">Skip</button>' : '') +
              (i > 0 ? '<button class="tour-btn tour-btn--ghost" data-a="back">Back</button>' : '') +
              '<button class="tour-btn" data-a="next">' + (i === list.length - 1 ? 'Done' : 'Next') + '</button>' +
            '</div>';
        tip.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
            const a = b.getAttribute('data-a');
            if (a === 'skip') end(false); else go(a === 'back' ? -1 : 1);
        }));

        place(el);
        requestAnimationFrame(() => { if (tip) tip.style.opacity = '1'; });
    }

    function place(el) {
        if (!layer) return;
        const vw = window.innerWidth, vh = window.innerHeight, pad = 12;
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let top, left;

        if (!el) {
            spot.className = 'tour-spot tour-spot--none';
            Object.assign(spot.style, { top: vh / 2 + 'px', left: vw / 2 + 'px', width: '0px', height: '0px' });
            top = (vh - th) / 2; left = (vw - tw) / 2;
        } else {
            const r = el.getBoundingClientRect(), g = 6;
            spot.className = 'tour-spot';
            Object.assign(spot.style, {
                top: r.top - g + 'px', left: r.left - g + 'px',
                width: r.width + g * 2 + 'px', height: r.height + g * 2 + 'px',
            });
            const sidebarTarget = !!el.closest('.sidebar');
            if (sidebarTarget && r.right + 16 + tw <= vw - pad) {
                left = r.right + 16; top = r.top + r.height / 2 - th / 2;
            } else if (r.bottom + 14 + th <= vh - pad) {
                top = r.bottom + 14; left = r.left;
            } else if (r.top - 14 - th >= pad) {
                top = r.top - 14 - th; left = r.left;
            } else {
                top = vh - th - pad; left = r.left;
            }
        }
        left = Math.max(pad, Math.min(left, vw - tw - pad));
        top  = Math.max(pad, Math.min(top,  vh - th - pad));
        tip.style.left = left + 'px';
        tip.style.top  = top + 'px';
    }

    let raf = 0;
    function reposition() {
        if (!layer || raf) return;
        raf = requestAnimationFrame(() => { raf = 0; if (layer) place(targetEl(list[idx])); });
    }

    function end(completed, silent) {
        if (!layer) return;
        token++;
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
        document.removeEventListener('keydown', onKey);
        layer.remove(); layer = spot = tip = null;
        if (openedSidebar && typeof closeSidebar === 'function') closeSidebar();
        openedSidebar = false;
        const cb = onEnd; onEnd = null;
        if (!silent && cb) cb(completed);
    }

    // ── welcome tour ────────────────────────────────────────────
    function startWelcome() {
        const uid = currentUserId();
        start(WELCOME_STEPS, { onEnd: () => { if (uid) markDone(uid, 'welcome'); } });
    }

    // ── What's New banner ───────────────────────────────────────
    async function loadBanner(uid, progress, userCreated) {
        const slot = document.getElementById('whatsNewSlot');
        if (!slot) return;
        let items = [];
        try {
            const { data, error } = await db.from('announcements')
                .select('id, title, body, link_url, link_label, steps, created_at')
                .eq('is_active', true).order('created_at', { ascending: false }).limit(10);
            if (error) return;
            items = data || [];
        } catch (e) { return; }

        // Only announcements newer than the account, and not seen yet
        const queue = items.filter(a =>
            !progress.has('ann:' + a.id) &&
            (!userCreated || new Date(a.created_at) > new Date(userCreated)));

        renderNext();

        function renderNext() {
            slot.innerHTML = '';
            const a = queue.shift();
            if (!a) return;
            const steps = Array.isArray(a.steps) ? a.steps : [];
            const link = /^(https?:\/\/|\.{0,2}\/)/.test(a.link_url || '') ? a.link_url : '';

            const box = document.createElement('div');
            box.className = 'whatsnew-banner';
            box.innerHTML =
                '<div class="whatsnew-icon"><i class="uil uil-gift"></i></div>' +
                '<div class="whatsnew-text">' +
                    '<p class="whatsnew-title"><span class="whatsnew-pill">New</span>' + esc(a.title) + '</p>' +
                    '<p class="whatsnew-body">' + esc(a.body) + '</p>' +
                '</div>' +
                '<div class="whatsnew-actions">' +
                    (steps.length ? '<button class="whatsnew-btn" data-a="show">Show me</button>' : '') +
                    (link ? '<a class="whatsnew-btn ' + (steps.length ? 'whatsnew-btn--ghost' : '') + '" href="' + esc(link) + '" data-a="link">' + esc(a.link_label || 'Learn more') + '</a>' : '') +
                '</div>' +
                '<button class="whatsnew-close" data-a="close" aria-label="Dismiss"><i class="uil uil-multiply"></i></button>';
            slot.appendChild(box);

            const seen = () => { progress.add('ann:' + a.id); markDone(uid, 'ann:' + a.id); };
            box.querySelector('[data-a="close"]').addEventListener('click', () => { seen(); renderNext(); });
            const showBtn = box.querySelector('[data-a="show"]');
            if (showBtn) showBtn.addEventListener('click', () => { seen(); slot.innerHTML = ''; start(steps); });
            const linkEl = box.querySelector('[data-a="link"]');
            if (linkEl) linkEl.addEventListener('click', seen);
        }
    }

    // ── bootstrap (dashboard only) ──────────────────────────────
    async function init() {
        if (!document.getElementById('whatsNewSlot')) return;
        const uid = currentUserId();
        if (!uid) return;

        const progress = await getProgress(uid);
        if (!progress) return;                         // tables missing or blocked: stay silent

        let created = null;
        try {
            const { data } = await db.from('users').select('created_at').eq('id', uid).maybeSingle();
            created = data && data.created_at;
        } catch (e) {}

        const isNew = created && new Date(created) > new Date(TOUR_AUTOSTART_AFTER);
        if (isNew && !progress.has('welcome')) {
            setTimeout(startWelcome, 1500);            // let the dashboard finish painting
            return;
        }
        loadBanner(uid, progress, created);
    }

    // ── page guides (deposit / invest / withdraw) ───────────────
    async function waitReady(guide, ms) {
        if (!guide.ready) return true;
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            try { if (guide.ready()) return true; } catch (e) {}
            await sleep(200);
        }
        return false;
    }

    async function runGuide(name, auto) {
        const g = GUIDES[name];
        if (!g) return;
        const uid = currentUserId();
        const ok = await waitReady(g, 6000);
        if (!ok && auto) return;
        start(g.steps, { onEnd: () => { if (uid) markDone(uid, g.key); } });
    }

    async function initGuide(name) {
        const g = GUIDES[name];
        if (!g) return;

        // "How does this work?" button under the page heading
        const anchor = document.querySelector(g.button);
        if (anchor && !document.getElementById('tourGuideBtn')) {
            const b = document.createElement('button');
            b.id = 'tourGuideBtn';
            b.type = 'button';
            b.className = 'tour-link';
            b.style.marginTop = '8px';
            b.innerHTML = '<i class="uil uil-question-circle"></i> How does this work?';
            b.addEventListener('click', () => runGuide(name, false));
            anchor.insertAdjacentElement('afterend', b);
        }

        // Auto-start once, for accounts created after launch only
        const uid = currentUserId();
        if (!uid) return;
        const progress = await getProgress(uid);
        if (!progress || progress.has(g.key)) return;
        let created = null;
        try {
            const { data } = await db.from('users').select('created_at').eq('id', uid).maybeSingle();
            created = data && data.created_at;
        } catch (e) {}
        if (created && new Date(created) > new Date(TOUR_AUTOSTART_AFTER)) {
            setTimeout(() => runGuide(name, true), 1200);
        }
    }

    window.Tour = { start, startWelcome, TARGETS };
    document.addEventListener('DOMContentLoaded', () => {
        const guide = document.body && document.body.getAttribute('data-tour-guide');
        if (guide) initGuide(guide); else init();
    });
})();
