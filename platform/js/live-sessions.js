let currentJitsiApi = null;

async function fetchSessionDoc(id) {
    // SDK
    if (window.firebase && firebase.firestore) {
        try {
            const doc = await firebase.firestore().collection('sessions').doc(id).get();
            if (doc && doc.exists) return { id: doc.id, ...(doc.data() || {}) };
            return null;
        } catch (e) { console.debug('SDK fetchSessionDoc failed', e); }
    }

    // REST
    try {
        const project = 'kakn-sites-7c4e9';
        const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/sessions/${encodeURIComponent(id)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        const f = json.fields || {};
        return {
            id: json.name ? json.name.split('/').pop() : id,
            title: f.title && f.title.stringValue ? f.title.stringValue : '',
            topic: f.topic && f.topic.stringValue ? f.topic.stringValue : '',
            date: f.date && f.date.stringValue ? f.date.stringValue : '',
            startTime: f.startTime && f.startTime.stringValue ? f.startTime.stringValue : '',
            endTime: f.endTime && f.endTime.stringValue ? f.endTime.stringValue : '',
            instructor: f.instructor && f.instructor.stringValue ? f.instructor.stringValue : '',
            room: f.room && f.room.stringValue ? f.room.stringValue : '',
            active: f.active && f.active.booleanValue ? true : false
        };
    } catch (e) { console.debug('REST fetchSessionDoc failed', e); }

    // local fallback
    try { return JSON.parse(localStorage.getItem(`session_current`)); } catch(e){ return null; }
}

function renderStatus(current) {
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');
    const joinBtn = document.getElementById('joinSessionBtn');
    if (!statusLight || !statusText || !joinBtn) return;
    if (current && current.active) {
        statusLight.classList.add('active');
        statusText.textContent = 'Session Active';
        joinBtn.style.display = 'inline-block';
    } else {
        statusLight.classList.remove('active');
        statusText.textContent = 'No Active Session';
        joinBtn.style.display = 'none';
    }
}

function renderSessionDetails(current, next) {
    const sessionDetails = document.getElementById('sessionDetails');
    if (sessionDetails) {
        if (current) {
            const dateText = current.date ? new Date(current.date).toLocaleDateString() : '';
            sessionDetails.innerHTML = `
                <h3>${escapeHtml(current.title || 'Live Session')}</h3>
                <p><i class="fas fa-calendar"></i> ${escapeHtml(dateText)}</p>
                <p><i class="fas fa-clock"></i> ${escapeHtml(current.startTime || '')} - ${escapeHtml(current.endTime || '')}</p>
                <p><i class="fas fa-user"></i> Instructor: ${escapeHtml(current.instructor || '')}</p>
            `;
        } else if (next) {
            const dateText = next.date ? new Date(next.date).toLocaleDateString() : '';
            sessionDetails.innerHTML = `
                <h3>Next Session: ${escapeHtml(next.title || 'Upcoming')}</h3>
                <p><i class="fas fa-calendar"></i> ${escapeHtml(dateText)}</p>
                <p><i class="fas fa-clock"></i> ${escapeHtml(next.startTime || '')} - ${escapeHtml(next.endTime || '')}</p>
                <p><i class="fas fa-user"></i> Instructor: ${escapeHtml(next.instructor || '')}</p>
            `;
        } else {
            // fallback sample text
            sessionDetails.innerHTML = `<h3>No scheduled sessions</h3>`;
        }
    }

    // update upcoming list (replace first card)
    const firstCard = document.querySelector('.session-list .session-item-card');
    if (firstCard && next) {
        const d = new Date(next.date || Date.now());
        const day = d.getDate();
        const month = d.toLocaleString(undefined, { month: 'short' });
        firstCard.querySelector('.day') && (firstCard.querySelector('.day').textContent = day);
        firstCard.querySelector('.month') && (firstCard.querySelector('.month').textContent = month);
        firstCard.querySelector('h4') && (firstCard.querySelector('h4').textContent = next.title || 'Upcoming Session');
        const timeEl = firstCard.querySelector('.session-time');
        if (timeEl) timeEl.innerHTML = `<i class="fas fa-clock"></i> ${escapeHtml(next.startTime || '')} - ${escapeHtml(next.endTime || '')}`;
        const instr = firstCard.querySelector('.session-instructor');
        if (instr) instr.innerHTML = `<i class="fas fa-user"></i> ${escapeHtml(next.instructor || '')}`;
        const topic = firstCard.querySelector('.session-topic');
        if (topic) topic.textContent = next.topic || '';
    }
}

function escapeHtml(str){ return (str||'').toString().replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function refreshSessions() {
    const current = await fetchSessionDoc('current');
    const next = await fetchSessionDoc('next');
    renderStatus(current);
    renderSessionDetails(current, next);
    // store room in join button dataset
    const joinBtn = document.getElementById('joinSessionBtn');
    if (joinBtn) joinBtn.dataset.room = (current && current.room) || '';
}

document.addEventListener('DOMContentLoaded', function() {
    const joinBtn = document.getElementById('joinSessionBtn');
    const closeModal = document.getElementById('closeJoinModal');
    const joinModal = document.getElementById('sessionJoinModal');
    if (joinBtn) joinBtn.style.display = 'none';

    // realtime SDK listeners
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            db.collection('sessions').doc('current').onSnapshot(() => refreshSessions());
            db.collection('sessions').doc('next').onSnapshot(() => refreshSessions());
        } catch(e){ console.debug('subscribe sessions failed', e); }
    }

    refreshSessions();

    if (joinBtn) joinBtn.addEventListener('click', async () => {
        const room = (joinBtn.dataset.room || '').toString().trim();
        if (!room) return alert('Session meeting not configured. Contact the admin.');
        // normalize/validate
        function normalizeMeetInput(input) {
            const v = (input || '').toString().trim();
            if (!v) return null;
            if (/^https?:\/\//i.test(v)) return v;
            if (/^[A-Za-z0-9-]+$/.test(v)) return `https://meet.google.com/${encodeURIComponent(v)}`;
            return null;
        }

        const openUrl = normalizeMeetInput(room);
        if (!openUrl) return alert('Configured meeting link/code is invalid. Contact the admin to provide a proper Google Meet URL or meeting code.');
        window.open(openUrl, '_blank');
    });

    if (closeModal) closeModal.addEventListener('click', () => {
        const modal = document.getElementById('sessionJoinModal');
        if (modal) modal.style.display = 'none';
        const container = document.getElementById('jaas-container'); if (container) container.innerHTML = '';
    });

    // simple reminder buttons
    const reminderButtons = document.querySelectorAll('.session-item-card .btn-outline');
    reminderButtons.forEach(button => {
        button.addEventListener('click', function() {
            alert('Reminder has been set! You will be notified before the session starts.');
        });
    });
});

function initJitsi(/* roomName */) {
    // legacy Jitsi initializer removed — Google Meet redirects are used instead.
    console.warn('initJitsi() is deprecated. Google Meet links are opened in a new tab.');
}

