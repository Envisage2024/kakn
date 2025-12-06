document.addEventListener('DOMContentLoaded', function() {
    loadNotifications();

    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function() {
            const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
            notifications.forEach(n => n.read = true);
            localStorage.setItem('notifications', JSON.stringify(notifications));
            
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                const badge = item.querySelector('.notification-badge');
                if (badge) {
                    badge.remove();
                }
            });

            updateNotificationBadge();
        });
    }
});

function loadNotifications() {
    const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    const container = document.getElementById('notificationsContainer');

    if (!container) return;

    const notificationItems = container.querySelectorAll('.notification-item');
    
    notificationItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            this.classList.remove('unread');
            const badge = this.querySelector('.notification-badge');
            if (badge) {
                badge.remove();
            }

            if (notifications[index]) {
                notifications[index].read = true;
                localStorage.setItem('notifications', JSON.stringify(notifications));
                updateNotificationBadge();
            }
        });
    });
}
