// Messages Page Logic

const currentUser = getCurrentUser();

if (!currentUser) {
    window.location.href = 'login.html';
}

// Load messages
function loadMessages() {
    const messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
    const userMessages = messages.filter(m => m.userId === currentUser.id);
    const chatMessages = document.getElementById('chatMessages');
    
    if (userMessages.length === 0) {
        chatMessages.innerHTML = '<p class="no-data">No messages yet. Start a conversation!</p>';
        return;
    }
    
    chatMessages.innerHTML = userMessages.map(msg => `
        <div class="message-bubble ${msg.isFromAdmin ? 'admin-message' : 'user-message'}">
            <div class="message-sender">
                <i class="fas ${msg.isFromAdmin ? 'fa-user-tie' : 'fa-user'}"></i>
                <strong>${msg.isFromAdmin ? 'Andrew Kizito' : 'You'}</strong>
            </div>
            <p>${msg.message}</p>
            <small>${new Date(msg.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Mark messages as read
    messages.forEach(m => {
        if (m.userId === currentUser.id && !m.userRead) {
            m.userRead = true;
        }
    });
    localStorage.setItem('adminMessages', JSON.stringify(messages));
}

// Send message
document.getElementById('sendMessageBtn').addEventListener('click', () => {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    const messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
    
    const newMessage = {
        id: Date.now().toString(),
        userId: currentUser.id,
        userName: currentUser.name,
        message: messageText,
        timestamp: new Date().toISOString(),
        isFromAdmin: false,
        adminRead: false,
        userRead: true
    };
    
    messages.push(newMessage);
    localStorage.setItem('adminMessages', JSON.stringify(messages));
    
    messageInput.value = '';
    loadMessages();
});

// Allow sending with Enter key
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('sendMessageBtn').click();
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// Auto-refresh messages every 5 seconds
setInterval(loadMessages, 5000);

// Load messages on page load
loadMessages();
