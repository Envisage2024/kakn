document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatMessages = document.getElementById('chatMessages');
    // show loader immediately while messages are fetched
    function showLoader() {
        if (!chatMessages) return;
        // clear current content
        chatMessages.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.id = 'chatLoader';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.height = '100%';
        wrapper.style.width = '100%';
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.setAttribute('aria-hidden', 'true');
        spinner.style.width = '48px';
        spinner.style.height = '48px';
        wrapper.appendChild(spinner);
        chatMessages.appendChild(wrapper);
    }

    function showEmptyState() {
        if (!chatMessages) return;
        chatMessages.innerHTML = '<div class="chat-empty"><p>No messages sent in this chat.</p></div>';
    }

    // Real-time messaging using Firebase Realtime Database
    function getCurrentUser() {
        // Prefer Firebase auth user if available
        try {
            if (window.firebase && firebase.auth && firebase.auth().currentUser) {
                return firebase.auth().currentUser;
            }
        } catch (e) {}
        const stored = localStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
    }

    const me = getCurrentUser();
    if (!me) {
        console.warn('Support: no current user found; messaging will work in demo mode only.');
    }

    const userId = (me && (me.uid || me.id || me.email)) || ('anon_' + (Date.now()));

    // mark messages as seen now (store lastSeen) so unread count clears when user opens page
    try {
        const lastSeenKey = 'supportLastSeen:' + userId;
        localStorage.setItem(lastSeenKey, Date.now().toString());
        // if firebase available, clear unread flags in meta node in RTDB so other devices see it
        if (window.firebase && firebase.database) {
            try {
                const metaRef = firebase.database().ref(`one_on_one/${userId}/meta`);
                // clear unread markers on server side for this user
                metaRef.update({ unreadForUser: false, unreadCount: 0, lastSeen: Date.now() }).then(() => {
                    console.log('support.js: cleared meta unread for', userId);
                }).catch(err => { console.warn('support.js: failed to clear meta', err); });
            } catch (e) { console.warn('support.js: meta clear exception', e); }
        }
        if (window.updateSupportBadge) window.updateSupportBadge();
    } catch (e) {}

    // Reference to this user's chat messages
    let messagesRef = null;
    if (window.firebase && firebase.database) {
        messagesRef = firebase.database().ref(`one_on_one/${userId}/messages`);
    }

    function appendMessageDOM(msg) {
        if (!chatMessages) return;
        // remove empty-state or loader if present
        const empty = chatMessages.querySelector('.chat-empty');
        if (empty) empty.remove();
        const loader = document.getElementById('chatLoader');
        if (loader) loader.remove();

        const div = document.createElement('div');
        div.className = msg.sender === 'admin' ? 'message received' : 'message sent';
        const avatar = msg.sender === 'admin' ? `<div class="message-avatar"><i class="fas fa-user-tie"></i></div>` : '';
        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        div.innerHTML = `${avatar}<div class="message-content"><p>${escapeHtml(msg.text)}</p><span class="message-time">${time}</span></div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Load existing messages and listen for new ones
    showLoader();
    if (messagesRef) {
        messagesRef.off();

        // remove loader and append when child arrives
        messagesRef.limitToLast(200).on('child_added', snapshot => {
            const m = snapshot.val();
            if (!m) return;
            appendMessageDOM({ sender: m.sender, text: m.text, timestamp: m.timestamp || new Date().toISOString() });
        });

        // check if there are any messages; if none show empty state
        messagesRef.once('value').then(snap => {
            if (!snap.exists()) {
                const loader = document.getElementById('chatLoader');
                if (loader) loader.remove();
                showEmptyState();
            }
        }).catch(err => {
            console.warn('Failed to check existing messages', err);
            const loader = document.getElementById('chatLoader');
            if (loader) loader.remove();
            showEmptyState();
        });
    } else {
        // No realtime DB available — remove loader and show empty state after short delay
        setTimeout(() => {
            const loader = document.getElementById('chatLoader');
            if (loader) loader.remove();
            // if there are previously sent local messages they will be visible via send fallback; otherwise show empty
            showEmptyState();
        }, 600);
    }

    async function sendMessage() {
        const messageText = (messageInput.value || '').trim();
        if (messageText === '') return;
        const message = {
            sender: 'student',
            text: messageText,
            timestamp: new Date().toISOString(),
            name: (me && (me.displayName || me.fullName || me.name)) || ''
        };

        // push to RTDB
        if (messagesRef) {
            try {
                await messagesRef.push(message);
                // also update a meta node so admin can quickly read last message
                const metaRef = firebase.database().ref(`one_on_one/${userId}/meta`);
                await metaRef.set({ lastText: messageText, lastTimestamp: message.timestamp, unreadForAdmin: true, name: message.name || userId });
            } catch (err) {
                console.error('Failed to send message to RTDB', err);
                alert('Unable to send message (network).');
                return;
            }
        } else {
            // fallback: append locally
            appendMessageDOM({ sender: 'student', text: messageText, timestamp: message.timestamp });
        }

        messageInput.value = '';
    }

    function escapeHtml(s){ return (s||'').toString().replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    const attachmentBtn = document.querySelector('.attachment-btn');
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', function() {
            alert('Feature coming soon, please contact us for more information.');
        });
    }
});
