// ================================================================
// NOTIFICATIONS.JS — Full notifications page
// Works for both user and admin pages.
// Reads _notifData populated by notify-inapp.js
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Mark all as read when page is opened
    markAllReadPage();

    // Give notify-inapp.js a moment to load data, then render
    setTimeout(renderFullPage, 600);
});

function markAllReadPage() {
    localStorage.setItem('notif_last_seen', new Date().toISOString());
    // Clear badge
    const badge = document.getElementById('navBellBadge');
    if (badge) badge.style.display = 'none';
}

function renderFullPage() {
    const loadingEl = document.getElementById('notifPageLoading');
    const emptyEl   = document.getElementById('notifPageEmpty');
    const listEl    = document.getElementById('notifPageList');

    if (!listEl) return;

    // _notifData is set by notify-inapp.js
    const data = typeof _notifData !== 'undefined' ? _notifData : [];

    if (loadingEl) loadingEl.style.display = 'none';

    if (data.length === 0) {
        if (emptyEl) emptyEl.style.display = 'flex';
        return;
    }

    listEl.style.display = 'flex';

    // Group by date
    const groups = groupByDate(data);

    listEl.innerHTML = Object.entries(groups).map(([label, items]) => `
        <div class="notif-group">
            <div class="notif-group-label">${label}</div>
            ${items.map(n => buildFullNotifItem(n)).join('')}
        </div>
    `).join('');
}

function groupByDate(items) {
    const groups = {};
    const today     = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    items.forEach(n => {
        const d = new Date(n.ts); d.setHours(0,0,0,0);
        let label;
        if (d.getTime() === today.getTime())     label = 'Today';
        else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
        else label = new Date(n.ts).toLocaleDateString('en-US', {
            weekday: 'long', day: 'numeric', month: 'long'
        });

        if (!groups[label]) groups[label] = [];
        groups[label].push(n);
    });

    return groups;
}

function buildFullNotifItem(n) {
    const NOTIF_META = {
        deposit_approved:    { icon: 'uil-check-circle',      color: 'success', label: 'Deposit Approved'     },
        deposit_rejected:    { icon: 'uil-times-circle',      color: 'danger',  label: 'Deposit Rejected'     },
        deposit_pending:     { icon: 'uil-clock',             color: 'warning', label: 'Deposit Received'     },
        withdrawal_approved: { icon: 'uil-check-circle',      color: 'success', label: 'Withdrawal Processed' },
        withdrawal_rejected: { icon: 'uil-times-circle',      color: 'danger',  label: 'Withdrawal Rejected'  },
        investment_approved: { icon: 'uil-diamond',           color: 'purple',  label: 'Investment Approved'  },
        investment_rejected: { icon: 'uil-times-circle',      color: 'danger',  label: 'Investment Rejected'  },
        investment_matured:  { icon: 'uil-trophy',            color: 'success', label: 'Investment Matured'   },
        kyc_approved:        { icon: 'uil-shield-check',      color: 'success', label: 'KYC Verified'         },
        kyc_rejected:        { icon: 'uil-shield-slash',      color: 'danger',  label: 'KYC Rejected'         },
        password_changed:    { icon: 'uil-lock-alt',          color: 'primary', label: 'Password Changed'     },
        admin_deposit:       { icon: 'uil-arrow-circle-down', color: 'primary', label: 'New Deposit'          },
        admin_withdrawal:    { icon: 'uil-arrow-circle-up',   color: 'warning', label: 'New Withdrawal'       },
        admin_investment:    { icon: 'uil-diamond',           color: 'purple',  label: 'New Investment'       },
        admin_kyc:           { icon: 'uil-shield-check',      color: 'primary', label: 'KYC Submission'       },
    };

    const meta = NOTIF_META[n.type] || { icon: 'uil-bell', color: 'primary', label: 'Notification' };
    const time = new Date(n.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `
    <div class="notif-full-item">
        <div class="notif-item-icon ${meta.color}">
            <i class="uil ${meta.icon}"></i>
        </div>
        <div class="notif-item-body">
            <div class="notif-item-title">${meta.label}</div>
            <div class="notif-item-desc">${n.body}</div>
            <div class="notif-item-time">${time}</div>
        </div>
    </div>`;
}
