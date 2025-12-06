function checkAuth() {
    // If Firebase is loaded, avoid redirecting immediately because firebase.auth().currentUser
    // may be null until the SDK initializes. Prefer localStorage for immediate UI, and
    // let onAuthStateChanged handle final redirects when the SDK becomes available.
    if (window.firebase && firebase.auth) {
        const stored = localStorage.getItem('currentUser');
        if (stored) return JSON.parse(stored);
        // No stored user; do not force a redirect here — onAuthStateChanged will handle it.
        return null;
    }

    // Fallback when Firebase is not present: use localStorage and redirect if not signed in.
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
            if (!confirm('Are you sure you want to logout?')) return;
            // If Firebase is available, sign out there as well
            if (window.firebase && firebase.auth) {
                firebase.auth().signOut().then(() => {
                    try { localStorage.removeItem('currentUser'); } catch (e) {}
                    window.location.href = 'index.html';
                }).catch(err => {
                    console.error('Sign out error', err);
                    alert('Unable to sign out. Please try again.');
                });
                return;
            }
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
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

    // If Firebase SDK loads after this script, attach auth state listener when available
    function attachFirebaseAuthListener() {
        if (window.firebase && firebase.auth) {
            firebase.auth().onAuthStateChanged(async function(user) {
                if (user) {
                    try {
                        // Fetch Firestore profile to ensure verified before allowing access
                        const db = firebase.firestore();
                        const doc = await db.collection('users').doc(user.uid).get();
                        const profile = doc.exists ? doc.data() : null;
                        const verified = profile && profile.verified;
                        if (!verified) {
                            // If not verified, sign out and show waiting overlay (if available)
                            try { await firebase.auth().signOut(); } catch (e) {}
                            if (window.showWaitingApprovalModule) {
                                window.showWaitingApprovalModule({ firstName: profile ? profile.firstName : '', email: user.email });
                            } else {
                                window.location.href = 'index.html';
                            }
                            return;
                        }
                        localStorage.setItem('currentUser', JSON.stringify({ uid: user.uid, email: user.email, fullName: user.displayName || '', verified: true }));
                        updateUserInfo();
                    } catch (e) {
                        console.error('Auth listener fetch profile error', e);
                    }
                } else {
                    // If on protected pages, redirect to login
                    if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
                        window.location.href = 'index.html';
                    }
                }
            });
        }
    }

    if (window.firebase && firebase.auth) attachFirebaseAuthListener();
    else {
        const t = setInterval(() => {
            if (window.firebase && firebase.auth) {
                clearInterval(t);
                attachFirebaseAuthListener();
            }
        }, 200);
    }
});
