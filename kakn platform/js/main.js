function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
        window.location.href = 'index.html';
        return null;
    }
    return currentUser ? JSON.parse(currentUser) : null;
}

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mobileToggle = document.getElementById('mobileToggle');
    const logoutBtn = document.getElementById('logoutBtn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-open');
        });
    }

    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed && window.innerWidth > 768) {
        sidebar.classList.add('collapsed');
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('currentUser');
                window.location.href = 'index.html';
            }
        });
    }

    const navItems = document.querySelectorAll('.nav-item:not(.logout)');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });
}

function updateUserInfo() {
    const user = checkAuth();
    if (user) {
        const userNameElements = document.querySelectorAll('#userName');
        userNameElements.forEach(el => {
            el.textContent = `Welcome, ${user.fullName}`;
        });
    }
}

function initializeLocalStorage() {
    if (!localStorage.getItem('dashboardStats')) {
        const stats = {
            completionPercentage: 75,
            pendingAssignments: 5,
            newVideos: 8,
            newNotes: 12,
            newMessages: 3
        };
        localStorage.setItem('dashboardStats', JSON.stringify(stats));
    }

    if (!localStorage.getItem('notifications')) {
        const notifications = [
            {
                id: 1,
                title: 'New Course Material Available',
                message: 'Week 3 video tutorials and PDF notes have been uploaded. Check them out in the respective sections.',
                time: '2 hours ago',
                read: false,
                type: 'info'
            },
            {
                id: 2,
                title: 'Assignment Deadline Reminder',
                message: 'Your Week 1 assignment is due in 3 days. Please submit it before November 25, 2025.',
                time: '5 hours ago',
                read: false,
                type: 'warning'
            },
            {
                id: 3,
                title: 'Upcoming Live Session',
                message: 'Computer Applications Workshop is scheduled for November 22, 2025 at 2:00 PM. Don\'t forget to join!',
                time: '1 day ago',
                read: false,
                type: 'info'
            }
        ];
        localStorage.setItem('notifications', JSON.stringify(notifications));
    }
}

function updateNotificationBadge() {
    const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    const badges = document.querySelectorAll('#notifBadge');
    badges.forEach(badge => {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeSidebar();
    updateUserInfo();
    initializeLocalStorage();
    updateNotificationBadge();
});
