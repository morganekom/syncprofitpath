// ================================================================
// CHAT-WIDGET.JS — User-side floating chat widget
// Connects to the same Supabase messages table the admin reads.
// Inserts messages with sender = 'user', reads replies with sender = 'admin'.
// Polls every 8 seconds for new admin replies.
// ================================================================

(function () {

    // ── STATE ──
    let isOpen       = false;
    let pollTimer    = null;
    let lastMsgCount = 0;
    let userId       = null;


    // ================================================================
    // INJECT HTML — adds the widget button and panel to the page
    // ================================================================

    function injectWidget() {
        const html = `
            <!-- Floating chat button -->
            <button class="chat-widget-btn" id="chatWidgetBtn" onclick="ChatWidget.toggle()" title="Chat with support">
                <i class="uil uil-comment-dots" id="chatWidgetIcon"></i>
                <span class="chat-unread-badge" id="chatUnreadBadge"></span>
            </button>

            <!-- Chat panel -->
            <div class="chat-widget-panel" id="chatWidgetPanel">

                <!-- Header -->
                <div class="chat-panel-header">
                    <div class="chat-panel-header-left">
                        <div class="chat-panel-avatar">
                            <i class="uil uil-headphone-alt"></i>
                        </div>
                        <div>
                            <div class="chat-panel-title">Support</div>
                            <div class="chat-panel-subtitle">We usually reply within minutes</div>
                        </div>
                    </div>
                    <button class="chat-panel-close" onclick="ChatWidget.toggle()">
                        <i class="uil uil-multiply"></i>
                    </button>
                </div>

                <!-- Messages -->
                <div class="chat-panel-messages" id="chatPanelMessages">
                    <div class="chat-panel-loading" id="chatPanelLoading" style="display:none;">
                        <i class="uil uil-spinner"></i> Loading…
                    </div>
                    <div class="chat-panel-welcome" id="chatPanelWelcome">
                        <i class="uil uil-comment-heart"></i>
                        <h3>Hi there! 👋</h3>
                        <p>Send us a message and our support team will get back to you as soon as possible.</p>
                    </div>
                </div>

                <!-- Input -->
                <div class="chat-panel-input-row">
                    <textarea
                        id="chatPanelInput"
                        class="chat-panel-input"
                        placeholder="Type your message…"
                        rows="1"
                        onkeydown="ChatWidget.handleKey(event)"
                        oninput="ChatWidget.autoResize(this)">
                    </textarea>
                    <button class="chat-panel-send" id="chatPanelSend" onclick="ChatWidget.send()">
                        <i class="uil uil-message"></i>
                    </button>
                </div>

            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
    }


    // ================================================================
    // INIT
    // ================================================================

    function init() {
        // Only run if user is logged in
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!currentUser || !currentUser.id) return;

        userId = currentUser.id;

        injectWidget();
        loadMessages(false); // initial load without loading spinner
        startPolling();
    }


    // ================================================================
    // TOGGLE OPEN / CLOSED
    // ================================================================

    function toggle() {
        isOpen = !isOpen;

        const panel  = document.getElementById('chatWidgetPanel');
        const icon   = document.getElementById('chatWidgetIcon');

        if (isOpen) {
            panel.classList.add('open');
            icon.className = 'uil uil-multiply';
            // Mark admin messages as read when panel opens
            markAdminMessagesRead();
            // Scroll to bottom
            scrollToBottom();
        } else {
            panel.classList.remove('open');
            icon.className = 'uil uil-comment-dots';
        }
    }


    // ================================================================
    // LOAD MESSAGES FROM SUPABASE
    // ================================================================

    async function loadMessages(showLoading = false) {
        if (!userId) return;

        const messagesEl = document.getElementById('chatPanelMessages');
        const loadingEl  = document.getElementById('chatPanelLoading');
        const welcomeEl  = document.getElementById('chatPanelWelcome');
        if (!messagesEl) return;

        if (showLoading) {
            loadingEl.style.display  = 'flex';
            welcomeEl.style.display  = 'none';
        }

        try {
            const { data, error } = await db
                .from('messages')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            loadingEl.style.display = 'none';

            if (!data || data.length === 0) {
                welcomeEl.style.display = 'flex';
                lastMsgCount = 0;
                return;
            }

            welcomeEl.style.display = 'none';

            // Only re-render if message count changed (avoids flicker)
            if (data.length !== lastMsgCount) {
                lastMsgCount = data.length;
                renderMessages(data);

                // Check for unread admin replies
                const unreadAdmin = data.filter(m => m.sender === 'admin' && !m.read);
                updateUnreadBadge(unreadAdmin.length);
            }

        } catch (err) {
            console.error('Chat widget load error:', err.message);
            loadingEl.style.display = 'none';
        }
    }

    function renderMessages(messages) {
        const container = document.getElementById('chatPanelMessages');
        const loadingEl = document.getElementById('chatPanelLoading');
        const welcomeEl = document.getElementById('chatPanelWelcome');

        // Remove existing message bubbles (keep loading and welcome els)
        Array.from(container.children).forEach(child => {
            if (child.id !== 'chatPanelLoading' && child.id !== 'chatPanelWelcome') {
                child.remove();
            }
        });

        messages.forEach(msg => {
            const isUser = msg.sender === 'user';
            const time   = msg.created_at
                ? new Date(msg.created_at).toLocaleString('en-US', {
                    hour: '2-digit', minute: '2-digit',
                    month: 'short', day: 'numeric'
                  })
                : '';

            const el = document.createElement('div');
            el.className = `widget-msg ${isUser ? 'from-user' : 'from-admin'}`;
            el.innerHTML = `
                <div class="widget-bubble">${escapeHtml(msg.message)}</div>
                <div class="widget-meta">${isUser ? 'You' : 'Support'} · ${time}</div>
            `;
            container.appendChild(el);
        });

        scrollToBottom();
    }


    // ================================================================
    // SEND MESSAGE
    // ================================================================

    async function send() {
        if (!userId) return;

        const input   = document.getElementById('chatPanelInput');
        const sendBtn = document.getElementById('chatPanelSend');
        const message = input.value.trim();
        if (!message) return;

        // Disable while sending
        input.disabled    = true;
        sendBtn.disabled  = true;

        try {
            const { error } = await db
                .from('messages')
                .insert([{
                    user_id: userId,
                    sender:  'user',
                    message,
                    read:    false,   // admin hasn't read it yet
                }]);

            if (error) throw error;

            input.value      = '';
            input.style.height = 'auto';
            input.disabled   = false;
            sendBtn.disabled = false;
            input.focus();

            // Reload to show new message immediately
            await loadMessages(false);

        } catch (err) {
            console.error('Chat send error:', err.message);
            input.disabled   = false;
            sendBtn.disabled = false;
            alert('Failed to send message. Please try again.');
        }
    }


    // ================================================================
    // MARK ADMIN MESSAGES AS READ
    // Called when user opens the chat panel
    // ================================================================

    async function markAdminMessagesRead() {
        if (!userId) return;

        try {
            await db
                .from('messages')
                .update({ read: true })
                .eq('user_id', userId)
                .eq('sender', 'admin')
                .eq('read', false);

            updateUnreadBadge(0);

        } catch (err) {
            console.error('Mark read error:', err.message);
        }
    }


    // ================================================================
    // UNREAD BADGE ON FLOATING BUTTON
    // ================================================================

    function updateUnreadBadge(count) {
        const badge = document.getElementById('chatUnreadBadge');
        if (!badge) return;

        if (count > 0 && !isOpen) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
        }
    }


    // ================================================================
    // POLLING — checks for new messages every 8 seconds
    // ================================================================

    function startPolling() {
        pollTimer = setInterval(() => {
            loadMessages(false);
        }, 8000);
    }


    // ================================================================
    // UTILITIES
    // ================================================================

    function scrollToBottom() {
        const container = document.getElementById('chatPanelMessages');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    }

    // Ctrl+Enter sends, Enter adds newline
    function handleKey(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            send();
        }
    }

    // Auto-resize textarea as user types
    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }


    // ================================================================
    // EXPOSE PUBLIC API
    // ================================================================

    window.ChatWidget = { toggle, send, handleKey, autoResize };


    // ================================================================
    // START — wait for DOM and Supabase to be ready
    // ================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();