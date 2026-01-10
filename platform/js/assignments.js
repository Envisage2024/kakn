/*
  Dynamic assignments UI for users.
  - waits for firebase to be available (falls back to localStorage)
  - loads assignments (admin uploads) into Pending
  - loads completions (collection: assignmentCompletions) per user into Completed
  - loads reviews/scores (collection: assignmentScores) per user into Reviewed
  - provides buttons: "New" (open assignment URL) and "Mark as completed" (confirm, save completion)
  - clicking reviewed card opens a modal with admin score/comments
*/

document.addEventListener('DOMContentLoaded', () => {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const container = document.getElementById('assignmentsContainer');
    const pendingTab = tabs.find(t => t.dataset.filter === 'pending');
    const completedTab = tabs.find(t => t.dataset.filter === 'completed');
    const reviewedTab = tabs.find(t => t.dataset.filter === 'reviewed');

    function activateTab(filter) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
        // show/hide cards according to filter
        const cards = container.querySelectorAll('.assignment-card');
        // remove any existing empty-state message for a clean slate
        const existingEmpty = document.getElementById('assignEmptyState');
        if (existingEmpty && existingEmpty.parentNode) existingEmpty.parentNode.removeChild(existingEmpty);
        cards.forEach(c => c.style.display = (filter === 'all' || c.dataset.status === filter) ? 'block' : 'none');

        // if no cards are visible for this filter, show centered empty-state message
        const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
            if (visibleCards.length === 0) {
                const empty = document.createElement('div');
                empty.id = 'assignEmptyState';
                empty.className = 'section-spinner';
                empty.style.cssText = 'min-height:160px;display:flex;align-items:center;justify-content:center;';
                empty.innerHTML = "<p class=\"no-data\" style=\"font-size:18px;font-weight:600;color:#111827;text-align:center;margin:0\">All set - There's nothing to show here!</p>";
                container.appendChild(empty);
        }
    }

    tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.filter)));

    // review modal
    const reviewModal = document.getElementById('assignmentReviewModal');
    const reviewBody = document.getElementById('reviewBody');
    const reviewTitle = document.getElementById('reviewTitle');
    const closeReviewBtn = document.getElementById('closeReviewBtn');
    if (closeReviewBtn) closeReviewBtn.addEventListener('click', () => reviewModal.style.display = 'none');

    // Spinner control shown while Firebase initializes and data loads
    function showSpinner() {
        if (!container) return;
        container.innerHTML = `<div id="assignmentsSpinner" class="section-spinner"><div class="spinner"></div></div>`;
    }
    function hideSpinner() {
        const s = document.getElementById('assignmentsSpinner');
        if (s && s.parentNode) s.parentNode.removeChild(s);
    }

    // spinner markup is present in HTML so no need to re-insert here

    // wait for firebase (if available). If using Firebase Auth, wait for onAuthStateChanged
    waitForFirebase(5000).then(firebaseAvailable => {
        if (firebaseAvailable && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    // not signed in - redirect or attempt localStorage user
                    const stored = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('currentStudent') || 'null');
                    if (!stored) {
                        // keep user on page but nothing to load; optionally redirect
                        console.warn('No authenticated user found.');
                        initPage(false, null);
                        return;
                    }
                    initPage(false, stored);
                    return;
                }
                initPage(true, user);
            });
        } else {
            // no Firebase auth - fallback to localStorage
            const stored = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('currentStudent') || 'null');
            initPage(false, stored);
        }
    });

    function waitForFirebase(timeout = 3000) {
        return new Promise(resolve => {
            if (window.firebase && firebase.firestore) return resolve(true);
            const start = Date.now();
            const iv = setInterval(() => {
                if (window.firebase && firebase.firestore) { clearInterval(iv); return resolve(true); }
                if (Date.now() - start > timeout) { clearInterval(iv); return resolve(false); }
            }, 200);
        });
    }

    async function initPage(hasFirebase, currentUser) {
        // currentUser is provided by onAuthStateChanged when using Firebase, or from localStorage fallback
        try { if (!currentUser) currentUser = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('currentStudent') || 'null'); } catch (e) { currentUser = null; }
        const userId = currentUser && (currentUser.uid || currentUser.id) ? (currentUser.uid || currentUser.id) : (currentUser && currentUser.userId ? currentUser.userId : null);

        // fetch assignments (newest first)
        let assignments = [];
        if (hasFirebase) {
            try {
                const snap = await firebase.firestore().collection('assignments').orderBy('createdAt', 'desc').get();
                assignments = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
            } catch (err) { console.error('Failed to load assignments from Firestore', err); }
        }
        if (!assignments.length) {
            // try localStorage
            try { assignments = JSON.parse(localStorage.getItem('assignments') || '[]').slice().reverse(); } catch(e){ assignments = []; }
        }

        // fetch completions and scores for current user
        let completions = [];
        let scores = [];
        if (userId && hasFirebase) {
            try {
                const cSnap = await firebase.firestore().collection('assignmentCompletions').where('userId','==',userId).get();
                completions = cSnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
            } catch (e) { console.warn('Failed to load completions', e); }
            try {
                const sSnap = await firebase.firestore().collection('assignmentScores').where('userId','==',userId).get();
                scores = sSnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
            } catch (e) { console.warn('Failed to load scores', e); }
        } else {
            try { completions = JSON.parse(localStorage.getItem('assignmentCompletions') || '[]').filter(s=> (s.userId === userId)); } catch(e){ completions = []; }
            try { scores = JSON.parse(localStorage.getItem('assignmentScores') || '[]').filter(s=> (s.userId === userId)); } catch(e){ scores = []; }
        }

        // maps for quick lookup
        const completedSet = new Set(completions.map(c=>c.assignmentId));
        const scoreMap = new Map(); scores.forEach(s => { scoreMap.set(s.assignmentId, s); });

        // render assignments into container
        container.innerHTML = '';

        if (!assignments.length) {
            // center the friendly empty-state message where the spinner was
                container.innerHTML = "<div id=\"assignEmptyState\" class=\"section-spinner\" style=\"min-height:160px;display:flex;align-items:center;justify-content:center;\"><p class=\"no-data\" style=\"font-size:18px;font-weight:600;color:#111827;text-align:center;margin:0\">All set - There's nothing to show here!</p></div>";
            hideSpinner();
            return;
        }

        assignments.forEach(a => {
            // skip achieved assignments (admin archived)
            if (a.status === 'achieved') return;
            const isCompleted = completedSet.has(a.id);
            const score = scoreMap.get(a.id) || null;
            const status = score ? 'reviewed' : (isCompleted ? 'completed' : 'pending');

            const card = document.createElement('div');
            card.className = 'assignment-card';
            card.dataset.status = status;
            card.dataset.assignmentId = a.id;
            const dueText = a.dueDate ? (new Date(a.dueDate)).toLocaleDateString() : '';
            // find any completion record for this assignment and normalize completedAt
            const compRecord = completions.find(c => (c.assignmentId || c.assignmentID || c.id) === a.id) || null;
            let submittedDisplay = '';
            if (compRecord && compRecord.completedAt) {
                try {
                    let d = compRecord.completedAt;
                    // Firestore Timestamp has toDate()
                    if (d && typeof d.toDate === 'function') d = d.toDate();
                    // strings or numbers convert via Date
                    d = new Date(d);
                    if (!isNaN(d)) submittedDisplay = 'Submitted: ' + d.toLocaleDateString();
                    else submittedDisplay = 'Submitted';
                } catch (e) { submittedDisplay = 'Submitted'; }
            }

            card.innerHTML = `
                <div class="assignment-header">
                    <h3>${escapeHtml(a.title || 'Untitled')}</h3>
                    <span class="status-badge ${status}">${capitalize(status)}</span>
                </div>
                <p class="assignment-description">${escapeHtml(a.instructions || '')}</p>
                <div class="assignment-footer">
                    <span class="deadline"><i class="fas fa-calendar"></i> ${ isCompleted ? (submittedDisplay || 'Submitted') : (dueText ? ('Due: ' + dueText) : '') }</span>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-primary btn-sm btn-open" data-url="${escapeHtml(a.googleFormUrl||'')}">View</button>
                        ${ status === 'pending' ? `<button class="btn-outline btn-sm btn-complete">Mark as completed</button>` : '' }
                        ${ status === 'reviewed' ? `<button class="btn-outline btn-sm btn-viewreview">View Feedback</button>` : '' }
                    </div>
                </div>
            `;

            // store the assignment URL on the card for later use (e.g., when marking completed)
            try { card.dataset.url = a.googleFormUrl || ''; } catch (e) {}

            // append
            container.appendChild(card);
        });

        // attach handlers via event delegation so dynamically-updated buttons always work
        container.addEventListener('click', function (e) {
            const btn = e.target.closest('.btn-open');
            if (!btn) return;
            const url = btn.dataset.url || (btn.closest('.assignment-card') && btn.closest('.assignment-card').dataset.url) || '';
            if (url) window.open(url, '_blank'); else alert('No URL provided for this assignment.');
        });

        // No separate 'View Submission' button any more; the single 'View' button handles opening the URL.

        container.querySelectorAll('.btn-complete').forEach(b => b.addEventListener('click', async (e) => {
            const card = b.closest('.assignment-card');
            const aid = card.dataset.assignmentId;
            if (!confirm('Are you sure you want to mark this assignment as completed?')) return;
            // save completion
            try {
                if (hasFirebase) {
                    await firebase.firestore().collection('assignmentCompletions').add({ assignmentId: aid, userId: userId, completedAt: firebase.firestore.FieldValue.serverTimestamp() });
                } else {
                    const arr = JSON.parse(localStorage.getItem('assignmentCompletions') || '[]');
                    arr.push({ id: Date.now().toString(), assignmentId: aid, userId: userId, completedAt: new Date().toISOString() });
                    localStorage.setItem('assignmentCompletions', JSON.stringify(arr));
                }
                // move card status to completed and show submitted date
                card.dataset.status = 'completed';
                const badge = card.querySelector('.status-badge'); if (badge) { badge.className='status-badge completed'; badge.textContent='Completed'; }

                // Determine a displayable submitted date (use local time immediately)
                const submittedDate = (new Date()).toISOString();
                const displayDate = (new Date(submittedDate)).toLocaleDateString();
                // update footer deadline with timestamp
                const deadline = card.querySelector('.deadline'); if (deadline) deadline.innerHTML = '<i class="fas fa-check"></i> Submitted: ' + displayDate;

                // replace footer buttons with a single View button (opens the assignment URL)
                const footer = card.querySelector('.assignment-footer div');
                if (footer) {
                    const url = card.dataset.url || '';
                    footer.innerHTML = `<button class="btn-primary btn-sm btn-open" data-url="${escapeHtml(url)}">View</button>`;
                    const newBtn = footer.querySelector('.btn-open');
                    if (newBtn) newBtn.addEventListener('click', (ev) => { if (url) window.open(url, '_blank'); else alert('No URL provided for this assignment.'); });
                }

                // locally persist the completion timestamp for non-Firebase fallback
                try {
                    if (!hasFirebase) {
                        const arr = JSON.parse(localStorage.getItem('assignmentCompletions') || '[]');
                        arr.push({ id: Date.now().toString(), assignmentId: aid, userId: userId, completedAt: submittedDate });
                        localStorage.setItem('assignmentCompletions', JSON.stringify(arr));
                    }
                } catch (e) { /* ignore */ }

                // Log activity: assignment submitted
                try {
                    const titleEl = card.querySelector('h3');
                    const assignmentTitle = titleEl ? titleEl.textContent.trim() : '';
                    if (window.logActivity) window.logActivity('assignment_submitted', assignmentTitle || 'Assignment Submitted', { assignmentId: aid });
                } catch (e) {}

                // refresh tabs
                activateTab(tabs.find(t=>t.classList.contains('active')).dataset.filter);
            } catch (err) { console.error('Error saving completion', err); alert('Failed to mark completed.'); }
        }));

        container.querySelectorAll('.btn-viewreview').forEach(b => b.addEventListener('click', (e) => {
            const card = b.closest('.assignment-card');
            const aid = card.dataset.assignmentId;
            const sc = scoreMap.get(aid) || (scores.find(s=>s.assignmentId===aid));
            if (!sc) return alert('No review available yet.');
            // populate modal
            reviewTitle.textContent = sc.assignmentTitle || 'Assignment Review';
            reviewBody.innerHTML = `
                <p><strong>General Score:</strong> ${escapeHtml(sc.generalScore||'')}</p>
                <p><strong>Score:</strong> ${sc.scoreValue != null ? sc.scoreValue + '/' + (sc.scoreOutOf||'') : 'N/A'}</p>
                <p><strong>Comments:</strong></p>
                <p>${escapeHtml(sc.comments||'')}</p>
            `;
            reviewModal.style.display = 'flex';
        }));

        // clicking the whole card on reviewed should also open modal
        container.querySelectorAll('.assignment-card').forEach(card => {
            if (card.dataset.status === 'reviewed') {
                card.addEventListener('click', () => {
                    const aid = card.dataset.assignmentId;
                    const sc = scoreMap.get(aid) || (scores.find(s=>s.assignmentId===aid));
                    if (!sc) return;
                    reviewTitle.textContent = sc.assignmentTitle || 'Assignment Review';
                    reviewBody.innerHTML = `
                        <p><strong>General Score:</strong> ${escapeHtml(sc.generalScore||'')}</p>
                        <p><strong>Score:</strong> ${sc.scoreValue != null ? sc.scoreValue + '/' + (sc.scoreOutOf||'') : 'N/A'}</p>
                        <p><strong>Comments:</strong></p>
                        <p>${escapeHtml(sc.comments||'')}</p>
                    `;
                    reviewModal.style.display = 'flex';
                });
            }
        });

        // finally, set initial tab to pending
        activateTab('pending');
        // hide the loading spinner now that content is ready
        hideSpinner();
    }

    // small helpers
    function escapeHtml(str) { return (str||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
    function capitalize(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
});
