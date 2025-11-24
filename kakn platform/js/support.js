document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatMessages = document.getElementById('chatMessages');

    function sendMessage() {
        const messageText = messageInput.value.trim();
        
        if (messageText === '') {
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message sent';
        
        const currentTime = new Date().toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });

        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${messageText}</p>
                <span class="message-time">${currentTime}</span>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        messageInput.value = '';

        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'message received';
            const replyTime = new Date().toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            
            replyDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div class="message-content">
                    <p>Thank you for your message! I'll get back to you shortly with a detailed response.</p>
                    <span class="message-time">${replyTime}</span>
                </div>
            `;
            chatMessages.appendChild(replyDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1500);
    }

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
            alert('File attachment functionality will be implemented in the next phase.');
        });
    }
});
