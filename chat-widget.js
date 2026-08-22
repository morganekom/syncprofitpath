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
    let cachedMessages = [];  // last-rendered messages, so sends can append locally


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
                        <img class="chat-file-thumb" id="chatFileThumb" style="display:none;" alt="">
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
        const isMobileLayout = window.matchMedia('(max-width: 599px)').matches;

        if (isOpen) {
            panel.classList.add('open');
            icon.className = 'uil uil-multiply';
            markAdminMessagesRead();
            scrollToBottom();
            if (isMobileLayout) document.body.style.overflow = 'hidden';
        } else {
            panel.classList.remove('open');
            icon.className = 'uil uil-comment-dots';
            document.body.style.overflow = '';
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
        const thumbEl = document.getElementById('chatFileThumb');
        const nameEl  = document.getElementById('chatFileName');
        const preview = document.getElementById('chatFilePreview');

        const isImage = file.type !== 'application/pdf';

        if (isImage) {
            if (thumbEl.dataset.blobUrl) URL.revokeObjectURL(thumbEl.dataset.blobUrl);
            const blobUrl = URL.createObjectURL(file);
            thumbEl.src            = blobUrl;
            thumbEl.dataset.blobUrl = blobUrl;
            thumbEl.style.display   = 'block';
            iconEl.style.display    = 'none';
        } else {
            thumbEl.style.display = 'none';
            iconEl.style.display  = '';
            iconEl.className = 'uil uil-file-alt chat-file-icon chat-file-icon--pdf';
        }

        nameEl.textContent    = file.name;
        preview.style.display = 'flex';

        // Reset so the same file can be re-selected after removal
        input.value = '';
    }

    function removeFile() {
        pendingFile = null;
        const thumbEl = document.getElementById('chatFileThumb');
        if (thumbEl.dataset.blobUrl) { URL.revokeObjectURL(thumbEl.dataset.blobUrl); delete thumbEl.dataset.blobUrl; }
        thumbEl.style.display = 'none';
        thumbEl.src = '';
        document.getElementById('chatFilePreview').style.display = 'none';
        document.getElementById('chatFileName').textContent       = '';
        document.getElementById('chatFileIcon').style.display     = '';
        document.getElementById('chatFileIcon').className         = 'uil uil-file-alt chat-file-icon';
    }


    // ================================================================
    // COMPRESS IMAGE BEFORE UPLOAD
    // Phone camera photos and screenshots can be several MB; resizing
    // and re-encoding client-side before upload is the single biggest
    // speed win on mobile data. Skips GIFs (would lose animation) and
    // non-images (PDFs). Falls back to the original file if anything
    // goes wrong or compression doesn't actually help.
    // ================================================================

    function compressImage(file, maxDim = 1600, quality = 0.82) {
        return new Promise(resolve => {
            if (!file.type.startsWith('image/') || file.type === 'image/gif') {
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
                        else                 { width  = Math.round(width  * maxDim / height); height = maxDim; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => {
                        if (!blob || blob.size >= file.size) { resolve(file); return; }
                        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(file);
            reader.readAsDataURL(file);
        });
    }


    // ================================================================
    // UPLOAD FILE TO SUPABASE STORAGE
    // Returns public URL on success, throws on failure.
    // ================================================================

    async function uploadFile(file) {
        const toUpload = await compressImage(file);
        const ext  = toUpload.name.split('.').pop().toLowerCase();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await db.storage
            .from('chat-attachments')
            .upload(path, toUpload, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data } = db.storage
            .from('chat-attachments')
            .getPublicUrl(path);

        if (!data?.publicUrl) throw new Error('Could not get public URL for uploaded file');

        return { publicUrl: data.publicUrl, fileName: file.name, fileType: toUpload.type };
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
                cachedMessages = data;
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
            let time;
            if (msg._pending)     time = 'Sending…';
            else if (msg._failed) time = 'Failed to send — tap to remove';
            else if (msg.created_at) {
                time = new Date(msg.created_at).toLocaleString('en-US', {
                    hour: '2-digit', minute: '2-digit',
                    month: 'short',  day: 'numeric'
                });
            } else time = '';

            const el = document.createElement('div');
            el.className = `widget-msg ${isUser ? 'from-user' : 'from-admin'}`;
            if (msg._pending) el.classList.add('is-pending');
            if (msg._failed)  { el.classList.add('is-failed'); el.onclick = () => removeFailedMessage(msg._localId); }

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
        const fileToSend = pendingFile;

        // Need at least text or a file
        if (!message && !fileToSend) return;

        // Clear the input immediately — feels instant even while upload/insert run in background
        input.value        = '';
        input.style.height = 'auto';
        if (fileToSend) removeFile();

        // Optimistic bubble: shows right away, image preview via local blob URL if present
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const optimisticMsg = {
            _localId:  localId,
            _pending:  true,
            sender:    'user',
            message:   message || null,
            file_url:  fileToSend ? URL.createObjectURL(fileToSend.file) : null,
            file_name: fileToSend ? fileToSend.name : null,
            file_type: fileToSend ? fileToSend.type : null,
            created_at: null,
        };
        cachedMessages = [...cachedMessages, optimisticMsg];
        lastMsgCount = cachedMessages.length;
        document.getElementById('chatPanelWelcome').style.display = 'none';
        renderMessages(cachedMessages);

        try {
            let fileUrl  = null;
            let fileName = null;
            let fileType = null;

            if (fileToSend) {
                try {
                    const result = await uploadFile(fileToSend.file);
                    fileUrl  = result.publicUrl;
                    fileName = result.fileName;
                    fileType = result.fileType;
                } catch (uploadErr) {
                    // If storage bucket isn't set up yet, still send the text message
                    console.warn('File upload failed (has the SQL migration been run?):', uploadErr.message);
                }
            }

            const { data: inserted, error } = await db
                .from('messages')
                .insert([{
                    user_id:   userId,
                    sender:    'user',
                    message:   message || null,
                    file_url:  fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    read:      false,
                }])
                .select()
                .single();

            if (error) throw error;

            // Swap the optimistic bubble for the real DB row (same array length, no full refetch)
            cachedMessages = cachedMessages.map(m =>
                m._localId === localId ? (inserted || { ...m, _pending: false }) : m
            );
            renderMessages(cachedMessages);

        } catch (err) {
            console.error('Chat send error:', err.message);
            cachedMessages = cachedMessages.map(m =>
                m._localId === localId ? { ...m, _pending: false, _failed: true } : m
            );
            renderMessages(cachedMessages);
        }
    }

    // Tap a failed bubble to dismiss it and try again
    function removeFailedMessage(localId) {
        cachedMessages = cachedMessages.filter(m => m._localId !== localId);
        lastMsgCount = cachedMessages.length;
        renderMessages(cachedMessages);
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
