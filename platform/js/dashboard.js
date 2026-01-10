document.addEventListener('DOMContentLoaded', function() {
    loadDashboardStats();
});

async function loadDashboardStats() {
    // find current user (prefer Firebase auth)
    let currentUser = null;
    if (window.firebase && firebase.auth) {
        currentUser = firebase.auth().currentUser || null;
        if (!currentUser) {
            // wait briefly for SDK to initialize
            currentUser = await new Promise(resolve => {
                let handled = false;
                const t = setTimeout(() => { if (!handled) { handled = true; resolve(null); } }, 2000);
                try {
                    firebase.auth().onAuthStateChanged(u => { if (!handled) { handled = true; clearTimeout(t); resolve(u); } });
                } catch (e) { clearTimeout(t); resolve(null); }
            });
        }
    }
    if (!currentUser) {
        try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { currentUser = null; }
    }

    const userId = currentUser && (currentUser.uid || currentUser.id || currentUser.email) ? (currentUser.uid || currentUser.id || currentUser.email) : null;

    // small helper to animate numeric counts from start -> end
    function animateCount(el, end, opts) {
        if (!el) return;
        opts = opts || {};
        const duration = opts.duration || 800;
        const suffix = opts.suffix || '';
        const start = Number((el.dataset._lastValue !== undefined) ? el.dataset._lastValue : (parseInt(el.textContent,10) || 0));
        const from = isNaN(start) ? 0 : start;
        const to = Number(end) || 0;
        const startTime = performance.now();
        cancelAnimationFrame(el._animFrame || 0);
        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const ease = t<0.5 ? 2*t*t : -1 + (4-2*t)*t; // simple ease
            const val = Math.round(from + (to - from) * ease);
            el.textContent = '' + val + suffix;
            el.dataset._lastValue = val;
            if (t < 1) el._animFrame = requestAnimationFrame(step);
            else {
                el.textContent = '' + to + suffix;
                el.dataset._lastValue = to;
            }
        }
        el._animFrame = requestAnimationFrame(step);
    }

    // Ensure there is a global promise that signals when the session loader has finished
    if (!window.__sessionReady) {
        window.__sessionReady = new Promise(resolve => {
            // expose resolver so the session loader (dashboard.html) can signal when it's ready
            window.__resolveSessionReady = function() { resolve(); };
        });
        // safety: auto-resolve after 5s so the UI doesn't block forever
        setTimeout(() => { try { if (window.__resolveSessionReady) window.__resolveSessionReady(); } catch(e){} }, 5000);
    }

    // queue animations until the global barrier resolves so animations stay in sync
    const __pendingAnimations = [];
    window.__sessionReadyResolved = false;
    function _doAnimate(el, end, opts) {
        if (!el) return;
        opts = opts || {};
        const duration = opts.duration || 800;
        const suffix = opts.suffix || '';
        const start = Number((el.dataset._lastValue !== undefined) ? el.dataset._lastValue : (parseInt(el.textContent,10) || 0));
        const from = isNaN(start) ? 0 : start;
        const to = Number(end) || 0;
        const startTime = performance.now();
        cancelAnimationFrame(el._animFrame || 0);
        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const ease = t<0.5 ? 2*t*t : -1 + (4-2*t)*t; // simple ease
            const val = Math.round(from + (to - from) * ease);
            el.textContent = '' + val + suffix;
            el.dataset._lastValue = val;
            if (t < 1) el._animFrame = requestAnimationFrame(step);
            else {
                el.textContent = '' + to + suffix;
                el.dataset._lastValue = to;
            }
        }
        el._animFrame = requestAnimationFrame(step);
    }

    // override animateCount to queue until barrier resolves
    const origAnimate = animateCount;
    animateCount = function(el, end, opts) {
        if (window.__sessionReadyResolved) { _doAnimate(el,end,opts); return; }
        __pendingAnimations.push([el,end,opts]);
    };

    // (flush will occur after both stats and session barrier resolve)

    // Update New Messages: use RTDB meta node if available
    async function updateNewMessages() {
        const el = document.getElementById('newMessages');
        if (!el) return;
        try {
            if (window.firebase && firebase.database && userId) {
                const metaRef = firebase.database().ref(`one_on_one/${userId}/meta`);
                const snap = await metaRef.once('value');
                const meta = snap.val() || {};
                const count = parseInt(meta.unreadCount || 0, 10) || (meta.unreadForUser ? 1 : 0);
                animateCount(el, count);
                // also attach listener for live updates
                metaRef.on('value', s => {
                    const m = s.val() || {};
                    const c2 = parseInt(m.unreadCount || 0, 10) || (m.unreadForUser ? 1 : 0);
                    animateCount(el, c2);
                });
                return;
            }
        } catch (e) { console.debug('updateNewMessages failed', e); }

        // Local fallback: try stored support meta
        try {
            const lastSeenKey = `supportLastSeen:${userId}`;
            const lastSeen = parseInt(localStorage.getItem(lastSeenKey) || '0', 10) || 0;
            // best-effort: read any locally-saved messages under `oneOnOneMessages:${userId}`
            const localMsgs = JSON.parse(localStorage.getItem(`oneOnOneMessages:${userId}`) || '[]');
            const unread = localMsgs.filter(m => { const t = new Date(m.timestamp||0).getTime(); return t > lastSeen; }).length;
            animateCount(el, unread || 0);
        } catch (e) { el.textContent = '0'; }
    }

    // Update New Videos / New Notes: count items with createdAt/uploadDate within past 3 days
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    async function countRecentCollection(collectionName, timeFieldNames) {
        // timeFieldNames: array of possible fields like ['createdAt','uploadDate']
        try {
            if (window.firebase && firebase.firestore) {
                const db = firebase.firestore();
                const snap = await db.collection(collectionName).get();
                let docs = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                let cnt = 0;
                docs.forEach(doc => {
                    let t = null;
                    for (const f of timeFieldNames) {
                        if (doc[f]) { t = doc[f]; break; }
                    }
                    if (!t) return;
                    // Firestore Timestamp has toDate
                    if (t && typeof t.toDate === 'function') t = t.toDate().getTime();
                    else t = new Date(t).getTime();
                    if (!isNaN(t) && (now - t) <= THREE_DAYS_MS) cnt++;
                });
                return cnt;
            }
            // REST fallback
            const project = 'kakn-sites-7c4e9';
            const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collectionName}`;
            const res = await fetch(url);
            if (!res.ok) return 0;
            const json = await res.json();
            const docs = (json.documents||[]);
            let cnt = 0;
            docs.forEach(docItem => {
                const f = docItem.fields || {};
                let tstr = null;
                for (const tf of timeFieldNames) {
                    if (f[tf] && (f[tf].timestampValue || f[tf].stringValue)) { tstr = f[tf].timestampValue || f[tf].stringValue; break; }
                }
                if (!tstr) return;
                const t = new Date(tstr).getTime();
                if (!isNaN(t) && (now - t) <= THREE_DAYS_MS) cnt++;
            });
            return cnt;
        } catch (e) { console.debug('countRecentCollection failed', collectionName, e); return 0; }
    }

    async function updateRecentCounts() {
        const videosEl = document.getElementById('newVideos');
        const notesEl = document.getElementById('newNotes');
        const vcount = await countRecentCollection('videos', ['createdAt','created_at','created']);
        const ncount = await countRecentCollection('notes', ['createdAt','uploadDate','created_at']);
        if (videosEl) animateCount(videosEl, vcount);
        if (notesEl) animateCount(notesEl, ncount);
    }

    // Pending assignments: count assignments where user has not completed and not reviewed
    async function updatePendingAssignments() {
        const el = document.getElementById('pendingAssignments');
        if (!el) return;
        try {
            let assignments = [];
            if (window.firebase && firebase.firestore) {
                const snap = await firebase.firestore().collection('assignments').get();
                assignments = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
            } else {
                assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
            }

            let completions = [];
            let scores = [];
            if (userId && window.firebase && firebase.firestore) {
                try {
                    const cSnap = await firebase.firestore().collection('assignmentCompletions').where('userId','==',userId).get();
                    completions = cSnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                } catch (e) { console.debug('assignmentCompletions fetch failed', e); }
                try {
                    const sSnap = await firebase.firestore().collection('assignmentScores').where('userId','==',userId).get();
                    scores = sSnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                } catch (e) { console.debug('assignmentScores fetch failed', e); }
            } else {
                try { completions = JSON.parse(localStorage.getItem('assignmentCompletions') || '[]').filter(s => s.userId === userId); } catch (e) { completions = []; }
                try { scores = JSON.parse(localStorage.getItem('assignmentScores') || '[]').filter(s => s.userId === userId); } catch (e) { scores = []; }
            }

            const completedSet = new Set(completions.map(c => c.assignmentId || c.assignmentID || c.id));
            const reviewedSet = new Set(scores.map(s => s.assignmentId));

            let pendingCount = 0;
            assignments.forEach(a => {
                if (a.status && a.status === 'achieved') return; // skip archived
                const id = a.id || a.assignmentId || a.docId;
                if (!id) return;
                if (reviewedSet.has(id)) return; // reviewed
                if (completedSet.has(id)) return; // completed
                pendingCount++;
            });
            animateCount(el, pendingCount);
        } catch (e) { console.debug('updatePendingAssignments failed', e); el.textContent = '0'; }
    }

    // Run updates in parallel and collect promises
    const pNewMessages = updateNewMessages();
    const pRecentCounts = updateRecentCounts();
    const pPendingAssignments = updatePendingAssignments();

    // Recent activity: load last 6 user activities
    async function updateRecentActivity() {
        const listEl = document.getElementById('activityList');
        if (!listEl) return;
        try {
            // show spinner while loading
            listEl.innerHTML = '<div class="section-spinner"><div class="loader"></div></div>';
            let activities = [];
            if (window.firebase && firebase.firestore && userId) {
                try {
                    const snap = await firebase.firestore().collection('activity').where('userId','==',userId).orderBy('timestamp','desc').limit(6).get();
                    activities = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                } catch (e) { console.debug('activity SDK fetch failed', e); }
            }

            // REST / local fallback
            if (!activities || activities.length === 0) {
                try {
                    const stored = JSON.parse(localStorage.getItem('activityLog') || '[]') || [];
                    // build a set of possible ids to match: prefer uid/email/id and also allow legacy 'unknown'
                    const possibleIds = new Set();
                    if (userId) possibleIds.add(userId);
                    try {
                        const cu = currentUser || JSON.parse(localStorage.getItem('currentUser') || 'null');
                        if (cu) {
                            if (cu.uid) possibleIds.add(cu.uid);
                            if (cu.email) possibleIds.add(cu.email);
                            if (cu.id) possibleIds.add(cu.id);
                        }
                    } catch (e) {}
                    possibleIds.add('unknown');

                    activities = (stored || []).filter(a => {
                        // include if no userId (legacy) or matches any possible id
                        if (!a || !a.userId) return true;
                        return possibleIds.has(a.userId);
                    }).slice().sort((a,b)=> new Date(b.timestamp||0) - new Date(a.timestamp||0)).slice(0,6);
                } catch (e) { activities = activities || []; }
            }

            // store fetched activities and render only when dashboard-data-ready fires
            window.__fetchedActivities = activities || [];
            function renderFetchedActivities() {
                try {
                    const acts = window.__fetchedActivities || [];
                    if (!acts || acts.length === 0) { listEl.innerHTML = ''; return; }
                    function escapeHtml(str){ return (str||'').toString().replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
                    listEl.innerHTML = acts.map(act => {
                        const type = act.type || 'event';
                        const title = act.title || (act.meta && act.meta.title) || '';
                        const time = timeAgo(act.timestamp || act.createdAt || new Date().toISOString());
                        const icon = (function(t){ switch(t){ case 'assignment_submitted': return 'fas fa-check'; case 'video_watched': return 'fas fa-video'; case 'pdf_download': return 'fas fa-file-pdf'; case 'pdf_view': return 'fas fa-file-pdf'; case 'login': return 'fas fa-sign-in-alt'; case 'certificate_view': return 'fas fa-certificate'; case 'support_message_sent': return 'fas fa-comment-dots'; default: return 'fas fa-info-circle'; } })(type);
                        const humanTitle = (function(t, ttl, m){ switch(t){ case 'assignment_submitted': return (ttl || 'Assignment Submitted'); case 'video_watched': return 'Watched: ' + (ttl || 'Video'); case 'pdf_download': return 'Downloaded: ' + (ttl || 'PDF'); case 'pdf_view': return 'Viewed: ' + (ttl || 'PDF'); case 'login': return 'Logged in'; case 'certificate_view': return 'Viewed Certificate'; case 'support_message_sent': return 'Sent: Support Message'; default: return (ttl || 'Activity'); } })(type, title, act.meta);
                        return `
                            <div class="activity-item">
                                <div class="activity-icon">
                                    <i class="${icon}"></i>
                                </div>
                                <div class="activity-content">
                                    <p class="activity-title">${escapeHtml(humanTitle)}</p>
                                    <p class="activity-time">${escapeHtml(time)}</p>
                                </div>
                            </div>
                        `;
                    }).join('');
                } catch (e) { console.debug('renderFetchedActivities failed', e); }
            }

            if (window.__sessionReadyResolved) renderFetchedActivities();
            else document.addEventListener('dashboard-data-ready', function _onReady(){ renderFetchedActivities(); document.removeEventListener('dashboard-data-ready', _onReady); });
        } catch (e) { console.debug('updateRecentActivity failed', e); }
    }

    function timeAgo(input) {
        try {
            const then = new Date(input).getTime();
            if (isNaN(then)) return '';
            const diff = Date.now() - then;
            const sec = Math.floor(diff / 1000);
            if (sec < 60) return `${sec}s ago`;
            const min = Math.floor(sec / 60);
            if (min < 60) return `${min}m ago`;
            const hr = Math.floor(min / 60);
            if (hr < 24) return `${hr}h ago`;
            const days = Math.floor(hr / 24);
            if (days < 7) return `${days} day${days>1?'s':''} ago`;
            return new Date(then).toLocaleDateString();
        } catch (e) { return ''; }
    }

    const pActivities = updateRecentActivity();

    // Wait for both stats to finish initial fetch and for sessions (global barrier) before flushing animations
    const statsReady = Promise.all([pNewMessages, pRecentCounts, pPendingAssignments, pActivities].map(p => Promise.resolve(p).catch(() => null)));
    Promise.all([statsReady, window.__sessionReady]).then(async () => {
        // mark resolved and flush any pending animations so numbers and activity render together
        try { window.__sessionReadyResolved = true; __pendingAnimations.forEach(args => { try { _doAnimate(args[0], args[1], args[2]); } catch(e){} }); } catch(e) {}
        try { document.dispatchEvent(new CustomEvent('dashboard-data-ready')); } catch(e){}
        // compute and animate completion percentage now
        try {
            let assignments = [];
            if (window.firebase && firebase.firestore) {
                const snap = await firebase.firestore().collection('assignments').get();
                assignments = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
            } else assignments = JSON.parse(localStorage.getItem('assignments') || '[]');

            let completions = [];
            if (userId && window.firebase && firebase.firestore) {
                try {
                    const cSnap = await firebase.firestore().collection('assignmentCompletions').where('userId','==',userId).get();
                    completions = cSnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                } catch (e) { completions = []; }
            } else {
                try { completions = JSON.parse(localStorage.getItem('assignmentCompletions') || '[]').filter(s => s.userId === userId); } catch(e){ completions = []; }
            }
            const total = assignments.filter(a => !(a.status && a.status === 'achieved')).length || 0;
            const completed = completions.length || 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const completionEl = document.getElementById('completionPercentage');
            if (completionEl) animateCount(completionEl, pct, { suffix: '%' });
        } catch (e) { console.debug('computeCompletion failed', e); }
    }).catch(e=>{ console.debug('dashboard stats+sessions wait failed', e); });
}
