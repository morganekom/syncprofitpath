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
    let pendingFile  = null;   // { file, name, type } staged for next send


    // ================================================================
    // INJECT HTML — adds the widget button and panel to the page
    // ================================================================

    function injectWidget() {
        const html = `
            <!-- Floating chat button — icon stays as comment-dots per spec -->
            <button class="chat-widget-btn" id="chatWidgetBtn" onclick="ChatWidget.toggle()" title="Chat with Nova">
                <i class="uil uil-comment-dots" id="chatWidgetIcon"></i>
                <span class="chat-unread-badge" id="chatUnreadBadge"></span>
            </button>

            <!-- Chat panel -->
            <div class="chat-widget-panel" id="chatWidgetPanel">

                <!-- Header -->
                <div class="chat-panel-header">
                    <div class="chat-panel-header-left">
                        <div class="chat-panel-avatar">
                            <img src="../assets/chat-profile.png" alt="Nova" class="chat-panel-avatar-img">
                        </div>
                        <div>
                            <div class="chat-panel-title">Nova</div>
                            <div class="chat-panel-subtitle">I usually reply within minutes</div>
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
                        <h3>Hey there! I'm Nova 👋</h3>
                        <p>How can I assist you today? Send me a message and I'll get right on it.</p>
                    </div>
                </div>

                <!-- File preview bar — visible only when a file is staged -->
                <div class="chat-file-preview" id="chatFilePreview" style="display:none;">
                    <div class="chat-file-preview-inner">
                        <i class="uil uil-file-alt chat-file-icon" id="chatFileIcon"></i>
                        <span class="chat-file-name" id="chatFileName"></span>
                    </div>
                    <button class="chat-file-remove" onclick="ChatWidget.removeFile()" title="Remove file">
                        <i class="uil uil-times"></i>
                    </button>
                </div>

                <!-- Input row -->
                <div class="chat-panel-input-row">
                    <!-- Hidden file input — images and PDF only -->
                    <input
                        type="file"
                        id="chatFileInput"
                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                        style="display:none;"
                        onchange="ChatWidget.stageFile(this)">

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
    // FILE STAGING
    // ================================================================

    function stageFile(input) {
        const file = input.files[0];
        if (!file) return;

        const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'];
        if (!allowed.includes(file.type)) {
            alert('Only images (JPG, PNG, GIF, WEBP) and PDF files can be attached.');
            input.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Maximum size is 10 MB.');
            input.value = '';
            return;
        }

        pendingFile = { file, name: file.name, type: file.type };

        const iconEl  = document.getElementById('chatFileIcon');
        const nameEl  = document.getElementById('chatFileName');
        const preview = document.getElementById('chatFilePreview');

        iconEl.className = file.type === 'application/pdf'
            ? 'uil uil-file-alt chat-file-icon chat-file-icon--pdf'
            : 'uil uil-image chat-file-icon chat-file-icon--img';

        nameEl.textContent    = file.name;
        preview.style.display = 'flex';

        // Reset so the same file can be re-selected after removal
        input.value = '';
    }

    function removeFile() {
        pendingFile = null;
        document.getElementById('chatFilePreview').style.display = 'none';
        document.getElementById('chatFileName').textContent       = '';
        document.getElementById('chatFileIcon').className         = 'uil uil-file-alt chat-file-icon';
    }


    // ================================================================
    // UPLOAD FILE TO SUPABASE STORAGE
    // Returns public URL on success, throws on failure.
    // ================================================================

    async function uploadFile(file) {
        const ext  = file.name.split('.').pop().toLowerCase();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await db.storage
            .from('chat-attachments')
            .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data } = db.storage
            .from('chat-attachments')
            .getPublicUrl(path);

        if (!data?.publicUrl) throw new Error('Could not get public URL for uploaded file');

        return { publicUrl: data.publicUrl, fileName: file.name, fileType: file.type };
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

            // Only re-render if message count changed (avoids flicker)
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

        // Remove existing bubbles — keep the loading and welcome elements
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

            // Build bubble — text and/or attachment
            let bubbleHtml = '';

            if (msg.message) {
                bubbleHtml += `<div class="widget-bubble">${escapeHtml(msg.message)}</div>`;
            }

            if (msg.file_url) {
                const isImage = msg.file_type && msg.file_type.startsWith('image/');
                if (isImage) {
                    bubbleHtml += `
                        <div class="widget-bubble widget-bubble--file">
                            <a href="${msg.file_url}" target="_blank" rel="noopener noreferrer">
                                <img src="${msg.file_url}" alt="${escapeHtml(msg.file_name || 'image')}" class="widget-attachment-img">
                            </a>
                        </div>`;
                } else {
                    bubbleHtml += `
                        <div class="widget-bubble widget-bubble--file">
                            <a href="${msg.file_url}" target="_blank" rel="noopener noreferrer" class="widget-file-link">
                                <i class="uil uil-file-alt"></i>
                                <span>${escapeHtml(msg.file_name || 'attachment')}</span>
                            </a>
                        </div>`;
                }
            }

            el.innerHTML = `
                ${bubbleHtml}
                <div class="widget-meta">${isUser ? 'You' : 'Nova'} · ${time}</div>
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

        // Need at least text or a file
        if (!message && !pendingFile) return;

        input.disabled   = true;
        sendBtn.disabled = true;

        try {
            let fileUrl  = null;
            let fileName = null;
            let fileType = null;

            if (pendingFile) {
                try {
                    const result = await uploadFile(pendingFile.file);
                    fileUrl  = result.publicUrl;
                    fileName = result.fileName;
                    fileType = result.fileType;
                } catch (uploadErr) {
                    // If storage bucket isn't set up yet, still send the text message
                    console.warn('File upload failed (has the SQL migration been run?):', uploadErr.message);
                    fileUrl = null;
                }
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

            if (pendingFile) removeFile();

            await loadMessages(false);

        } catch (err) {
            console.error('Chat send error:', err.message);
            input.disabled   = false;
            sendBtn.disabled = false;
            alert('Failed to send. Please try again.');
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
        pollTimer = setInterval(() => loadMessages(false), 8000);
    }


    // ================================================================
    // UTILITIES
    // ================================================================

    function scrollToBottom() {
        const container = document.getElementById('chatPanelMessages');
        if (container) setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }

    // Ctrl/Cmd+Enter sends
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
    // EXPOSE PUBLIC API
    // ================================================================

    window.ChatWidget = { toggle, send, handleKey, autoResize, stageFile, removeFile };


    // ================================================================
    // START
    // ================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
