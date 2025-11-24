function joinSession() {
    const sessionUrl = 'https://meet.google.com/new';
    window.open(sessionUrl, '_blank');
    
    alert('The live session link has been opened in a new tab. In a real implementation, this would connect to your actual video conferencing platform.');
}

document.addEventListener('DOMContentLoaded', function() {
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');
    const joinBtn = document.getElementById('joinSessionBtn');

    const isSessionActive = false;

    if (isSessionActive) {
        statusLight.classList.add('active');
        statusText.textContent = 'Session Active';
        joinBtn.style.display = 'block';
    } else {
        statusText.textContent = 'No Active Session';
    }

    const reminderButtons = document.querySelectorAll('.session-item-card .btn-outline');
    reminderButtons.forEach(button => {
        button.addEventListener('click', function() {
            alert('Reminder has been set! You will be notified before the session starts.');
        });
    });
});
