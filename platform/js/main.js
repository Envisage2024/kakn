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
    // allow safe re-run: mark attached elements with a data attribute
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const mobileToggle = document.getElementById('mobileToggle');
    const logoutBtn = document.getElementById('logoutBtn');
    const docEl = document.documentElement;

    if (toggleBtn && !toggleBtn.dataset.sidebarInit) {
        toggleBtn.addEventListener('click', function() {
            // On small screens treat this toggle as an open/close for the mobile sidebar
            if (window.innerWidth <= 768) {
                const opened = sidebar.classList.toggle('mobile-open');
                if (opened) {
                    // create overlay and lock scroll (reuse mobileToggle logic)
                    let ov = document.getElementById('mobileOverlay');
                    if (!ov) {
                        ov = document.createElement('div');
                        ov.id = 'mobileOverlay';
                        ov.className = 'mobile-overlay';
                        ov.addEventListener('click', function() {
                            sidebar.classList.remove('mobile-open');
                            removeOverlay();
                            document.body.classList.remove('no-scroll');
                        });
                        document.body.appendChild(ov);
                    }
                    document.body.classList.add('no-scroll');
                } else {
                    removeOverlay();
                    document.body.classList.remove('no-scroll');
                }
                return;
            }

            // Desktop: toggle collapsed state and persist preference
            const nowCollapsed = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed');
            try {
                if (nowCollapsed) docEl.classList.add('sidebar-collapsed');
                else docEl.classList.remove('sidebar-collapsed');
            } catch (e) {}
            localStorage.setItem('sidebarCollapsed', nowCollapsed);
            try { updateNotificationBadge(); } catch (e) {}
        });
        toggleBtn.dataset.sidebarInit = '1';
    }

    if (mobileToggle && !mobileToggle.dataset.sidebarInit) {
        mobileToggle.addEventListener('click', function() {
            const isOpen = sidebar.classList.toggle('mobile-open');
            // create/remove overlay and prevent body scroll when open
            if (isOpen) {
                let ov = document.getElementById('mobileOverlay');
                if (!ov) {
                    ov = document.createElement('div');
                    ov.id = 'mobileOverlay';
                    ov.className = 'mobile-overlay';
                    ov.addEventListener('click', function() {
                        sidebar.classList.remove('mobile-open');
                        removeOverlay();
                    });
                    document.body.appendChild(ov);
                }
                document.body.classList.add('no-scroll');
            } else {
                removeOverlay();
                document.body.classList.remove('no-scroll');
            }
        });
        mobileToggle.dataset.sidebarInit = '1';
    }

    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed && window.innerWidth > 768) {
        sidebar.classList.add('collapsed');
        try { docEl.classList.add('sidebar-collapsed'); } catch (e) {}
    } else {
        try { docEl.classList.remove('sidebar-collapsed'); } catch (e) {}
    }

    if (logoutBtn && !logoutBtn.dataset.sidebarInit) {
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
        logoutBtn.dataset.sidebarInit = '1';
    }

    const navItems = document.querySelectorAll('.nav-item:not(.logout)');
    navItems.forEach(item => {
        if (!item.dataset.navInit) {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('mobile-open');
                    removeOverlay();
                    document.body.classList.remove('no-scroll');
                }
            });
            item.dataset.navInit = '1';
        }
    });

    function removeOverlay() {
        const ov = document.getElementById('mobileOverlay');
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    }
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
    
    const sidebarEl = document.getElementById('sidebar');
    const isCollapsed = sidebarEl && sidebarEl.classList.contains('collapsed');

    const badges = document.querySelectorAll('#notifBadge');
    badges.forEach(badge => {
        const parent = badge.parentElement;
        if (unreadCount > 0) {
            // If the sidebar is collapsed we hide the numeric badge and rely on
            // `.has-unread` + CSS to color the bell icon red. When expanded show the badge.
            if (isCollapsed) {
                badge.style.display = 'none';
            } else {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
            }
            if (parent) parent.classList.add('has-unread');
        } else {
            // no unread: hide numeric badge and remove any unread marker
            badge.style.display = 'none';
            if (parent) parent.classList.remove('has-unread');
        }
    });
}

// Update the one-on-one support unread badge based on messages from admin
function updateSupportBadge() {
    let user = checkAuth();
    if (!user) {
        try { user = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { user = null; }
    }
    if (!user) return;
    const userId = user.uid || user.id || user.email;
    const lastSeenKey = `supportLastSeen:${userId}`;
    const lastSeen = parseInt(localStorage.getItem(lastSeenKey) || '0', 10) || 0;

    const sidebarEl = document.getElementById('sidebar');
    const isCollapsed = sidebarEl && sidebarEl.classList.contains('collapsed');
    const supportNav = document.getElementById('oneOnOneNav');
    const badge = document.getElementById('supportBadge');
    if (!supportNav || !badge) return;

    console.log('updateSupportBadge: start for userId=', userId, 'lastSeen=', lastSeen);
    // Use RTDB meta node for unread tracking if available (preferred)
    if (window.firebase && firebase.database) {
        try {
            const metaRef = firebase.database().ref(`one_on_one/${userId}/meta`);
            // read current meta and update UI
            metaRef.once('value').then(snap => {
                const meta = snap.val() || {};
                console.log('updateSupportBadge: meta read', meta);
                const count = parseInt(meta.unreadCount || 0, 10) || (meta.unreadForUser ? 1 : 0);
                if (count > 0) {
                    if (isCollapsed) {
                        // collapsed: rely on colored icon, hide numeric
                        badge.style.display = 'none';
                    } else {
                        badge.textContent = count;
                        badge.style.display = 'inline-block';
                    }
                    supportNav.classList.add('has-unread');
                } else {
                    badge.style.display = 'none';
                    supportNav.classList.remove('has-unread');
                }
            }).catch(err => {
                console.warn('updateSupportBadge meta read error', err);
                badge.style.display = 'none';
                supportNav.classList.remove('has-unread');
            });

            // listen live for meta changes (admin can update meta to notify users)
            metaRef.on('value', snap => {
                const meta = snap.val() || {};
                console.log('updateSupportBadge meta.on', meta);
                const count = parseInt(meta.unreadCount || 0, 10) || (meta.unreadForUser ? 1 : 0);
                if (count > 0) {
                    if (isCollapsed) badge.style.display = 'none';
                    else { badge.textContent = count; badge.style.display = 'inline-block'; }
                    supportNav.classList.add('has-unread');
                } else {
                    badge.style.display = 'none';
                    supportNav.classList.remove('has-unread');
                }
            });
        } catch (e) {
            console.warn('support badge meta handling failed', e);
            badge.style.display = 'none';
            supportNav.classList.remove('has-unread');
        }
    } else {
        // No firebase: fallback to local scan (best-effort)
        console.log('updateSupportBadge: firebase not available or meta missing, hiding badge');
        badge.style.display = 'none';
        supportNav.classList.remove('has-unread');
    }
}

// If firebase loads later, retry updateSupportBadge a few times
(function retrySupportBadgeOnFirebaseReady() {
    let tries = 0;
    const t = setInterval(() => {
        if (window.firebase && firebase.database) {
            try { updateSupportBadge(); } catch (e) {}
            clearInterval(t);
            return;
        }
        tries++;
        if (tries > 20) clearInterval(t);
    }, 300);
})();

// expose to other scripts (support.js will call this after marking lastSeen)
window.updateSupportBadge = updateSupportBadge;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeSidebar();
    updateUserInfo();
    initializeLocalStorage();
    updateNotificationBadge();
    try { if (window.updateSupportBadge) window.updateSupportBadge(); } catch (e) {}

    // Initialize profile popover for mobile (tap avatar to show name)
    (function initProfilePopover() {
        const avatar = document.querySelector('.user-avatar');
        if (!avatar) return;

        let popover = null;
        function closePopover() {
            if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
            popover = null;
            document.removeEventListener('click', docClickHandler);
        }
        function docClickHandler(e) {
            if (!popover) return;
            if (!popover.contains(e.target) && !avatar.contains(e.target)) closePopover();
        }

        avatar.addEventListener('click', function (e) {
            // only on small screens show a popover; on desktop the name is visible
            if (window.innerWidth > 768) return;
            e.stopPropagation();
            if (popover) { closePopover(); return; }

            // get user name from localStorage if available, else from DOM
            let name = 'User';
            try {
                const stored = localStorage.getItem('currentUser');
                if (stored) {
                    const u = JSON.parse(stored);
                    if (u && u.fullName) name = u.fullName;
                    else if (u && u.email) name = u.email;
                }
            } catch (er) {}
            if (!name || name === 'User') {
                const el = document.getElementById('userName');
                if (el && el.textContent) name = el.textContent.replace(/^Welcome,\s*/i, '') || name;
            }

            popover = document.createElement('div');
            popover.id = 'profilePopover';
            popover.className = 'profile-popover';
            popover.innerHTML = `<strong>${name}</strong>`;
            document.body.appendChild(popover);

            // position popover below avatar (keep within viewport)
            const rect = avatar.getBoundingClientRect();
            const popRect = popover.getBoundingClientRect();
            let top = rect.bottom + 8;
            let left = rect.left;
            // ensure popover doesn't overflow right edge
            if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
            if (left < 8) left = 8;
            popover.style.top = (top + window.scrollY) + 'px';
            popover.style.left = (left + window.scrollX) + 'px';

            // close on outside click
            setTimeout(() => { document.addEventListener('click', docClickHandler); }, 0);
        });
    })();

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
