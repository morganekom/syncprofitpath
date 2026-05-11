// faq.js

function switchTab(tab) {
    document.querySelectorAll('.faq-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.faq-section').forEach(s => s.classList.remove('active'));

    document.getElementById('tab-' + tab).classList.add('active');

    const tabs = document.querySelectorAll('.faq-tab');
    const tabMap = { deposits: 0, investing: 1, withdrawals: 2, account: 3 };
    if (tabs[tabMap[tab]]) tabs[tabMap[tab]].classList.add('active');

    // Close any open items when switching tab
    document.querySelectorAll('.faq-item.open').forEach(item => item.classList.remove('open'));
}

function toggleFaq(item) {
    const isOpen = item.classList.contains('open');
    // Close all others in this section
    item.closest('.faq-section').querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
}

// Open to a specific anchor on load (e.g. faq/#withdrawals)
document.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash.replace('#', '');
    const valid = ['deposits', 'investing', 'withdrawals', 'account'];
    if (valid.includes(hash)) switchTab(hash);
});
