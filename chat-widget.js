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
    let pendingFile  = null;   // { file, name, type, previewUrl }


    // ================================================================
    // INJECT HTML
    // ================================================================

    function injectWidget() {
        const html = `
            <!-- Floating chat button — icon intentionally kept as comment-dots -->
            <button class="chat-widget-btn" id="chatWidgetBtn" onclick="ChatWidget.toggle()" title="Chat with Sync">
                <i class="uil uil-comment-dots" id="chatWidgetIcon"></i>
                <span class="chat-unread-badge" id="chatUnreadBadge"></span>
            </button>

            <!-- Chat panel -->
            <div class="chat-widget-panel" id="chatWidgetPanel">

                <!-- Header -->
                <div class="chat-panel-header">
                    <div class="chat-panel-header-left">
                        <div class="chat-panel-avatar">
                            <i class="uil uil-headphone"></i>
                        </div>
                        <div>
                            <div class="chat-panel-title">Sync</div>
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
                        <i class="uil uil-headphone"></i>
                        <h3>Hey there! I'm Sync 👋</h3>
                        <p>How can I assist you today? Send a message and I'll get right on it.</p>
                    </div>
                </div>

                <!-- File preview bar — shown when a file is staged -->
                <div class="chat-file-preview" id="chatFilePreview" style="display:none;">
                    <div class="chat-file-preview-inner">
                        <i class="uil uil-file-alt chat-file-icon" id="chatFileIcon"></i>
                        <span class="chat-file-name" id="chatFileName">file.pdf</span>
                    </div>
                    <button class="chat-file-remove" onclick="ChatWidget.removeFile()" title="Remove file">
                        <i class="uil uil-multiply"></i>
                    </button>
                </div>

                <!-- Input row -->
                <div class="chat-panel-input-row">
                    <!-- Hidden file input — accepts images and PDFs only -->
                    <input
                        type="file"
                        id="chatFileInput"
                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                        style="display:none;"
                        onchange="ChatWidget.handleFileSelect(this)">

                    <!-- Attach button -->
                    <button class="chat-attach-btn" onclick="document.getElementById('chatFileInput').click()" title="Attach image or PDF">
                        <i class="uil uil-paperclip"></i>
                    </button>

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
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!currentUser || !currentUser.id) return;

        userId = currentUser.id;

        injectWidget();
        loadMessages(false);
        startPolling();
    }


    // ================================================================
    // TOGGLE OPEN / CLOSED
    // ================================================================

    function toggle() {
        isOpen = !isOpen;

        const panel = document.getElementById('chatWidgetPanel');
        const icon  = document.getElementById('chatWidgetIcon');

        if (isOpen) {
            panel.classList.add('open');
            icon.className = 'uil uil-multiply';
            markAdminMessagesRead();
            scrollToBottom();
        } else {
            panel.classList.remove('open');
            icon.className = 'uil uil-comment-dots';
        }
    }


    // ================================================================
    // FILE HANDLING
    // ================================================================

    function handleFileSelect(input) {
        const file = input.files[0];
        if (!file) return;

        // Guard: images and PDF only, max 10 MB
        const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'];
        if (!allowed.includes(file.type)) {
            alert('Only images (JPG, PNG, GIF, WEBP) and PDF files are supported.');
            input.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('File is too large. Maximum size is 10 MB.');
            input.value = '';
            return;
        }

        pendingFile = { file, name: file.name, type: file.type };

        // Show preview bar
        const preview  = document.getElementById('chatFilePreview');
        const nameEl   = document.getElementById('chatFileName');
        const iconEl   = document.getElementById('chatFileIcon');

        nameEl.textContent = file.name;
        iconEl.className   = file.type === 'application/pdf'
            ? 'uil uil-file-alt chat-file-icon chat-file-icon--pdf'
            : 'uil uil-image chat-file-icon chat-file-icon--img';
        preview.style.display = 'flex';

        // Reset input so the same file can be re-selected if removed
        input.value = '';
    }

    function removeFile() {
        pendingFile = null;
        document.getElementById('chatFilePreview').style.display = 'none';
        document.getElementById('chatFileIcon').className = 'uil uil-file-alt chat-file-icon';
    }


    // ================================================================
    // UPLOAD FILE TO SUPABASE STORAGE
    // Returns the public URL string, or null on failure.
    // ================================================================

    async function uploadFile(file) {
        const ext      = file.name.split('.').pop();
        const path     = `chat/${userId}/${Date.now()}.${ext}`;

        const { data, error } = await db.storage
            .from('chat-attachments')
            .upload(path, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.error('File upload error:', error.message);
            return null;
        }

        const { data: urlData } = db.storage
            .from('chat-attachments')
            .getPublicUrl(path);

        return urlData?.publicUrl || null;
    }


    // ================================================================
    // LOAD MESSAGES
    // ================================================================

    async function loadMessages(showLoading = false) {
        if (!userId) return;

        const messagesEl = document.getElementById('chatPanelMessages');
        const loadingEl  = document.getElementById('chatPanelLoading');
        const welcomeEl  = document.getElementById('chatPanelWelcome');
        if (!messagesEl) return;

        if (showLoading) {
            loadingEl.style.display = 'flex';
            welcomeEl.style.display = 'none';
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

            if (data.length !== lastMsgCount) {
                lastMsgCount = data.length;
                renderMessages(data);

                const unreadAdmin = data.filter(m => m.sender === 'admin' && !m.read);
                updateUnreadBadge(unreadAdmin.length);
            }

        } catch (err) {
            console.error('Chat widget load error:', err.message);
            document.getElementById('chatPanelLoading').style.display = 'none';
        }
    }

    function renderMessages(messages) {
        const container = document.getElementById('chatPanelMessages');

        // Remove existing message bubbles (keep loading + welcome els)
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
                    month: 'short',  day: 'numeric'
                  })
                : '';

            const el = document.createElement('div');
            el.className = `widget-msg ${isUser ? 'from-user' : 'from-admin'}`;

            // Build bubble content — text and/or attachment
            let bubbleContent = '';
            if (msg.message) {
                bubbleContent += `<div class="widget-bubble">${escapeHtml(msg.message)}</div>`;
            }
            if (msg.file_url) {
                bubbleContent += buildAttachmentBubble(msg.file_url, msg.file_name, msg.file_type);
            }

            el.innerHTML = `
                ${bubbleContent}
                <div class="widget-meta">${isUser ? 'You' : 'Sync'} · ${time}</div>
            `;
            container.appendChild(el);
        });

        scrollToBottom();
    }

    function buildAttachmentBubble(url, name, type) {
        const isImage = type && type.startsWith('image/');
        if (isImage) {
            return `
                <div class="widget-bubble widget-bubble--attachment">
                    <a href="${url}" target="_blank" rel="noopener">
                        <img src="${url}" alt="${escapeHtml(name || 'image')}" class="widget-attachment-img">
                    </a>
                </div>`;
        }
        // PDF or other file
        return `
            <div class="widget-bubble widget-bubble--attachment">
                <a href="${url}" target="_blank" rel="noopener" class="widget-file-link">
                    <i class="uil uil-file-alt"></i>
                    <span>${escapeHtml(name || 'attachment')}</span>
                </a>
            </div>`;
    }


    // ================================================================
    // SEND MESSAGE (text + optional file)
    // ================================================================

    async function send() {
        if (!userId) return;

        const input   = document.getElementById('chatPanelInput');
        const sendBtn = document.getElementById('chatPanelSend');
        const message = input.value.trim();

        // Must have text or a file
        if (!message && !pendingFile) return;

        input.disabled   = true;
        sendBtn.disabled = true;

        try {
            let fileUrl  = null;
            let fileName = null;
            let fileType = null;

            // Upload file first if one is staged
            if (pendingFile) {
                fileUrl  = await uploadFile(pendingFile.file);
                fileName = pendingFile.name;
                fileType = pendingFile.type;
                if (!fileUrl) throw new Error('File upload failed');
            }

            const { error } = await db
                .from('messages')
                .insert([{
                    user_id:   userId,
                    sender:    'user',
                    message:   message || null,
                    file_url:  fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    read:      false,
                }]);

            if (error) throw error;

            input.value        = '';
            input.style.height = 'auto';
            input.disabled     = false;
            sendBtn.disabled   = false;
            input.focus();

            // Clear file preview
            if (pendingFile) removeFile();

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
    // UNREAD BADGE
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
    // POLLING
    // ================================================================

    function startPolling() {
        pollTimer = setInterval(() => loadMessages(false), 8000);
    }


    // ================================================================
    // UTILITIES
    // ================================================================

    function scrollToBottom() {
        const container = document.getElementById('chatPanelMessages');
        if (container) setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }

    function handleKey(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            send();
        }
    }

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
    // PUBLIC API
    // ================================================================

    window.ChatWidget = { toggle, send, handleKey, autoResize, handleFileSelect, removeFile };


    // ================================================================
    // START
    // ================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
