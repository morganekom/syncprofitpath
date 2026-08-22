// ================================================================
// CHAT.JS — Admin live chat page
// Loads all user conversations, displays message threads,
// allows admin to reply. Polls for new messages every 8 seconds.
// ================================================================

let allConversations = [];    // list of unique users who have sent messages
let activeConvoUserId = null; // currently open conversation
let pollInterval      = null; // setInterval reference for message polling
let pendingFile        = null; // { file, name, type } staged for next admin reply


// ========================= INIT =========================
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();

    // Poll for new messages every 8 seconds
    pollInterval = setInterval(() => {
        loadConversations(true); // silent refresh (no loading state)
        if (activeConvoUserId) {
            loadMessages(activeConvoUserId, true);
        }
    }, 8000);
});


// ========================= LOAD CONVERSATIONS =========================
// Groups messages by user_id to show one row per user
async function loadConversations(silent = false) {
    if (!silent) {
        showConvoState('loading');
    }

    try {
        // Get all unique users who have sent messages, with their latest message
        const { data, error } = await db
            .from('messages')
            .select('*, users(id, full_name, first_name, last_name, email)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            showConvoState('empty');
            return;
        }

        // Build conversation list — one entry per unique user
        const seen = new Set();
        const convos = [];

        data.forEach(msg => {
            const uid = msg.user_id;
            if (!seen.has(uid)) {
                seen.add(uid);
                convos.push({
                    userId:      uid,
                    user:        msg.users,
                    lastMessage: msg.message,
                    lastTime:    msg.created_at,
                    hasUnread:   false,
                });
            }
        });

        // Check unread counts
        const { data: unread } = await db
            .from('messages')
            .select('user_id')
            .eq('sender', 'user')
            .eq('read', false);

        const unreadUserIds = new Set((unread || []).map(m => m.user_id));

        convos.forEach(c => {
            c.hasUnread = unreadUserIds.has(c.userId);
        });

        allConversations = convos;

        // Update total unread badge
        const totalUnread = unreadUserIds.size;
        const totalEl = document.getElementById('unreadTotal');
        if (totalEl) {
            totalEl.textContent  = totalUnread > 0 ? totalUnread : '';
            totalEl.style.display = totalUnread > 0 ? 'inline-block' : 'none';
        }

        renderConversations();
        showConvoState('list');

    } catch (err) {
        console.error('Load conversations error:', err.message);
        if (!silent) showConvoState('empty');
    }
}


// ========================= FILTER CONVERSATIONS =========================
function filterConversations() {
    renderConversations();
}

function renderConversations() {
    const query = (document.getElementById('chatSearch')?.value || '').toLowerCase();
    const list  = document.getElementById('convoList');
    if (!list) return;

    const filtered = allConversations.filter(c => {
        const name  = (c.user?.full_name || '').toLowerCase();
        const email = (c.user?.email || '').toLowerCase();
        return !query || name.includes(query) || email.includes(query);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<li style="padding:1.5rem; color:var(--color-gray-light); text-align:center;">No conversations found.</li>';
        return;
    }

    list.innerHTML = filtered.map(c => {
        const initials  = getInitials(c.user || {});
        const name      = c.user?.full_name || 'Unknown';
        const preview   = (c.lastMessage || '').slice(0, 40) + (c.lastMessage?.length > 40 ? '…' : '');
        const time      = c.lastTime ? new Date(c.lastTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
        const activeClass  = c.userId === activeConvoUserId ? ' active' : '';
        const unreadClass  = c.hasUnread ? ' has-unread' : '';
        const unreadDot    = c.hasUnread ? '<div class="unread-dot"></div>' : '';

        return `
            <li>
                <div class="convo-item${activeClass}${unreadClass}" onclick="selectConversation('${c.userId}')">
                    <div class="convo-avatar">
                        ${initials}
                        ${unreadDot}
                    </div>
                    <div class="convo-info">
                        <div class="convo-name">${escapeHtml(name)}</div>
                        <div class="convo-preview">${escapeHtml(preview)}</div>
                    </div>
                    <span class="convo-time">${time}</span>
                </div>
            </li>
        `;
    }).join('');
}


// ========================= SELECT CONVERSATION =========================
async function selectConversation(userId) {
    activeConvoUserId = userId;
    removeFile();

    const convo = allConversations.find(c => c.userId === userId);

    // Update thread header
    document.getElementById('threadAvatar').textContent = getInitials(convo?.user || {});
    document.getElementById('threadName').textContent   = convo?.user?.full_name  || 'Unknown';
    document.getElementById('threadEmail').textContent  = convo?.user?.email      || '—';

    // Show thread
    document.getElementById('chatPlaceholder').style.display    = 'none';
    document.getElementById('chatThreadInner').style.display    = 'flex';

    // Mark conversation as active in list
    renderConversations();

    // Load messages
    await loadMessages(userId);

    // Mark user's messages as read
    await db
        .from('messages')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('sender', 'user');

    // Refresh unread counts
    loadConversations(true);
}


// ========================= LOAD MESSAGES =========================
async function loadMessages(userId, silent = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (!silent) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--color-gray-light);">Loading messages…</div>';
    }

    try {
        const { data, error } = await db
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--color-gray-light);">No messages yet.</div>';
            return;
        }

        const html = data.map(msg => buildMessageBubble(msg)).join('');

        // Only update if content changed (avoid scroll jump on silent refresh)
        if (container.innerHTML !== html) {
            container.innerHTML = html;
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }

    } catch (err) {
        console.error('Load messages error:', err.message);
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--color-danger);">Failed to load messages.</div>';
    }
}

function buildMessageBubble(msg) {
    const isAdmin = msg.sender === 'admin';
    const time    = msg.created_at
        ? new Date(msg.created_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
        : '';

    let bubbleHtml = '';

    if (msg.message) {
        bubbleHtml += `<div class="chat-bubble">${escapeHtml(msg.message)}</div>`;
    }

    if (msg.file_url) {
        const isImage = msg.file_type && msg.file_type.startsWith('image/');
        if (isImage) {
            bubbleHtml += `
                <div class="chat-bubble chat-bubble--file">
                    <a href="${msg.file_url}" target="_blank" rel="noopener noreferrer">
                        <img src="${msg.file_url}" alt="${escapeHtml(msg.file_name || 'image')}" class="chat-attachment-img">
                    </a>
                </div>`;
        } else {
            bubbleHtml += `
                <div class="chat-bubble chat-bubble--file">
                    <a href="${msg.file_url}" target="_blank" rel="noopener noreferrer" class="chat-file-link">
                        <i class="uil uil-file-alt"></i>
                        <span>${escapeHtml(msg.file_name || 'attachment')}</span>
                    </a>
                </div>`;
        }
    }

    return `
        <div class="chat-msg ${isAdmin ? 'from-admin' : 'from-user'}">
            ${bubbleHtml}
            <div class="chat-meta">${isAdmin ? 'You' : 'User'} · ${time}</div>
        </div>
    `;
}


// ========================= FILE STAGING =========================
function stageFile(input) {
    const file = input.files[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
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

    input.value = ''; // allow re-selecting the same file after removal
}

function removeFile() {
    pendingFile = null;
    document.getElementById('chatFilePreview').style.display = 'none';
    document.getElementById('chatFileName').textContent       = '';
    document.getElementById('chatFileIcon').className         = 'uil uil-file-alt chat-file-icon';
}

async function uploadFile(file) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `${activeConvoUserId}/admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await db.storage
        .from('chat-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data } = db.storage.from('chat-attachments').getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Could not get public URL for uploaded file');

    return { publicUrl: data.publicUrl, fileName: file.name, fileType: file.type };
}


// ========================= SEND REPLY =========================
async function sendReply() {
    if (!activeConvoUserId) return;

    const input   = document.getElementById('replyInput');
    const sendBtn = document.getElementById('chatSendBtn');
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
            const result = await uploadFile(pendingFile.file);
            fileUrl  = result.publicUrl;
            fileName = result.fileName;
            fileType = result.fileType;
        }

        const { error } = await db
            .from('messages')
            .insert([{
                user_id:   activeConvoUserId,
                sender:    'admin',
                message:   message || null,
                file_url:  fileUrl,
                file_name: fileName,
                file_type: fileType,
                read:      false,
            }]);

        if (error) throw error;

        input.value    = '';
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();

        if (pendingFile) removeFile();

        // Reload messages to show new reply
        await loadMessages(activeConvoUserId);

    } catch (err) {
        console.error('Send reply error:', err.message);
        input.disabled   = false;
        sendBtn.disabled = false;
        alert('Failed to send message. Please try again.');
    }
}

// Allow Ctrl+Enter or Cmd+Enter to send
function handleReplyKey(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        sendReply();
    }
}


// ========================= STATE MANAGER =========================
function showConvoState(state) {
    const loadingEl = document.getElementById('convoLoading');
    const emptyEl   = document.getElementById('convoEmpty');
    const listEl    = document.getElementById('convoList');

    if (loadingEl) loadingEl.style.display = state === 'loading' ? 'flex'  : 'none';
    if (emptyEl)   emptyEl.style.display   = state === 'empty'   ? 'flex'  : 'none';
    if (listEl)    listEl.style.display    = state === 'list'    ? 'flex'  : 'none';
}