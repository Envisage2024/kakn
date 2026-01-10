// Admin Dashboard Logic

// Check if admin is logged in
const currentAdmin = getCurrentAdmin();

if (!currentAdmin) {
    // Redirect to the admin login page (admin/index.html)
    window.location.href = 'index.html';
} else {
    // Display admin name if the element exists
    const adminNameEl = document.getElementById('adminName');
    if (adminNameEl && currentAdmin.name) adminNameEl.textContent = currentAdmin.name;
}

// Sidebar Toggle (supports platform-style ids and admin legacy id)
(function setupSidebarToggle(){
    const toggleBtn = document.getElementById('toggleSidebar') || document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar') || document.getElementById('adminSidebar');
    if (!toggleBtn || !sidebar) return;

    function createOverlay() {
        let ov = document.getElementById('mobileOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'mobileOverlay';
            ov.className = 'mobile-overlay';
            ov.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                removeOverlay();
                document.body.classList.remove('no-scroll');
            });
            document.body.appendChild(ov);
        }
    }
    function removeOverlay() {
        const ov = document.getElementById('mobileOverlay');
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    }

    toggleBtn.addEventListener('click', function() {
        // mobile behaviour
        if (window.innerWidth <= 768) {
            const opened = sidebar.classList.toggle('mobile-open');
            if (opened) { createOverlay(); document.body.classList.add('no-scroll'); }
            else { removeOverlay(); document.body.classList.remove('no-scroll'); }
            return;
        }

        // desktop: toggle collapsed state (support both admin and platform classes)
        const nowCollapsed = !sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        // keep existing admin `.active` class in sync so admin CSS keeps working
        sidebar.classList.toggle('active');
        try { if (nowCollapsed) document.documentElement.classList.add('sidebar-collapsed'); else document.documentElement.classList.remove('sidebar-collapsed'); } catch (e) {}
        try { localStorage.setItem('sidebarCollapsed', nowCollapsed); } catch (e) {}
    });

    // Also support an explicit mobile toggle in the top header (id="mobileToggle")
    const mobileToggle = document.getElementById('mobileToggle');
    if (mobileToggle && !mobileToggle.dataset.init) {
        mobileToggle.addEventListener('click', function() {
            const opened = sidebar.classList.toggle('mobile-open');
            if (opened) { createOverlay(); document.body.classList.add('no-scroll'); }
            else { removeOverlay(); document.body.classList.remove('no-scroll'); }
        });
        mobileToggle.dataset.init = '1';
    }
})();

// Section Navigation
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const sections = document.querySelectorAll('.admin-section');

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update active link
        sidebarLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Show corresponding section
        const sectionName = link.getAttribute('data-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`section-${sectionName}`).classList.add('active');
        
        // Load section data
        loadSectionData(sectionName);
        // If on mobile, close the off-canvas sidebar and remove overlay + restore scrolling
        try {
            if (window.innerWidth <= 768) {
                const sb = document.getElementById('adminSidebar');
                if (sb) sb.classList.remove('mobile-open');
                const ov = document.getElementById('mobileOverlay');
                if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
                document.body.classList.remove('no-scroll');
            }
        } catch (err) { /* ignore */ }
    });
});

// Load Section Data
function loadSectionData(sectionName) {
    switch(sectionName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'assignments':
            // Open the Manage Assignments panel by default for admins
            try {
                const assignmentsList = document.getElementById('assignmentsList'); if (assignmentsList) assignmentsList.style.display = 'none';
                const managePanel = document.getElementById('manageAssignmentsPanel'); if (managePanel) managePanel.style.display = 'block';
                const achievedPanel = document.getElementById('achievedAssignmentsPanel'); if (achievedPanel) achievedPanel.style.display = 'none';
            } catch (e) { /* ignore */ }
            // load the manage assignments list (function declared later)
            try { loadManageAssignments(); } catch (e) { /* ignore */ }
            break;
        case 'live-sessions':
            loadLiveSessions();
            break;
        case 'video-tutorials':
            loadVideoTutorials();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'certifications':
            loadCertifications();
            break;
        case 'notes':
            loadNotes();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Dashboard Stats
async function loadDashboardStats() {
    // Try Firestore first for accurate counts, otherwise fallback to localStorage
    let users = [];
    // load assignments from localStorage as a fallback; we'll try Firestore next
    let assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    let messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');

    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('users').get();
            users = snapshot.docs.map(d => d.data());
        } catch (err) {
            console.error('Error fetching users for stats from Firestore:', err);
            users = JSON.parse(localStorage.getItem('users') || '[]');
        }
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
    }

    // total users should reflect approved / verified users
    const approvedCount = users.filter(u => u.verified).length;
    document.getElementById('totalUsers').textContent = approvedCount;

    // Compute active assignments: those not archived/achieved
    let activeAssignmentsCount = (assignments || []).filter(a => (a.status || '').toLowerCase() !== 'achieved' && !a.archived).length;

    // If Firestore is available prefer live counts from it
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snap = await db.collection('assignments').get();
            if (snap && !snap.empty) {
                const items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
                assignments = items;
                activeAssignmentsCount = items.filter(a => ((a.status||'').toLowerCase() !== 'achieved') && !a.archived).length;
            }
        } catch (err) {
            console.error('Error fetching assignments for stats from Firestore:', err);
        }
    }

    document.getElementById('totalAssignments').textContent = activeAssignmentsCount;

    // Compute unread messages count from Realtime DB meta if available, otherwise fallback to localStorage
    if (window.firebase && firebase.database) {
        try {
            const root = firebase.database().ref('one_on_one');
            root.once('value').then(snap => {
                const data = snap.val() || {};
                let unreadCount = 0;
                Object.keys(data).forEach(k => {
                    if (data[k] && data[k].meta && data[k].meta.unreadForAdmin) unreadCount++;
                });
                document.getElementById('unreadMessages').textContent = unreadCount;
            }).catch(() => { document.getElementById('unreadMessages').textContent = messages.filter(m => !m.adminRead).length; });
        } catch (e) { document.getElementById('unreadMessages').textContent = messages.filter(m => !m.adminRead).length; }
    } else {
        const unread = messages.filter(m => !m.adminRead).length;
        document.getElementById('unreadMessages').textContent = unread;
    }

    // Determine certified students using the certificates collection when possible
    let certifiedCount = users.filter(u => u.certified).length;
    // Prefer certificates collection as authoritative if available
    if (window.firebase && firebase.firestore) {
        try {
            const certSnap = await firebase.firestore().collection('certificates').get();
            if (certSnap && typeof certSnap.size === 'number') {
                certifiedCount = certSnap.size;
            } else if (certSnap && certSnap.docs) {
                certifiedCount = certSnap.docs.length;
            }
        } catch (err) {
            console.error('Failed to load certificates for stats:', err);
            // fallback to localStorage or user flag count
            const localCerts = JSON.parse(localStorage.getItem('certificates') || '[]');
            if (localCerts && localCerts.length) certifiedCount = localCerts.length;
        }
    } else {
        // no Firestore available, check localStorage
        const localCerts = JSON.parse(localStorage.getItem('certificates') || '[]');
        if (localCerts && localCerts.length) certifiedCount = localCerts.length;
    }

    document.getElementById('totalCertified').textContent = certifiedCount;

    // Recent enrollments (use createdAt or enrolledDate if available)
    const recentEnrollments = document.getElementById('recentEnrollments');
    if (users.length > 0) {
        const sorted = users.slice().sort((a, b) => {
            const aDate = a.enrolledDate ? new Date(a.enrolledDate) : (a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0)));
            const bDate = b.enrolledDate ? new Date(b.enrolledDate) : (b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0)));
            return bDate - aDate;
        });
        const recent = sorted.slice(0, 5);
        recentEnrollments.innerHTML = recent.map(user => `
            <div class="activity-item">
                <i class="fas fa-user-plus"></i>
                <span>${user.fullName || user.name || (user.firstName ? (user.firstName + ' ' + (user.lastName||'')) : 'Student')} enrolled</span>
                <small>${(user.enrolledDate ? new Date(user.enrolledDate) : (user.createdAt && user.createdAt.toDate ? user.createdAt.toDate() : (user.createdAt ? new Date(user.createdAt) : new Date()))).toLocaleDateString()}</small>
            </div>
        `).join('');
    }
}

// Assignments Management
let questionCount = 1;

// When clicking Add Assignment open the modal instead of the inline form
const addAssignmentBtnEl = document.getElementById('addAssignmentBtn');
if (addAssignmentBtnEl) {
    addAssignmentBtnEl.addEventListener('click', () => {
        const modal = document.getElementById('assignmentModal');
        if (!modal) {
            // fallback to inline form for older behavior
            const form = document.getElementById('assignmentForm');
            if (form) form.style.display = 'block';
            return;
        }
        // use flex to center (modal container uses flexbox styles)
        modal.style.display = 'flex';

        // modal will only be closed via explicit controls (Cancel/Save)
    });
}

document.getElementById('cancelAssignment').addEventListener('click', () => {
    document.getElementById('assignmentForm').style.display = 'none';
    document.getElementById('createAssignmentForm').reset();
});

// Modal cancel handler
const assignmentModalCancel = document.getElementById('assignmentModalCancel');
if (assignmentModalCancel) {
    assignmentModalCancel.addEventListener('click', () => {
        const modal = document.getElementById('assignmentModal');
        if (modal) modal.style.display = 'none';
        const form = document.getElementById('assignmentModalForm');
        if (form) form.reset();
    });
}

// Modal save handler: save to Firestore (with server timestamp) if available, else LocalStorage
const assignmentModalForm = document.getElementById('assignmentModalForm');
if (assignmentModalForm) {
    assignmentModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('modalAssignmentTitle').value.trim();
        const module = document.getElementById('modalAssignmentModule').value;
        const instructions = document.getElementById('modalAssignmentInstructions').value.trim();
        const dueDate = document.getElementById('modalAssignmentDueDate').value || null;
        const formUrl = document.getElementById('modalAssignmentFormUrl').value.trim() || null;

        if (!title || !instructions) {
            alert('Please provide a title and instructions for the assignment.');
            return;
        }

        const payload = {
            title: title,
            module: module,
            instructions: instructions,
            dueDate: dueDate,
            googleFormUrl: formUrl,
        };

        const editingId = assignmentModalForm.dataset.editingId || null;

        // Try Firestore first
        try {
            if (window.firebase && firebase.firestore) {
                const db = firebase.firestore();
                if (editingId) {
                    await db.collection('assignments').doc(editingId).update({
                        ...payload,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert('Assignment updated successfully.');
                } else {
                    await db.collection('assignments').add({
                        ...payload,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert('Assignment saved to Firestore successfully.');
                }
            } else {
                throw new Error('Firestore not available');
            }
        } catch (err) {
            // Fallback: save to localStorage with ISO timestamp or update existing
            const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
            if (editingId) {
                const idx = assignments.findIndex(a => (a.id || '') === editingId);
                if (idx !== -1) {
                    assignments[idx] = Object.assign({}, assignments[idx], payload, { updatedDate: new Date().toISOString() });
                    localStorage.setItem('assignments', JSON.stringify(assignments));
                    alert('Assignment updated locally.');
                } else {
                    assignments.push({ id: editingId, ...payload, createdDate: new Date().toISOString() });
                    localStorage.setItem('assignments', JSON.stringify(assignments));
                    alert('Assignment saved locally.');
                }
            } else {
                assignments.push({
                    id: Date.now().toString(),
                    ...payload,
                    createdDate: new Date().toISOString()
                });
                localStorage.setItem('assignments', JSON.stringify(assignments));
                alert('Firestore unavailable — assignment saved locally.');
            }
        }

        // Clear editing state, close modal and refresh list
        delete assignmentModalForm.dataset.editingId;
        const modal = document.getElementById('assignmentModal');
        if (modal) modal.style.display = 'none';
        assignmentModalForm.reset();
        loadAssignments();
    });
}

document.getElementById('addQuestionBtn').addEventListener('click', () => {
    questionCount++;
    const questionsContainer = document.getElementById('questionsContainer');
    const questionItem = document.createElement('div');
    questionItem.className = 'question-item';
    questionItem.innerHTML = `
        <input type="text" placeholder="Question ${questionCount}" class="question-input" required>
        <textarea placeholder="Model Answer (optional)" class="answer-input" rows="2"></textarea>
    `;
    questionsContainer.appendChild(questionItem);
});

document.getElementById('createAssignmentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const questions = [];
    const questionInputs = document.querySelectorAll('.question-input');
    const answerInputs = document.querySelectorAll('.answer-input');
    
    questionInputs.forEach((input, index) => {
        questions.push({
            question: input.value,
            modelAnswer: answerInputs[index].value
        });
    });
    
    const assignment = {
        id: Date.now().toString(),
        title: document.getElementById('assignmentTitle').value,
        module: document.getElementById('assignmentModule').value,
        instructions: document.getElementById('assignmentInstructions').value,
        questions: questions,
        createdDate: new Date().toISOString()
    };
    
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    assignments.push(assignment);
    localStorage.setItem('assignments', JSON.stringify(assignments));
    
    alert('Assignment created successfully!');
    document.getElementById('assignmentForm').style.display = 'none';
    document.getElementById('createAssignmentForm').reset();
    loadAssignments();
});

async function loadAssignments() {
    const assignmentsList = document.getElementById('assignmentsList');

    // If Firestore is available, prefer reading from it
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('assignments').orderBy('createdAt', 'desc').get();
            if (!snapshot || snapshot.empty) {
                assignmentsList.innerHTML = '<p class="no-data">No assignments yet. Click "Add New Assignment" to create one.</p>';
                return;
            }
            const items = snapshot.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
            assignmentsList.innerHTML = items.map(assignment => {
                const created = assignment.createdAt && assignment.createdAt.toDate ? assignment.createdAt.toDate() : (assignment.createdDate ? new Date(assignment.createdDate) : new Date());
                const qCount = assignment.questions && assignment.questions.length ? assignment.questions.length : 0;
                const due = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '';
                return `
                    <div class="assignment-card">
                        <div class="assignment-header">
                            <h3>${escapeHtml(assignment.title || '')}</h3>
                            <span class="badge">Module ${escapeHtml(assignment.module || '')}</span>
                        </div>
                        <p>${escapeHtml(assignment.instructions || '')}</p>
                        <div class="assignment-meta">
                            ${qCount > 0 ? `<span><i class="fas fa-question-circle"></i> ${qCount} Questions</span>` : ''}
                            <span><i class="fas fa-calendar"></i> ${created.toLocaleDateString()}</span>
                            ${due ? `<span style="margin-left:10px;"><i class="fas fa-hourglass-end"></i> Due ${due}</span>` : ''}
                        </div>
                        <div style="display:flex;gap:8px;margin-top:8px;">
                            <button class="btn btn-secondary btn-sm" onclick="viewResponses('${assignment.id}')">
                                <i class="fas fa-eye"></i> View Responses
                            </button>
                            <button class="btn btn-sm btn-outline assign-edit" data-id="${assignment.id}"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger assign-achieve" data-id="${assignment.id}"><i class="fas fa-archive"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
            // wire edit/achieve buttons
            assignmentsList.querySelectorAll('.assign-edit').forEach(b => b.addEventListener('click', () => editAssignment(b.dataset.id)));
            assignmentsList.querySelectorAll('.assign-achieve').forEach(b => b.addEventListener('click', () => achieveAssignment(b.dataset.id)));
            return;
        } catch (err) {
            console.error('Error loading assignments from Firestore:', err);
            // fall through to localStorage fallback
        }
    }

    // LocalStorage fallback
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    if (!assignments || assignments.length === 0) {
        assignmentsList.innerHTML = '<p class="no-data">No assignments yet. Click "Add New Assignment" to create one.</p>';
        return;
    }
    assignmentsList.innerHTML = assignments.map(assignment => `
        <div class="assignment-card">
            <div class="assignment-header">
                <h3>${assignment.title}</h3>
                <span class="badge">Module ${assignment.module}</span>
            </div>
            <p>${assignment.instructions}</p>
            <div class="assignment-meta">
                ${assignment.questions && assignment.questions.length ? `<span><i class="fas fa-question-circle"></i> ${assignment.questions.length} Questions</span>` : ''}
                <span><i class="fas fa-calendar"></i> ${new Date(assignment.createdDate || Date.now()).toLocaleDateString()}</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button class="btn btn-secondary btn-sm" onclick="viewResponses('${assignment.id}')">
                    <i class="fas fa-eye"></i> View Responses
                </button>
                <button class="btn btn-sm btn-outline assign-edit" data-id="${assignment.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger assign-achieve" data-id="${assignment.id}"><i class="fas fa-archive"></i></button>
            </div>
        </div>
    `).join('');
    assignmentsList.querySelectorAll('.assign-edit').forEach(b => b.addEventListener('click', () => editAssignment(b.dataset.id)));
    assignmentsList.querySelectorAll('.assign-achieve').forEach(b => b.addEventListener('click', () => achieveAssignment(b.dataset.id)));
}

// Live Sessions
function loadLiveSessions() {
    const startBtn = document.getElementById('startLiveSessionBtn');
    const stopBtn = document.getElementById('stopLiveSessionBtn');
    const editCurrentBtn = document.getElementById('editCurrentBtn');
    const editNextBtn = document.getElementById('editNextBtn');
    const currentDetails = document.getElementById('currentSessionDetails');
    const nextDetails = document.getElementById('nextSessionDetails');
    const sessionModal = document.getElementById('sessionModal');
    const sessionClose = document.getElementById('sessionModalClose');
    const cancelSession = document.getElementById('cancelSessionEdit');
    const saveSessionBtn = document.getElementById('saveSessionBtn');

    function parseDocFields(fields) {
        if (!fields) return null;
        const get = (f) => {
            if (!f) return null;
            if (f.stringValue) return f.stringValue;
            if (f.timestampValue) return f.timestampValue;
            return null;
        };
        return {
            title: get(fields.title) || '',
            topic: get(fields.topic) || '',
            date: get(fields.date) || '',
            startTime: get(fields.startTime) || '',
            endTime: get(fields.endTime) || '',
            instructor: get(fields.instructor) || '',
            room: get(fields.room) || '',
            active: fields.active && fields.active.booleanValue ? true : false
        };
    }

    async function fetchSession(id) {
        // SDK first
        if (window.firebase && firebase.firestore) {
            try {
                const doc = await firebase.firestore().collection('sessions').doc(id).get();
                if (doc && doc.exists) return { id: doc.id, ...(doc.data() || {}) };
                return null;
            } catch (e) { console.debug('fetchSession SDK failed', e); }
        }

        // REST fallback
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
        } catch (e) { console.debug('fetchSession REST failed', e); }

        // local fallback
        try {
            const raw = localStorage.getItem(`session_${id}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function renderSession(el, s) {
        if (!el) return;
        if (!s) { el.innerHTML = '<p class="no-data">No session found</p>'; return; }
        const dateText = s.date ? new Date(s.date).toLocaleDateString() : '';
        el.innerHTML = `
            <h4>${escapeHtml(s.title || 'Untitled Session')}</h4>
            <p><strong>Topic:</strong> ${escapeHtml(s.topic || '-')}</p>
            <p><i class="fas fa-calendar"></i> ${escapeHtml(dateText)} • ${escapeHtml(s.startTime || '')} - ${escapeHtml(s.endTime || '')}</p>
            <p><i class="fas fa-user"></i> ${escapeHtml(s.instructor || '-')}</p>
            <p><i class="fas fa-hashtag"></i> Room: ${escapeHtml(s.room || '-')}</p>
            ${s.active ? '<p style="color:var(--primary-green)"><strong>Active now</strong></p>' : ''}
        `;
    }

    async function refresh() {
        const current = await fetchSession('current');
        const next = await fetchSession('next');
        renderSession(currentDetails, current);
        renderSession(nextDetails, next);
        // toggle start/stop
        if (current && current.active) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
        }
    }

    // realtime listeners (SDK)
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            db.collection('sessions').doc('current').onSnapshot(() => { refresh(); });
            db.collection('sessions').doc('next').onSnapshot(() => { refresh(); });
        } catch (e) { /* ignore */ }
    }

    // wire edit buttons
    if (editCurrentBtn) editCurrentBtn.addEventListener('click', () => openSessionModal('current'));
    if (editNextBtn) editNextBtn.addEventListener('click', () => openSessionModal('next'));

    // start/stop handlers
    if (startBtn) startBtn.addEventListener('click', async () => {
        // if next exists, copy next -> current and set active
        const next = await fetchSession('next');
        try {
            let startedRoom = '';
            if (next) {
                const payload = { ...next, active: true };
                // write to current
                await saveSession('current', payload);
                // clear next
                await saveSession('next', null, true);
                startedRoom = payload.room || '';
            } else {
                // toggle current active
                const cur = await fetchSession('current');
                const newCur = { ...(cur||{}), active: true };
                await saveSession('current', newCur);
                startedRoom = newCur.room || '';
            }

            await refresh();

            // open Google Meet in new tab for admin moderation (admin must provide meeting link/code beforehand)
            try {
                const adminName = (window.currentAdmin && window.currentAdmin.name) ? window.currentAdmin.name : (document.getElementById('adminName') && document.getElementById('adminName').textContent) || 'Admin';
                let room = (startedRoom || '').toString().trim();
                if (!room) {
                    // No meeting configured: prompt to create one in Google Meet
                    const create = confirm('No Google Meet link configured for this session. Open Google Meet to create one now? You will need to paste the meeting link into the session settings.');
                    if (create) window.open('https://meet.google.com/new', '_blank');
                    alert('Session started. Students will see the session as active once a meeting link is provided.');
                    return;
                }

                // If room is a URL use it directly, otherwise validate/normalize as Google Meet code
                function normalizeMeetInputLocal(input) {
                    const v = (input || '').toString().trim();
                    if (!v) return null;
                    if (/^https?:\/\//i.test(v)) return v;
                    if (/^[A-Za-z0-9-]+$/.test(v)) return `https://meet.google.com/${encodeURIComponent(v)}`;
                    return null;
                }

                const openUrl = normalizeMeetInputLocal(room);
                if (!openUrl) {
                    const create = confirm('The configured meeting value looks invalid. Open Google Meet to create a meeting now? You can paste the meeting link into the session settings.');
                    if (create) window.open('https://meet.google.com/new', '_blank');
                    alert('Session started. Students will see the session as active once a meeting link is provided.');
                    return;
                }

                window.open(openUrl, '_blank');
            } catch (e) { console.error('Failed to open Google Meet tab', e); }

            alert('Session started. Students will see the session as active. A new tab was opened for you to moderate the meeting.');
        } catch (err) { console.error('Start session error', err); alert('Failed to start session (see console).'); }
    });

    if (stopBtn) stopBtn.addEventListener('click', async () => {
        try {
            const cur = await fetchSession('current');
            if (!cur) return alert('No active session to stop');
            await saveSession('current', { ...(cur||{}), active: false });
            await refresh();
            alert('Session stopped.');
        } catch (err) { console.error('Stop session error', err); alert('Failed to stop session (see console).'); }
    });

    // modal open helper
    function openSessionModal(targetId) {
        if (!sessionModal) return alert('Session editor not available');
        sessionModal.dataset.target = targetId || 'next';
        // populate fields from target
        fetchSession(sessionModal.dataset.target).then(s => {
            document.getElementById('sessionTitle').value = (s && s.title) || '';
            document.getElementById('sessionTopic').value = (s && s.topic) || '';
            document.getElementById('sessionDate').value = (s && s.date) || '';
            document.getElementById('sessionStartTime').value = (s && s.startTime) || '';
            document.getElementById('sessionEndTime').value = (s && s.endTime) || '';
            document.getElementById('sessionInstructor').value = (s && s.instructor) || '';
            document.getElementById('sessionRoom').value = (s && s.room) || '';
            sessionModal.style.display = 'flex';
        }).catch(()=>{ sessionModal.style.display = 'flex'; });
    }

    // modal close
    function closeSessionModal() { if (sessionModal) sessionModal.style.display = 'none'; }
    if (sessionClose) sessionClose.addEventListener('click', closeSessionModal);
    if (cancelSession) cancelSession.addEventListener('click', (e)=>{ e.preventDefault(); closeSessionModal(); });

    // save handler
    async function saveSession(id, data, clear=false) {
        // clear=true -> delete/clear doc
        if (clear) {
            // SDK
            if (window.firebase && firebase.firestore) {
                try { await firebase.firestore().collection('sessions').doc(id).delete(); return; } catch(e) { console.debug('delete SDK failed', e); }
            }
            // REST: set empty doc
            try {
                const project = 'kakn-sites-7c4e9';
                const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/sessions/${encodeURIComponent(id)}`;
                await fetch(url, { method: 'DELETE' });
                localStorage.removeItem(`session_${id}`);
                return;
            } catch(e){ console.debug('delete REST failed', e); }
            localStorage.removeItem(`session_${id}`);
            return;
        }

        // build fields
        const payload = data || {};
        // SDK
        if (window.firebase && firebase.firestore) {
            try {
                const db = firebase.firestore();
                await db.collection('sessions').doc(id).set({
                    title: payload.title || '',
                    topic: payload.topic || '',
                    date: payload.date || '',
                    startTime: payload.startTime || '',
                    endTime: payload.endTime || '',
                    instructor: payload.instructor || '',
                    room: payload.room || '',
                    active: !!payload.active,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return;
            } catch (e) { console.debug('saveSession SDK failed', e); }
        }

        // REST fallback
        try {
            const project = 'kakn-sites-7c4e9';
            const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/sessions/${encodeURIComponent(id)}`;
            const body = { fields: {
                title: { stringValue: payload.title || '' },
                topic: { stringValue: payload.topic || '' },
                date: { stringValue: payload.date || '' },
                startTime: { stringValue: payload.startTime || '' },
                endTime: { stringValue: payload.endTime || '' },
                instructor: { stringValue: payload.instructor || '' },
                room: { stringValue: payload.room || '' },
                active: { booleanValue: !!payload.active }
            } };
            // upsert via PATCH or PUT
            const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) {
                // try create
                const createUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/sessions`;
                await fetch(createUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, { fields: body.fields }, { name: undefined })) });
            }
            // local fallback
            localStorage.setItem(`session_${id}`, JSON.stringify(Object.assign({}, payload)));
            return;
        } catch (e) { console.debug('saveSession REST failed', e); localStorage.setItem(`session_${id}`, JSON.stringify(Object.assign({}, payload))); }
    }

    // save from modal
    // helper: normalize/validate Google Meet input (accept full URL or meeting code)
    function normalizeMeetInput(input) {
        const v = (input || '').toString().trim();
        if (!v) return null;
        // full URL
        if (/^https?:\/\//i.test(v)) return v;
        // simple code allowed: letters, digits and hyphens (common meet codes)
        if (/^[A-Za-z0-9-]+$/.test(v)) return `https://meet.google.com/${encodeURIComponent(v)}`;
        return null;
    }

    if (saveSessionBtn) saveSessionBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const target = (sessionModal && sessionModal.dataset && sessionModal.dataset.target) || 'next';
        const rawRoom = (document.getElementById('sessionRoom').value || '').trim();
        const normalized = normalizeMeetInput(rawRoom);
        const sessionMsgEl = document.getElementById('sessionModalMsg');
        if (rawRoom && !normalized) {
            if (sessionMsgEl) { sessionMsgEl.style.display = 'block'; sessionMsgEl.textContent = 'Invalid Google Meet URL or code. Use a full URL (https://meet.google.com/...) or a meeting code containing letters, numbers and hyphens.'; }
            return;
        }

        if (sessionMsgEl) { sessionMsgEl.style.display = 'none'; sessionMsgEl.textContent = ''; }

        const s = {
            title: (document.getElementById('sessionTitle').value || '').trim(),
            topic: (document.getElementById('sessionTopic').value || '').trim(),
            date: (document.getElementById('sessionDate').value || '').trim(),
            startTime: (document.getElementById('sessionStartTime').value || '').trim(),
            endTime: (document.getElementById('sessionEndTime').value || '').trim(),
            instructor: (document.getElementById('sessionInstructor').value || '').trim(),
            room: normalized || '',
            active: false
        };
        try { await saveSession(target, s); closeSessionModal(); await refresh(); alert('Session saved.'); } catch (err) { console.error('Save session failed', err); alert('Failed to save session.'); }
    });

    // initial refresh
    refresh();
}

// Score Respondents UI
const scoreRespondentsBtn = document.getElementById('scoreRespondentsBtn');
const scoreRespondentsPanel = document.getElementById('scoreRespondentsPanel');
const scoreUsersList = document.getElementById('scoreUsersList');

if (scoreRespondentsBtn) {
    scoreRespondentsBtn.addEventListener('click', async () => {
        // show panel, hide assignments list
        const assignmentsList = document.getElementById('assignmentsList');
        if (assignmentsList) assignmentsList.style.display = 'none';
        if (scoreRespondentsPanel) scoreRespondentsPanel.style.display = 'block';

        // load users
        if (scoreUsersList) scoreUsersList.innerHTML = '<p class="no-data">Loading users...</p>';
        try {
            if (window.firebase && firebase.firestore) {
                const db = firebase.firestore();
                const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
                if (snapshot && !snapshot.empty) {
                    const users = snapshot.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                    if (scoreUsersList) scoreUsersList.innerHTML = users.map(u => `
                        <div class="user-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--border-color);">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <i class="fas fa-user-circle" style="font-size:24px;color:var(--primary-blue)"></i>
                                <div>
                                    <div style="font-weight:600">${escapeHtml(u.fullName || u.name || (u.firstName? (u.firstName+' '+(u.lastName||'')) : 'User'))}</div>
                                    <div style="font-size:0.85rem;color:var(--text-light)">${escapeHtml(u.email || u.username || '')}</div>
                                </div>
                            </div>
                            <div>
                                <button class="btn btn-sm btn-primary" data-user-id="${u.id}" data-user-name="${escapeHtml(u.fullName||u.name||'')||''}" data-user-email="${escapeHtml(u.email||'')||''}">Score</button>
                            </div>
                        </div>
                    `).join('');

                    // wire score buttons
                    if (scoreUsersList) {
                        scoreUsersList.querySelectorAll('button[data-user-id]').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const uid = btn.getAttribute('data-user-id');
                                const name = btn.getAttribute('data-user-name');
                                const email = btn.getAttribute('data-user-email');
                                openScoringModal({ id: uid, name, email });
                            });
                        });
                    }
                    return;
                }
            }
        } catch (err) {
            console.error('Error loading users from Firestore:', err);
        }

        // local fallback
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            if (!users || users.length === 0) {
                if (scoreUsersList) scoreUsersList.innerHTML = '<p class="no-data">No users found.</p>';
                return;
            }
            if (scoreUsersList) scoreUsersList.innerHTML = users.map(u => `
                <div class="user-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <i class="fas fa-user-circle" style="font-size:24px;color:var(--primary-blue)"></i>
                        <div>
                            <div style="font-weight:600">${escapeHtml(u.fullName || u.name || (u.firstName? (u.firstName+' '+(u.lastName||'')) : 'User'))}</div>
                            <div style="font-size:0.85rem;color:var(--text-light)">${escapeHtml(u.email || u.username || '')}</div>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-primary" data-user-id="${u.id || u.uid || ''}" data-user-name="${escapeHtml(u.fullName||u.name||'')}" data-user-email="${escapeHtml(u.email||'')}">Score</button>
                    </div>
                </div>
            `).join('');

            if (scoreUsersList) scoreUsersList.querySelectorAll('button[data-user-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const uid = btn.getAttribute('data-user-id');
                    const name = btn.getAttribute('data-user-name');
                    const email = btn.getAttribute('data-user-email');
                    openScoringModal({ id: uid, name, email });
                });
            });
        } catch (e) {
            if (scoreUsersList) scoreUsersList.innerHTML = '<p class="no-data">No users found.</p>';
        }
    });
}

// removed back button per request

// Open scoring modal for a user
async function openScoringModal(user) {
    const modal = document.getElementById('scoringModal');
    if (!modal) return;
    document.getElementById('scoreUserName').value = user.name || '';
    document.getElementById('scoreUserEmail').value = user.email || '';

    // populate assignments (newest first)
    const sel = document.getElementById('scoreAssignmentSelect');
    sel.innerHTML = '<option>Loading assignments...</option>';
    try {
        if (window.firebase && firebase.firestore) {
            const db = firebase.firestore();
            const snap = await db.collection('assignments').orderBy('createdAt','desc').get();
            if (snap && !snap.empty) {
                sel.innerHTML = snap.docs.map(d => {
                    const data = d.data() || {};
                    const title = data.title || ('Assignment ' + d.id);
                    return `<option value="${d.id}">${escapeHtml(title)}</option>`;
                }).join('');
            } else {
                sel.innerHTML = '<option value="">No assignments</option>';
            }
        } else {
            throw new Error('Firestore not available');
        }
    } catch (err) {
        // fallback to localStorage
        const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
        if (assignments && assignments.length) {
            // assume newest at end? our create pushed to end; show newest first
            const items = assignments.slice().reverse();
            sel.innerHTML = items.map(a => `<option value="${a.id}">${escapeHtml(a.title || '')}</option>`).join('');
        } else {
            sel.innerHTML = '<option value="">No assignments</option>';
        }
    }

    // store current user id on form for submission
    const form = document.getElementById('scoringModalForm');
    form.dataset.targetUserId = user.id || user.uid || '';

    modal.style.display = 'flex';

    // wire cancel
    const cancel = document.getElementById('scoringModalCancel');
    if (cancel) cancel.onclick = () => { modal.style.display = 'none'; form.reset(); };

    // modal will only be closed via explicit controls (Cancel/Save)
}

// scoring form submit
const scoringModalForm = document.getElementById('scoringModalForm');
if (scoringModalForm) {
    scoringModalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = scoringModalForm.dataset.targetUserId;
        const assignmentId = document.getElementById('scoreAssignmentSelect').value;
        const general = document.getElementById('scoreGeneral').value;
        const value = document.getElementById('scoreValue').value;
        const outOf = document.getElementById('scoreOutOf').value;
        const comments = document.getElementById('scoreComments').value;

        if (!userId || !assignmentId) { alert('Missing user or assignment selection.'); return; }

        const payload = {
            userId: userId,
            assignmentId: assignmentId,
            generalScore: general,
            scoreValue: value ? Number(value) : null,
            scoreOutOf: outOf ? Number(outOf) : null,
            comments: comments || null
        };

        try {
            if (window.firebase && firebase.firestore) {
                const db = firebase.firestore();
                await db.collection('assignmentScores').add({
                    ...payload,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                alert('Score saved.');
            } else {
                throw new Error('Firestore not available');
            }
        } catch (err) {
            // fallback to localStorage
            const scores = JSON.parse(localStorage.getItem('assignmentScores') || '[]');
            scores.push({ id: Date.now().toString(), ...payload, createdAt: new Date().toISOString() });
            localStorage.setItem('assignmentScores', JSON.stringify(scores));
            alert('Firestore unavailable — score saved locally.');
        }

        const modal = document.getElementById('scoringModal');
        if (modal) modal.style.display = 'none';
        scoringModalForm.reset();
    });
}

// --- Manage & Achieved Assignments ---
const manageAssignmentsBtn = document.getElementById('manageAssignmentsBtn');
const manageAssignmentsPanel = document.getElementById('manageAssignmentsPanel');
const manageAssignmentsList = document.getElementById('manageAssignmentsList');
const achievedAssignmentsBtn = document.getElementById('achievedAssignmentsBtn');
const achievedAssignmentsPanel = document.getElementById('achievedAssignmentsPanel');
const achievedAssignmentsList = document.getElementById('achievedAssignmentsList');

async function loadManageAssignments() {
    if (!manageAssignmentsList) return;
    manageAssignmentsList.innerHTML = '<p class="no-data">Loading assignments...</p>';
    try {
        if (window.firebase && firebase.firestore) {
            const db = firebase.firestore();
            const snap = await db.collection('assignments').orderBy('createdAt','desc').get();
            if (snap && !snap.empty) {
                const items = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
                const active = items.filter(a => a.status !== 'achieved');
                if (!active.length) { manageAssignmentsList.innerHTML = '<p class="no-data">No assignments found.</p>'; return; }
                manageAssignmentsList.innerHTML = active.map(a => `
                    <div class="assignment-card" data-id="${a.id}" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:10px;border-bottom:1px solid var(--border-color);cursor:pointer;">
                        <div style="flex:1">
                            <h4 style="margin:0">${escapeHtml(a.title||'')}</h4>
                            <div style="color:var(--text-light);font-size:0.85rem">Module ${escapeHtml(a.module||'')}</div>
                            <div class="assignment-excerpt" style="margin-top:6px;color:var(--text-light);font-size:0.95rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(a.instructions||'')}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                            <button class="btn btn-sm btn-outline btn-edit" data-id="${a.id}"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger btn-achieve" data-id="${a.id}"><i class="fas fa-archive"></i></button>
                        </div>
                    </div>
                `).join('');
                // enforce grid layout (inline styles to override any runtime changes)
                try {
                    manageAssignmentsList.style.display = 'grid';
                    manageAssignmentsList.style.gridTemplateColumns = (window.innerWidth && window.innerWidth <= 900) ? '1fr' : 'repeat(2, minmax(0, 1fr))';
                    manageAssignmentsList.style.gap = '20px';
                } catch (e) {}

                // wire click handlers for cards to show full details
                manageAssignmentsList.querySelectorAll('.assignment-card').forEach(card => {
                    card.addEventListener('click', (e) => {
                        if (e.target.closest('button')) return; // ignore clicks on buttons
                        const id = card.dataset.id; if (!id) return;
                        showManageAssignmentDetails(id);
                    });
                });

                // wire actions
                manageAssignmentsList.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => editAssignment(b.dataset.id)));
                manageAssignmentsList.querySelectorAll('.btn-achieve').forEach(b => b.addEventListener('click', () => achieveAssignment(b.dataset.id)));
                return;
            }
        }
    } catch (err) { console.error('Error loading manage assignments', err); }

    // local fallback
    try {
        const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
        const active = (assignments||[]).filter(a => a.status !== 'achieved');
        if (!active.length) { manageAssignmentsList.innerHTML = '<p class="no-data">No assignments found.</p>'; return; }
        manageAssignmentsList.innerHTML = active.slice().reverse().map(a => `
            <div class="assignment-card" data-id="${a.id}" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:10px;border-bottom:1px solid var(--border-color);cursor:pointer;">
                <div style="flex:1">
                    <h4 style="margin:0">${escapeHtml(a.title||'')}</h4>
                    <div style="color:var(--text-light);font-size:0.85rem">Module ${escapeHtml(a.module||'')}</div>
                    <div class="assignment-excerpt" style="margin-top:6px;color:var(--text-light);font-size:0.95rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(a.instructions||'')}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                    <button class="btn btn-sm btn-outline btn-edit" data-id="${a.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger btn-achieve" data-id="${a.id}"><i class="fas fa-archive"></i></button>
                </div>
            </div>
        `).join('');
        // wire click handlers for cards to show full details
        manageAssignmentsList.querySelectorAll('.assignment-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // ignore clicks on buttons
                const id = card.dataset.id; if (!id) return;
                showManageAssignmentDetails(id);
            });
        });
        manageAssignmentsList.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => editAssignment(b.dataset.id)));
        manageAssignmentsList.querySelectorAll('.btn-achieve').forEach(b => b.addEventListener('click', () => achieveAssignment(b.dataset.id)));
    } catch (e) { manageAssignmentsList.innerHTML = '<p class="no-data">No assignments found.</p>'; }
}

async function achieveAssignment(id) {
    if (!id) return;
    try {
        if (window.firebase && firebase.firestore) {
            const db = firebase.firestore();
            await db.collection('assignments').doc(id).update({ status: 'achieved', achievedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
            const idx = assignments.findIndex(a => a.id === id);
            if (idx !== -1) {
                assignments[idx].status = 'achieved';
                assignments[idx].achievedDate = new Date().toISOString();
                localStorage.setItem('assignments', JSON.stringify(assignments));
            }
        }
        alert('Assignment marked as achieved.');
    } catch (err) { console.error('Achieve failed', err); alert('Failed to mark achieved.'); }
    // refresh lists
    loadManageAssignments();
    loadAssignments();
}

// Show full assignment details in the lower panel
async function showManageAssignmentDetails(id) {
    if (!id) return;
    const container = document.getElementById('manageAssignmentContent');
    if (!container) return;
    // Try Firestore first
    let data = null;
    try {
        if (window.firebase && firebase.firestore) {
            const doc = await firebase.firestore().collection('assignments').doc(id).get();
            if (doc && doc.exists) data = { id: doc.id, ...(doc.data()||{}) };
        }
    } catch (e) { console.debug('fetch assignment detail SDK failed', e); }
    // fallback to localStorage
    if (!data) {
        try { const assignments = JSON.parse(localStorage.getItem('assignments')||'[]'); data = assignments.find(a => a.id === id) || null; } catch(e) { data = null; }
    }
    if (!data) { container.style.display = 'none'; alert('Assignment not found'); return; }

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px">
            <h3 style="margin:0">${escapeHtml(data.title||'')}</h3>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" id="manageAssignmentBack">Close</button>
            </div>
        </div>
        <div style="padding:8px">
            <div style="color:var(--text-light);margin-bottom:8px"><strong>Module:</strong> ${escapeHtml(data.module||'')}</div>
            <div style="color:var(--text-light);margin-bottom:8px"><strong>Due:</strong> ${data.dueDate ? escapeHtml(data.dueDate) : '—'}</div>
            <div style="margin-top:6px">${escapeHtml(data.instructions||'')}</div>
        </div>
    `;
    container.style.display = 'block';
    const btn = document.getElementById('manageAssignmentBack'); if (btn) btn.addEventListener('click', () => { container.style.display = 'none'; });
}

async function editAssignment(id) {
    if (!id) return;
    try {
        let data = null;
        if (window.firebase && firebase.firestore) {
            const doc = await firebase.firestore().collection('assignments').doc(id).get();
            if (doc && doc.exists) data = { id: doc.id, ...(doc.data()||{}) };
        }
        if (!data) {
            const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
            data = assignments.find(a => a.id === id) || null;
        }
        if (!data) return alert('Assignment not found');

        // prefill modal
        document.getElementById('modalAssignmentTitle').value = data.title || '';
        document.getElementById('modalAssignmentModule').value = data.module || '1';
        document.getElementById('modalAssignmentInstructions').value = data.instructions || '';
        document.getElementById('modalAssignmentDueDate').value = data.dueDate || '';
        document.getElementById('modalAssignmentFormUrl').value = data.googleFormUrl || '';

        // mark editing id
        const form = document.getElementById('assignmentModalForm');
        form.dataset.editingId = id;

        // open modal
        const modal = document.getElementById('assignmentModal');
        if (modal) modal.style.display = 'flex';
    } catch (err) { console.error('Edit failed', err); alert('Failed to open assignment for editing.'); }
}

if (manageAssignmentsBtn) {
    manageAssignmentsBtn.addEventListener('click', () => {
        const assignmentsList = document.getElementById('assignmentsList'); if (assignmentsList) assignmentsList.style.display = 'none';
        if (scoreRespondentsPanel) scoreRespondentsPanel.style.display = 'none';
        if (manageAssignmentsPanel) manageAssignmentsPanel.style.display = 'block';
        loadManageAssignments();
    });
}
// removed manageAssignmentsBack per request

async function loadAchievedAssignments() {
    if (!achievedAssignmentsList) return;
    achievedAssignmentsList.innerHTML = '<p class="no-data">Loading achieved assignments...</p>';
    try {
        if (window.firebase && firebase.firestore) {
            const snap = await firebase.firestore().collection('assignments').orderBy('achievedAt','desc').get();
            const items = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
            const achieved = items.filter(a => a.status === 'achieved');
            if (!achieved.length) { achievedAssignmentsList.innerHTML = '<p class="no-data">No achieved assignments yet.</p>'; return; }
            achievedAssignmentsList.innerHTML = achieved.map(a => `
                <div class="assignment-card">
                    <h4>${escapeHtml(a.title||'')}</h4>
                    <div style="color:var(--text-light);font-size:0.9rem">Module ${escapeHtml(a.module||'')}</div>
                    <div style="margin-top:6px">${escapeHtml(a.instructions||'')}</div>
                    <div style="margin-top:6px;color:var(--text-light)">Achieved: ${a.achievedAt && a.achievedAt.toDate ? a.achievedAt.toDate().toLocaleString() : (a.achievedDate ? new Date(a.achievedDate).toLocaleString() : '')}</div>
                </div>
            `).join('');
            return;
        }
    } catch (err) { console.error('Error loading achieved assignments', err); }

    // local fallback
    try {
        const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
        const achieved = (assignments||[]).filter(a => a.status === 'achieved').sort((x,y) => new Date(y.achievedDate||0)-new Date(x.achievedDate||0));
        if (!achieved.length) { achievedAssignmentsList.innerHTML = '<p class="no-data">No achieved assignments yet.</p>'; return; }
        achievedAssignmentsList.innerHTML = achieved.map(a => `
            <div class="assignment-card">
                <h4>${escapeHtml(a.title||'')}</h4>
                <div style="color:var(--text-light);font-size:0.9rem">Module ${escapeHtml(a.module||'')}</div>
                <div style="margin-top:6px">${escapeHtml(a.instructions||'')}</div>
                <div style="margin-top:6px;color:var(--text-light)">Achieved: ${a.achievedDate ? new Date(a.achievedDate).toLocaleString() : ''}</div>
            </div>
        `).join('');
    } catch (e) { achievedAssignmentsList.innerHTML = '<p class="no-data">No achieved assignments yet.</p>'; }
}

if (achievedAssignmentsBtn) {
    achievedAssignmentsBtn.addEventListener('click', () => {
        const assignmentsList = document.getElementById('assignmentsList'); if (assignmentsList) assignmentsList.style.display = 'none';
        if (manageAssignmentsPanel) manageAssignmentsPanel.style.display = 'none';
        if (achievedAssignmentsPanel) achievedAssignmentsPanel.style.display = 'block';
        loadAchievedAssignments();
    });
}
// removed achievedAssignmentsBack per request

// Video Tutorials
function loadVideoTutorials() {
    const addBtn = document.getElementById('addVideoBtn');
    const manageBtn = document.getElementById('manageVideosBtn');

    if (addBtn) {
        addBtn.onclick = () => {
            const modal = document.getElementById('videoModal');
            const urlIn = document.getElementById('videoUrlInput');
            const titleIn = document.getElementById('videoTitleInput');
            const msg = document.getElementById('videoModalMsg');
            const closeBtn = document.getElementById('videoModalClose');
            const cancelBtn = document.getElementById('cancelAddVideo');
            const saveBtn = document.getElementById('saveAddVideo');

            if (!modal) return alert('Video modal not available.');
            // clear previous
            urlIn.value = '';
            titleIn.value = '';
            if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
            modal.style.display = 'flex';

            // init handlers once
            if (!modal.dataset.inited) {
                modal.dataset.inited = '1';

                function hideModal() {
                    modal.style.display = 'none';
                }

                closeBtn.addEventListener('click', hideModal);
                cancelBtn.addEventListener('click', (e) => { e.preventDefault(); hideModal(); });

                // capture description input element
                const descIn = document.getElementById('videoDescriptionInput');

                saveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const url = (urlIn.value || '').trim();
                    const title = (titleIn.value || '').trim();
                    const desc = (descIn && descIn.value || '').trim();
                    if (!url) {
                        if (msg) { msg.textContent = 'Please enter a video URL.'; msg.style.display = 'block'; }
                        return;
                    }

                    // Determine if this is an edit
                    const editId = modal.dataset.editId || null;

                    // Save/update using SDK if available
                    if (window.firebase && firebase.firestore) {
                        try {
                            const db = firebase.firestore();
                            if (editId) {
                                await db.collection('videos').doc(editId).update({ url: url, title: title || null, description: desc || null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                                hideModal();
                                delete modal.dataset.editId;
                                alert('Video updated in Firestore. Changes will appear shortly.');
                                loadAdminVideos();
                                return;
                            } else {
                                await db.collection('videos').add({ url: url, title: title || null, description: desc || null, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                                hideModal();
                                alert('Video saved to Firestore. It will appear on the tutorials page shortly.');
                                loadAdminVideos();
                                return;
                            }
                        } catch (err) {
                            console.error('Error saving/updating video to Firestore (SDK):', err);
                            if (msg) { msg.textContent = 'Failed to save via Firebase SDK (check console).'; msg.style.display = 'block'; }
                            return;
                        }
                    }

                    // REST fallback: create or PATCH
                    try {
                        const project = 'kakn-sites-7c4e9';
                        if (editId) {
                            const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/videos/${encodeURIComponent(editId)}`;
                            const patchUrl = docUrl + '?updateMask.fieldPaths=url&updateMask.fieldPaths=title&updateMask.fieldPaths=description';
                            const body = { fields: { url: { stringValue: url }, title: { stringValue: title || '' }, description: { stringValue: desc || '' } } };
                            const res = await fetch(patchUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                            if (!res.ok) {
                                const txt = await res.text();
                                console.error('Firestore REST patch failed', res.status, txt);
                                if (msg) { msg.textContent = 'Failed to update via REST API (see console).'; msg.style.display = 'block'; }
                                return;
                            }
                            hideModal();
                            delete modal.dataset.editId;
                            alert('Video updated (REST). It will appear on the tutorials page shortly.');
                            loadAdminVideos();
                            return;
                        } else {
                            const urlApi = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/videos`;
                            const body = { fields: { url: { stringValue: url }, title: { stringValue: title || '' }, description: { stringValue: desc || '' }, createdAt: { timestampValue: new Date().toISOString() } } };
                            const res = await fetch(urlApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                            if (!res.ok) {
                                const txt = await res.text();
                                console.error('Firestore REST save failed', res.status, txt);
                                if (msg) { msg.textContent = 'Failed to save via REST API (see console).'; msg.style.display = 'block'; }
                                return;
                            }
                            hideModal();
                            alert('Video saved (REST). It will appear on the tutorials page shortly.');
                            loadAdminVideos();
                            return;
                        }
                    } catch (err) {
                        console.error('Error saving/updating video via REST:', err);
                        if (msg) { msg.textContent = 'Unexpected error saving video (see console).'; msg.style.display = 'block'; }
                    }
                });
            }
        };
    }
    if (manageBtn) {
        manageBtn.onclick = () => {
            // focus the list area for future management UI
            const list = document.getElementById('adminVideosList');
            if (list) list.scrollIntoView({ behavior: 'smooth' });
        };
    }

    // load admin videos for management view
    loadAdminVideos();
}

// Admin: load and render videos for management (list with edit/delete)
async function loadAdminVideos() {
    const listEl = document.getElementById('adminVideosList');
    const searchEl = document.getElementById('videoSearchInput');
    if (!listEl) return;
    listEl.innerHTML = '<p class="no-data">Loading videos...</p>';

    // helper to fetch docs via SDK
    async function fetchSdk() {
        try {
            const db = firebase.firestore();
            const snap = await db.collection('videos').orderBy('createdAt','desc').get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.debug('fetchSdk videos failed', e); return null; }
    }

    // fallback: REST list
    async function fetchRest() {
        try {
            const project = 'kakn-sites-7c4e9';
            const listUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/videos`;
            const res = await fetch(listUrl);
            if (!res.ok) { console.debug('fetchRest fail', res.status, await res.text()); return null; }
            const json = await res.json();
            const docs = (json.documents||[]).map(docItem => {
                const f = docItem.fields || {};
                const id = docItem.name ? docItem.name.split('/').pop() : null;
                return { id, title: f.title && f.title.stringValue ? f.title.stringValue : '', url: f.url && f.url.stringValue ? f.url.stringValue : '', description: f.description && f.description.stringValue ? f.description.stringValue : '', createdAt: f.createdAt && f.createdAt.timestampValue ? f.createdAt.timestampValue : null };
            });
            return docs;
        } catch (e) { console.debug('fetchRest error', e); return null; }
    }

    let docs = null;
    if (window.firebase && firebase.firestore) docs = await fetchSdk();
    if (!docs) docs = await fetchRest();
    if (!docs) { listEl.innerHTML = '<p class="no-data">Unable to load videos.</p>'; return; }

    // enrich docs with thumbnail/title where missing (use same approach as platform)
    async function getYouTubeId(url) { if (!url) return null; const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i); return m ? m[1] : null; }
    async function getVimeoThumb(url) { try { const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`); if (!r.ok) return null; const j = await r.json(); return j.thumbnail_url || null; } catch(e){return null;} }
    async function getThumb(url){ const y = await getYouTubeId(url); if (y) return `https://img.youtube.com/vi/${y}/mqdefault.jpg`; if (url && url.includes('vimeo.com')) return await getVimeoThumb(url); return null; }
    async function getTitle(url){ if (!url) return null; try { const yt = await (async ()=>{ const m = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`); if (m.ok) { const j = await m.json(); return j.title; } return null; })(); if (yt) return yt; if (url.includes('vimeo.com')) { try { const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`); if (r.ok){ const j = await r.json(); return j.title; } } catch(e){} } } catch(e){} return null; }
    async function getDescription(url){ if (!url) return null; // try Vimeo oEmbed first
        try {
            if (url.includes('vimeo.com')) {
                const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
                if (r.ok) { const j = await r.json(); if (j.description) return j.description; }
            }
        } catch(e){}
        // try noembed as a fallback for YouTube and other providers
        try {
            const r2 = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
            if (r2.ok) {
                const j2 = await r2.json();
                if (j2 && j2.description) return j2.description;
            }
        } catch(e){}
        return null; }

    // prepare enriched list
    const enriched = await Promise.all(docs.map(async (d)=>{
        const thumb = await getThumb(d.url);
        const resolvedTitle = (d.title && d.title.trim()) ? d.title : (await getTitle(d.url)) || '';
        const resolvedDesc = (d.description && d.description.trim()) ? d.description : (await getDescription(d.url)) || '';
        return { id: d.id, url: d.url||'', title: resolvedTitle, rawTitle: d.title||'', description: resolvedDesc, rawDescription: d.description||'', createdAt: d.createdAt||null, thumb };
    }));

    // store for search
    window.__adminVideosCache = enriched;

    function renderList(items) {
        if (!items || items.length === 0) { listEl.innerHTML = '<p class="no-data">No videos found.</p>'; return; }
        listEl.innerHTML = '<div class="admin-videos-grid">' + items.map(item => {
            const thumb = item.thumb ? item.thumb : '';
            const thumbStyle = thumb ? `style="background-image:url('${thumb}');background-size:cover;background-position:center;"` : '';
            const titleText = item.title || 'Untitled Tutorial';
            const urlText = item.url || '';
            return `
                <div class="video-card" data-id="${item.id}" data-url="${escapeHtml(urlText)}">
                    <div class="video-thumbnail" ${thumbStyle}>
                        <div class="video-admin-actions">
                            <button class="edit-video" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="delete-video" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                        <i class="fas fa-play-circle play-icon"></i>
                    </div>
                    <div class="video-info">
                        <h4>${escapeHtml(titleText)}</h4>
                        <p class="video-description">${escapeHtml((item.description||'').substring(0,200))}</p>
                        <div class="video-meta">${escapeHtml(urlText)}</div>
                    </div>
                </div>
            `;
        }).join('') + '</div>';

        // attach handlers
        document.querySelectorAll('.video-card .edit-video').forEach(btn=>btn.addEventListener('click', onEditVideo));
        document.querySelectorAll('.video-card .delete-video').forEach(btn=>btn.addEventListener('click', onDeleteVideo));
        // clicking card body opens video
        document.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', function(e){
                // ignore clicks on buttons
                if (e.target.closest('.edit-video') || e.target.closest('.delete-video')) return;
                const url = this.dataset.url;
                if (!url) return alert('No URL available for this tutorial.');
                window.open(url, '_blank');
            });
        });
    }

    renderList(enriched);

    if (searchEl) {
        searchEl.addEventListener('input', (e)=>{
            const q = (e.target.value||'').toLowerCase().trim();
            const filtered = window.__adminVideosCache.filter(v => (v.title||'').toLowerCase().includes(q));
            renderList(filtered);
        });
    }

    async function onDeleteVideo(e){
        const id = e.currentTarget.dataset.id;
        if (!confirm('Delete this video?')) return;
        // try SDK
        try {
            if (window.firebase && firebase.firestore) {
                await firebase.firestore().collection('videos').doc(id).delete();
                loadAdminVideos();
                return;
            }
        } catch (err) { console.error('SDK delete err', err); }
        // REST delete
        try {
            const project = 'kakn-sites-7c4e9';
            const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/videos/${encodeURIComponent(id)}`;
            const r = await fetch(docUrl, { method: 'DELETE' });
            if (!r.ok) { console.error('REST delete failed', r.status, await r.text()); alert('Failed to delete (REST). See console.'); return; }
            loadAdminVideos();
        } catch (err) { console.error('REST delete err', err); alert('Delete error (see console)'); }
    }

    function onEditVideo(e){
        const id = e.currentTarget.dataset.id;
        const item = (window.__adminVideosCache||[]).find(x=>x.id===id);
        if (!item) return alert('Video not found');
        // populate modal
        const modal = document.getElementById('videoModal');
        const urlIn = document.getElementById('videoUrlInput');
        const titleIn = document.getElementById('videoTitleInput');
        const descIn = document.getElementById('videoDescriptionInput');
        const msg = document.getElementById('videoModalMsg');
        if (!modal) return;
        urlIn.value = item.url||'';
        titleIn.value = item.rawTitle || item.title || '';
        if (descIn) descIn.value = item.rawDescription || item.description || '';
        modal.style.display = 'flex';
        // mark edit id
        modal.dataset.editId = id;
        if (msg) { msg.style.display='none'; msg.textContent=''; }
    }

    function escapeHtml(str){ return (str||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

}


function viewResponses(assignmentId) {
    const responses = JSON.parse(localStorage.getItem('assignmentResponses') || '[]');
    const assignmentResponses = responses.filter(r => r.assignmentId === assignmentId);
    
    if (assignmentResponses.length === 0) {
        alert('No student responses yet for this assignment.');
        return;
    }
    
    alert(`Found ${assignmentResponses.length} student response(s). Response review feature coming soon!`);
}

// Messages Management
let currentConversationUser = null;

// Messages now use Firebase Realtime Database under one_on_one/{userId}/messages
function loadMessages() {
    const conversationsList = document.getElementById('conversationsList');
    if (!conversationsList) return;
    conversationsList.innerHTML = '<p class="no-data">Loading conversations...</p>';

    if (window.firebase && firebase.database) {
        const rootRef = firebase.database().ref('one_on_one');
        // listen for meta changes (child_added/child_changed)
        rootRef.off();
        rootRef.on('child_added', snapshot => { renderConversations(); });
        rootRef.on('child_changed', snapshot => { renderConversations(); });
        // initial render
        renderConversations();
    } else {
        conversationsList.innerHTML = '<p class="no-data">Realtime DB not available</p>';
    }

    async function renderConversations() {
        const listRef = firebase.database().ref('one_on_one');
        const snap = await listRef.once('value');
        const data = snap.val() || {};
        const keys = Object.keys(data).sort((a,b)=>{
            const ta = data[a].meta && data[a].meta.lastTimestamp ? new Date(data[a].meta.lastTimestamp) : new Date(0);
            const tb = data[b].meta && data[b].meta.lastTimestamp ? new Date(data[b].meta.lastTimestamp) : new Date(0);
            return tb - ta;
        });

        if (keys.length === 0) {
            conversationsList.innerHTML = '<p class="no-data">No messages yet</p>';
            return;
        }

        conversationsList.innerHTML = keys.map(userId => {
            const node = data[userId] || {};
            const meta = node.meta || {};
            const lastText = meta.lastText || '';
            const lastTs = meta.lastTimestamp ? new Date(meta.lastTimestamp).toLocaleString() : '';
            const unread = meta.unreadForAdmin ? 1 : 0;
            const displayName = meta.name || userId;

            return `
                <div class="conversation-item ${unread ? 'unread' : ''}" data-user="${userId}">
                    <i class="fas fa-user-circle"></i>
                    <div class="conversation-info">
                        <h4>${escapeHtml(displayName)}</h4>
                        <p>${escapeHtml((lastText||'').substring(0,50))}...</p>
                    </div>
                    ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
                </div>
            `;
        }).join('');

        // attach click handlers
        conversationsList.querySelectorAll('.conversation-item').forEach(el => el.addEventListener('click', () => {
            const uid = el.dataset.user;
            openConversation(uid);
        }));
    }
}

function openConversation(userId) {
    currentConversationUser = userId;
    const header = document.getElementById('messageThreadHeader');
    const content = document.getElementById('messageThreadContent');
    const replyForm = document.getElementById('messageReplyForm');
    if (!header || !content || !replyForm) return;

    // load user meta for header
    if (window.firebase && firebase.database) {
        firebase.database().ref(`one_on_one/${userId}/meta`).once('value').then(snap => {
            const meta = snap.val() || {};
            header.innerHTML = `\n                <i class="fas fa-user-circle"></i>\n                <h3>${escapeHtml(meta.name || userId)}</h3>\n            `;
        }).catch(()=>{ header.innerHTML = `<i class="fas fa-user-circle"></i><h3>Student</h3>`; });

        // listen for messages
        const msgsRef = firebase.database().ref(`one_on_one/${userId}/messages`);
        content.innerHTML = '<p class="no-data">Loading messages...</p>';
        msgsRef.off();
        msgsRef.limitToLast(500).on('child_added', snapshot => {
            const m = snapshot.val();
            if (!m) return;
            const bubble = document.createElement('div');
            bubble.className = m.sender === 'admin' ? 'message-bubble admin-message' : 'message-bubble user-message';
            bubble.innerHTML = `<p>${escapeHtml(m.text)}</p><small>${new Date(m.timestamp).toLocaleString()}</small>`;
            content.appendChild(bubble);
            content.scrollTop = content.scrollHeight;
        });

        // mark meta unreadForAdmin = false
        firebase.database().ref(`one_on_one/${userId}/meta`).update({ unreadForAdmin: false }).catch(()=>{});
    } else {
        content.innerHTML = '<p class="no-data">Realtime DB not available</p>';
    }

    replyForm.style.display = 'flex';
}

document.getElementById('sendReplyBtn').addEventListener('click', async () => {
    const replyTextEl = document.getElementById('replyMessage');
    const replyText = (replyTextEl.value || '').trim();
    if (!replyText || !currentConversationUser) return;

    const message = { sender: 'admin', text: replyText, timestamp: new Date().toISOString() };

    if (window.firebase && firebase.database) {
        try {
            const msgsRef = firebase.database().ref(`one_on_one/${currentConversationUser}/messages`);
            await msgsRef.push(message);
            // update meta
            const metaRef = firebase.database().ref(`one_on_one/${currentConversationUser}/meta`);
            await metaRef.update({ lastText: replyText, lastTimestamp: message.timestamp, unreadForUser: true });
        } catch (err) { console.error('Failed to send admin reply', err); alert('Failed to send reply.'); return; }
    } else {
        alert('Realtime DB not available');
    }

    document.getElementById('replyMessage').value = '';
    // refresh thread will be automatic due to DB listener
});

// Certifications Management
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"]+/g, function (s) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]);
    });
}

let _usersCacheForCertify = [];
let _certifySelected = null;

function loadCertifications() {
    const certifiedStudents = document.getElementById('certifiedStudents');
    if (!certifiedStudents) return;

    if (window.firebase && firebase.firestore) {
        firebase.firestore().collection('certificates').orderBy('issuedAt', 'desc').get()
            .then(snapshot => {
                if (snapshot.empty) {
                    certifiedStudents.innerHTML = '<p class="no-data">No certified students yet</p>';
                    return;
                }
                certifiedStudents.innerHTML = snapshot.docs.map(d => {
                    const c = d.data();
                    const name = c.userName || c.userEmail || 'Student';
                    const date = c.issuedAt && c.issuedAt.toDate ? c.issuedAt.toDate().toLocaleDateString() : (c.issuedAt || '');
                    const url = c.accessUrl || '#';
                    return `\n                        <div class="student-item certified">\n                            <i class="fas fa-check-circle"></i>\n                            <div>\n                                <h4>${escapeHtml(name)}</h4>\n                                <p>Issued on ${escapeHtml(date)}</p>\n                                <a class="btn btn-outline btn-sm" href="${escapeHtml(url)}" target="_blank" style="margin-top:6px;display:inline-block">View Certificate</a>\n                            </div>\n                        </div>`;
                }).join('');
            }).catch(err => {
                console.error('Failed to load certificates', err);
                certifiedStudents.innerHTML = '<p class="no-data">No certified students yet</p>';
            });
    } else {
        const certs = JSON.parse(localStorage.getItem('certificates') || '[]');
        if (!certs.length) {
            certifiedStudents.innerHTML = '<p class="no-data">No certified students yet</p>';
        } else {
            certifiedStudents.innerHTML = certs.map(c => `
                <div class="student-item certified">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <h4>${escapeHtml(c.userName || c.userEmail)}</h4>
                        <p>Issued on ${escapeHtml(new Date(c.issuedAt || Date.now()).toLocaleDateString())}</p>
                        <a class="btn btn-outline btn-sm" href="${escapeHtml(c.accessUrl || '#')}" target="_blank" style="margin-top:6px;display:inline-block">View Certificate</a>
                    </div>
                </div>
            `).join('');
        }
    }
}

function openCertifyModal(prefillUserId) {
    const modal = document.getElementById('certifyModal');
    const search = document.getElementById('certifySearch');
    const results = document.getElementById('certifyResults');
    const selBox = document.getElementById('certifySelected');
    const selName = document.getElementById('certifySelectedName');
    const selEmail = document.getElementById('certifySelectedEmail');
    const urlIn = document.getElementById('certAccessUrl');
    const msg = document.getElementById('certifyModalMsg');
    if (!modal) return alert('Certify modal not available.');
    search.value = '';
    results.innerHTML = '<p style="color:#666">Start typing to search users</p>';
    selBox.style.display = 'none';
    selName.textContent = '';
    selEmail.textContent = '';
    urlIn.value = '';
    msg.style.display = 'none';
    _certifySelected = null;
    modal.style.display = 'flex';

    // load users into cache
    if (window.firebase && firebase.firestore) {
        firebase.firestore().collection('users').get().then(snap => {
            _usersCacheForCertify = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        }).catch(err => { console.error('Failed to load users for search', err); _usersCacheForCertify = []; });
    } else {
        _usersCacheForCertify = JSON.parse(localStorage.getItem('users') || '[]');
    }

    // if prefill id provided, try select
    if (prefillUserId) {
        setTimeout(() => {
            const u = _usersCacheForCertify.find(x => x.id === prefillUserId || x.uid === prefillUserId);
            if (u) selectCertifyUser(u);
        }, 400);
    }
}

function closeCertifyModal() {
    const modal = document.getElementById('certifyModal');
    if (modal) modal.style.display = 'none';
}

function renderCertifyResults(list) {
    const results = document.getElementById('certifyResults');
    if (!results) return;
    if (!list.length) { results.innerHTML = '<p class="no-data">No users found</p>'; return; }
    results.innerHTML = list.map(u => `
        <div class="search-row" style="padding:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
            <div><strong>${escapeHtml(u.fullName || u.name || u.displayName || u.email)}</strong><div style="font-size:0.9rem;color:#666">${escapeHtml(u.email || '')}</div></div>
            <button class="btn btn-outline btn-sm" data-uid="${escapeHtml(u.id || u.uid || '')}">Select</button>
        </div>
    `).join('');

    // attach click handlers
    results.querySelectorAll('button[data-uid]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-uid');
            const u = _usersCacheForCertify.find(x => (x.id===id) || (x.uid===id) || (x.email===id));
            if (u) selectCertifyUser(u);
        });
    });
}

function selectCertifyUser(user) {
    _certifySelected = user;
    const selBox = document.getElementById('certifySelected');
    const selName = document.getElementById('certifySelectedName');
    const selEmail = document.getElementById('certifySelectedEmail');
    selName.textContent = user.fullName || user.name || user.displayName || user.email || 'Student';
    selEmail.textContent = user.email || '';
    selBox.style.display = 'block';
}

function saveCertificate() {
    const msg = document.getElementById('certifyModalMsg');
    const urlIn = document.getElementById('certAccessUrl');
    if (!_certifySelected) { msg.textContent = 'Please select a student.'; msg.style.display = 'block'; return; }
    const accessUrl = (urlIn.value || '').trim();
    if (!accessUrl) { msg.textContent = 'Please enter the certificate access URL.'; msg.style.display = 'block'; return; }

    msg.style.display = 'none';
    const payload = {
        userId: _certifySelected.id || _certifySelected.uid || '',
        userName: _certifySelected.fullName || _certifySelected.name || _certifySelected.displayName || '',
        userEmail: _certifySelected.email || '',
        accessUrl: accessUrl
    };

    if (window.firebase && firebase.firestore) {
        const doc = Object.assign({}, payload, { issuedBy: (firebase.auth && firebase.auth().currentUser) ? (firebase.auth().currentUser.uid || '') : 'admin', issuedAt: firebase.firestore.FieldValue.serverTimestamp() });
        firebase.firestore().collection('certificates').add(doc).then(() => {
            closeCertifyModal();
            loadCertifications();
            loadDashboardStats && loadDashboardStats();
            alert('Certificate sent to student successfully.');
        }).catch(err => { console.error('Failed to save certificate', err); msg.textContent = 'Failed to send certificate.'; msg.style.display = 'block'; });
    } else {
        // fallback to localStorage
        const certs = JSON.parse(localStorage.getItem('certificates') || '[]');
        payload.issuedAt = new Date().toISOString();
        payload.issuedBy = 'local-admin';
        certs.unshift(payload);
        localStorage.setItem('certificates', JSON.stringify(certs));

        // mark user certified
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const u = users.find(x => x.id === payload.userId || x.uid === payload.userId);
        if (u) { u.certified = true; u.certifiedDate = payload.issuedAt; u.certificateUrl = payload.accessUrl; localStorage.setItem('users', JSON.stringify(users)); }

        closeCertifyModal();
        loadCertifications();
        loadDashboardStats && loadDashboardStats();
        alert('Certificate saved locally and marked as issued.');
    }
}

// Notes Management (modal + url-based notes)
document.getElementById('addNoteBtn').addEventListener('click', () => {
    const modal = document.getElementById('noteModal');
    const urlIn = document.getElementById('noteUrlInput');
    const titleIn = document.getElementById('noteTitleInput');
    const moduleSel = document.getElementById('noteModuleSelect');
    const msg = document.getElementById('noteModalMsg');
    if (!modal) return alert('Note modal not available.');
    // clear
    urlIn.value = '';
    titleIn.value = '';
    moduleSel.value = '1';
    if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
    modal.style.display = 'flex';
});

// close/cancel handlers
(function(){
    const modal = document.getElementById('noteModal');
    if (!modal) return;
    const closeBtn = document.getElementById('noteModalClose');
    const cancelBtn = document.getElementById('cancelAddNote');
    function hide() { modal.style.display = 'none'; }
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (cancelBtn) cancelBtn.addEventListener('click', (e)=>{ e.preventDefault(); hide(); });
})();

document.getElementById('saveAddNote').addEventListener('click', async (e)=>{
    e.preventDefault();
    const url = (document.getElementById('noteUrlInput').value || '').trim();
    const title = (document.getElementById('noteTitleInput').value || '').trim();
    const moduleVal = document.getElementById('noteModuleSelect').value;
    const msg = document.getElementById('noteModalMsg');
    if (!url) {
        if (msg) { msg.textContent = 'Please enter a valid URL.'; msg.style.display = 'block'; }
        return;
    }

    // If editing existing note, update instead of adding
    const modal = document.getElementById('noteModal');
    const editId = modal && modal.dataset && modal.dataset.editId ? modal.dataset.editId : null;

    // Try Firestore SDK first (add or update)
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            if (editId) {
                await db.collection('notes').doc(editId).update({ title: title || 'Untitled Note', module: moduleVal, url: url, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                alert('Note updated in Firestore. It will appear on the platform shortly.');
                delete modal.dataset.editId;
                document.getElementById('noteModal').style.display = 'none';
                loadNotes();
                return;
            } else {
                await db.collection('notes').add({ title: title || 'Untitled Note', module: moduleVal, url: url, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                alert('Note saved to Firestore. It will appear on the platform shortly.');
                document.getElementById('noteModal').style.display = 'none';
                loadNotes();
                return;
            }
        } catch (err) {
            console.error('Error saving/updating note to Firestore SDK:', err);
            if (msg) { msg.textContent = 'Failed to save via Firebase SDK (see console).'; msg.style.display = 'block'; }
            // fallthrough to REST/localStorage fallback
        }
    }

    // REST fallback to Firestore
    try {
        const project = 'kakn-sites-7c4e9';
        const urlApi = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/notes`;
        const body = {
            fields: {
                title: { stringValue: title || 'Untitled Note' },
                module: { stringValue: moduleVal },
                url: { stringValue: url },
                createdAt: { timestampValue: new Date().toISOString() }
            }
        };
        // If editing, patch existing document
        if (editId) {
            const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/notes/${encodeURIComponent(editId)}`;
            const patchUrl = docUrl + '?updateMask.fieldPaths=title&updateMask.fieldPaths=module&updateMask.fieldPaths=url&updateMask.fieldPaths=updatedAt';
            const bodyPatch = { fields: { title: { stringValue: title || '' }, module: { stringValue: moduleVal }, url: { stringValue: url }, updatedAt: { timestampValue: new Date().toISOString() } } };
            const resPatch = await fetch(patchUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyPatch) });
            if (resPatch.ok) {
                alert('Note updated (REST). It will appear on the platform shortly.');
                delete modal.dataset.editId;
                document.getElementById('noteModal').style.display = 'none';
                loadNotes();
                return;
            } else {
                console.error('Firestore REST patch failed', resPatch.status, await resPatch.text());
                if (msg) { msg.textContent = 'Failed to update via Firestore REST (see console).'; msg.style.display = 'block'; }
            }
        } else {
            const res = await fetch(urlApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (res.ok) {
                alert('Note saved to Firestore (REST). It will appear on the platform shortly.');
                document.getElementById('noteModal').style.display = 'none';
                loadNotes();
                return;
            } else {
                console.error('Firestore REST save failed', res.status, await res.text());
                if (msg) { msg.textContent = 'Failed to save via Firestore REST (see console).'; msg.style.display = 'block'; }
            }
        }
    } catch (err) {
        console.error('Error saving note via REST:', err);
    }

    // Final fallback: save to localStorage for demo
    const note = { id: Date.now().toString(), title: title || 'Untitled Note', module: moduleVal, url: url, uploadDate: new Date().toISOString() };
    const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
    notes.push(note);
    localStorage.setItem('courseNotes', JSON.stringify(notes));

    alert('Note saved locally (fallback).');
    document.getElementById('noteModal').style.display = 'none';
    loadNotes();
});

async function loadNotes() {
    const notesList = document.getElementById('notesList');
    if (!notesList) return;
    notesList.innerHTML = '<p class="no-data">Loading notes...</p>';

    let docs = null;
    // Try SDK
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snap = await db.collection('notes').orderBy('createdAt','desc').get();
            docs = snap.docs.map(d => {
                const data = d.data();
                const created = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || null);
                return { id: d.id, title: data.title||'', module: data.module||'', url: data.url||'', uploadDate: created };
            });
        } catch (err) { console.debug('Admin Firestore SDK fetch failed', err); docs = null; }
    }

    // REST fallback
    if (!docs) {
        try {
            const project = 'kakn-sites-7c4e9';
            const listUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/notes`;
            const res = await fetch(listUrl);
            if (res.ok) {
                const json = await res.json();
                docs = (json.documents||[]).map(docItem => {
                    const f = docItem.fields || {};
                    const id = docItem.name ? docItem.name.split('/').pop() : null;
                    const created = f.createdAt && (f.createdAt.timestampValue || f.createdAt.stringValue) ? (f.createdAt.timestampValue || f.createdAt.stringValue) : null;
                    return { id, title: f.title && f.title.stringValue ? f.title.stringValue : '', module: f.module && f.module.stringValue ? f.module.stringValue : '', url: f.url && f.url.stringValue ? f.url.stringValue : '', uploadDate: created };
                });
                docs = docs.sort((a,b)=> (new Date(b.uploadDate||0) - new Date(a.uploadDate||0)));
            }
        } catch (err) { console.debug('Admin Firestore REST fetch failed', err); }
    }

    // LocalStorage fallback
    if (!docs || docs.length === 0) {
        const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
        if (!notes || notes.length === 0) {
            notesList.innerHTML = '<p class="no-data">No notes uploaded yet. Click "Upload New Note" to add one.</p>';
            return;
        }
        docs = notes.map(n => ({ id: n.id, title: n.title||'', module: n.module||'', url: n.url||'', uploadDate: n.uploadDate||'' })).sort((a,b)=> (new Date(b.uploadDate||0) - new Date(a.uploadDate||0)));
    }

    const now = new Date();
    function isNew(d) { try { const dt = new Date(d); const diff = (now - dt) / (1000 * 60 * 60 * 24); return diff <= 7; } catch(e){ return false; } }

    // expose cache for edit handlers
    window.__adminNotesCache = docs.slice();

    notesList.innerHTML = docs.map(note => {
        const newBadge = isNew(note.uploadDate) ? `<span class="new-badge">New</span>` : '';
        const dateText = note.uploadDate ? new Date(note.uploadDate).toLocaleDateString() : '';
        return `
        <div class="note-card">
            <div class="note-icon"><i class="fas fa-file-pdf"></i></div>
            <div class="note-info">
                <h3>${escapeHtml(note.title)}</h3>
                <p class="note-description">Module ${escapeHtml(note.module)}</p>
                <div class="note-meta">
                    <span><i class="fas fa-calendar"></i> ${escapeHtml(dateText)}</span>
                    ${newBadge}
                </div>
            </div>
            <div class="note-actions">
                <button class="edit-note btn btn-secondary btn-sm" data-id="${note.id}" style="margin-right:6px"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-outline btn-sm" data-url="${escapeHtml(note.url)}"> <i class="fas fa-eye"></i> View</button>
                <button class="btn-primary btn-sm" data-url="${escapeHtml(note.url)}"> <i class="fas fa-download"></i> Download</button>
                <button class="btn btn-danger btn-sm" data-id="${note.id}" style="margin-left:8px"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        `;
    }).join('');

    // attach handlers
    notesList.querySelectorAll('.note-actions .btn-outline').forEach(b => b.addEventListener('click', (e)=>{
        const url = e.currentTarget.dataset.url;
        if (url) window.open(url, '_blank');
    }));
    notesList.querySelectorAll('.note-actions .btn-primary').forEach(b => b.addEventListener('click', (e)=>{
        const url = e.currentTarget.dataset.url;
        if (url) window.open(url, '_blank');
    }));
    notesList.querySelectorAll('.note-actions .btn-danger').forEach(b => b.addEventListener('click', (e)=>{
        const id = e.currentTarget.dataset.id;
        deleteNote(id);
    }));

    // edit handlers
    notesList.querySelectorAll('.edit-note').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const modal = document.getElementById('noteModal');
        const urlIn = document.getElementById('noteUrlInput');
        const titleIn = document.getElementById('noteTitleInput');
        const moduleSel = document.getElementById('noteModuleSelect');
        const msg = document.getElementById('noteModalMsg');
        const item = (window.__adminNotesCache || []).find(x => x.id === id);
        if (!item) {
            // If not found in cache, reload and try again
            loadNotes();
            return;
        }
        urlIn.value = item.url || '';
        titleIn.value = item.title || '';
        moduleSel.value = item.module || '1';
        if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
        modal.dataset.editId = id;
        modal.style.display = 'flex';
    }));
}

async function deleteNote(noteId) {
    if (!noteId) return;
    if (!confirm('Are you sure you want to delete this note?')) return;

    // Try Firestore SDK delete
    if (window.firebase && firebase.firestore) {
        try {
            await firebase.firestore().collection('notes').doc(noteId).delete();
            loadNotes();
            return;
        } catch (err) { console.debug('Firestore SDK delete failed', err); }
    }

    // REST delete fallback
    try {
        const project = 'kakn-sites-7c4e9';
        const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/notes/${encodeURIComponent(noteId)}`;
        const res = await fetch(docUrl, { method: 'DELETE' });
        if (res.ok) { loadNotes(); return; }
        console.debug('REST delete failed', res.status, await res.text());
    } catch (err) { console.debug('REST delete error', err); }

    // LocalStorage fallback
    const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
    const filtered = notes.filter(n => n.id !== noteId);
    localStorage.setItem('courseNotes', JSON.stringify(filtered));
    loadNotes();
}

function escapeHtml(str){ return (str||'').toString().replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Users Management
async function loadUsers(query = '') {
    // Try to load users from Firestore if available, otherwise fallback to localStorage
    const usersList = document.getElementById('usersList');
    let users = [];

    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('users').get();
            users = snapshot.docs.map(d => {
                const data = d.data();
                // keep document id (uid) so admin can reference the correct doc
                data._docId = d.id;
                return data;
            });
        } catch (err) {
            console.error('Error fetching users from Firestore:', err);
            users = JSON.parse(localStorage.getItem('users') || '[]');
        }
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
    }

    if (!users || users.length === 0) {
        usersList.innerHTML = '<p class="no-data">No users registered yet</p>';
        return;
    }

    // Apply search filter if query provided
    const q = (query || '').trim().toLowerCase();
    if (q) {
        users = users.filter(u => {
            const name = (u.fullName || u.firstName && (u.firstName + (u.lastName ? ' ' + u.lastName : '')) || u.name || u.displayName || '').toString().toLowerCase();
            const email = (u.email || '').toString().toLowerCase();
            const phone = (u.telephone || u.phone || u.tel || '').toString().toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q);
        });
    }

    // Split users into waiting (not verified) and approved (verified)
    const waiting = users.filter(u => !u.verified);
    const approved = users.filter(u => u.verified);

    const renderUserItem = (u) => {
        const displayName = u.fullName || (u.firstName ? (u.firstName + (u.lastName ? ' ' + u.lastName : '')) : (u.name || u.displayName || 'Unnamed'));
        const phone = u.telephone || u.phone || u.tel || '-';
        const docId = u._docId || '';
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;border:1px solid var(--border-color);margin-bottom:8px;">
            <div style="flex:1">
                <strong>${displayName}</strong>
                <div style="color:var(--text-light);font-size:0.95rem">${u.email || '-'} • ${phone}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-secondary" onclick="showUserModal('${docId}')">View</button>
            </div>
        </div>
    `;
    };

    usersList.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div>
                <h4>Waiting Approval (${waiting.length})</h4>
                ${waiting.map(u => `
                    <div class=\"user-item\">${renderUserItem(u)}</div>
                `).join('') || '<p class="no-data">No users waiting approval</p>'}
            </div>
            <div>
                <h4>Approved Users (${approved.length})</h4>
                ${approved.map(u => `
                    <div class=\"user-item\">${renderUserItem(u)}</div>
                `).join('') || '<p class="no-data">No approved users</p>'}
            </div>
        </div>
    `;
}

// Logout
document.getElementById('adminLogout').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// Load dashboard on page load
loadDashboardStats();

// -----------------------
// Blog Management (Admin)
// -----------------------
let editingBlogId = null;
const addBlogBtn = document.getElementById('addBlogBtn');
const blogForm = document.getElementById('blogForm');
const blogModal = document.getElementById('blogModal');
const cancelBlog = document.getElementById('cancelBlog');
const createBlogForm = document.getElementById('createBlogForm');
const blogsListEl = document.getElementById('blogsList');
const blogContent = document.getElementById('blogContent');

// Show add blog form
if (addBlogBtn) {
    addBlogBtn.addEventListener('click', () => {
        editingBlogId = null;
        if (createBlogForm) createBlogForm.reset();
        if (blogContent) blogContent.innerHTML = '';
        if (blogModal) blogModal.style.display = 'flex';
        else if (blogForm) blogForm.style.display = 'block';
    });
}

// Cancel blog creation
if (cancelBlog) {
    cancelBlog.addEventListener('click', () => {
        if (blogModal) blogModal.style.display = 'none';
        else if (blogForm) blogForm.style.display = 'none';
        if (createBlogForm) createBlogForm.reset();
        if (blogContent) blogContent.innerHTML = '';
        editingBlogId = null;
    });
}

// Handle blog create/edit submit
if (createBlogForm) {
    createBlogForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('blogTitle').value;
        const date = document.getElementById('blogDate').value || new Date().toISOString();
        const excerpt = document.getElementById('blogExcerpt').value;
        const thumbnail = document.getElementById('blogThumbnail').value;
        const content = blogContent ? blogContent.innerHTML : '';

        // Build blog object
        let blog = null;
        if (editingBlogId) {
            blog = { id: editingBlogId, title, date, excerpt, thumbnail, content };
        } else {
            const id = Date.now().toString();
            blog = { id, title, date, excerpt, thumbnail, content };
        }

        // Update local fallback
        const blogsLocal = getBlogsLocal();
        const idx = blogsLocal.findIndex(b => (b.id && String(b.id) === String(blog.id)) || (b._docId && String(b._docId) === String(blog.id)));
        if (idx !== -1) {
            blogsLocal[idx] = blog;
        } else {
            blogsLocal.push(blog);
        }
        saveBlogsLocal(blogsLocal);

        // Try Firestore save
        if (window.firebase && firebase.firestore) {
            const savedId = await saveBlogToFirestore(blog);
            if (savedId) {
                // ensure local copy maps to doc id
                const updated = getBlogsLocal();
                updated.forEach(b => { if ((b.id && String(b.id) === String(blog.id)) || b._docId === blog._docId) { b._docId = savedId; } });
                saveBlogsLocal(updated);
            }
        }

        if (blogModal) blogModal.style.display = 'none';
        else if (blogForm) blogForm.style.display = 'none';
        if (createBlogForm) createBlogForm.reset();
        if (blogContent) blogContent.innerHTML = '';
        editingBlogId = null;
        await renderAdminBlogs();
        alert('Blog saved successfully');
    });
}

// Delete blog (admin)
window.deleteBlog = async function (id) {
    if (!confirm('Delete this blog post?')) return;
    // Delete from Firestore if present
    if (window.firebase && firebase.firestore) {
        await deleteBlogFromFirestore(id);
    }
    // Remove from local storage
    const blogs = getBlogsLocal();
    const cleaned = blogs.filter(b => String(b.id || b._docId || '') !== String(id));
    saveBlogsLocal(cleaned);
    await renderAdminBlogs();
};

// Blog storage helpers: localStorage fallback, Firestore when available
function getBlogsLocal() {
    return JSON.parse(localStorage.getItem('blogs') || '[]');
}

function saveBlogsLocal(blogs) {
    localStorage.setItem('blogs', JSON.stringify(blogs));
}

async function fetchBlogsFromFirestore() {
    if (!window.firebase || !firebase.firestore) return null;
    try {
        const db = firebase.firestore();
        const snap = await db.collection('blogs').get();
        const docs = snap.docs.map(d => {
            const data = d.data();
            data._docId = d.id;
            return data;
        });
        return docs;
    } catch (err) {
        console.error('Error fetching blogs from Firestore:', err);
        return null;
    }
}

async function saveBlogToFirestore(blog) {
    if (!window.firebase || !firebase.firestore) return null;
    try {
        const db = firebase.firestore();
        // Use blog.id as doc id when present, otherwise push new
        const docId = blog.id || undefined;
        if (docId) {
            await db.collection('blogs').doc(String(docId)).set(blog, { merge: true });
            return String(docId);
        } else {
            const res = await db.collection('blogs').add(blog);
            return res.id;
        }
    } catch (err) {
        console.error('Error saving blog to Firestore:', err);
        return null;
    }
}

async function deleteBlogFromFirestore(docId) {
    if (!window.firebase || !firebase.firestore) return false;
    try {
        const db = firebase.firestore();
        await db.collection('blogs').doc(String(docId)).delete();
        return true;
    } catch (err) {
        console.error('Error deleting blog from Firestore:', err);
        return false;
    }
}

// Render admin blog list (tries Firestore first, falls back to localStorage)
async function renderAdminBlogs() {
    let blogs = null;
    if (window.firebase && firebase.firestore) {
        const remote = await fetchBlogsFromFirestore();
        if (remote && remote.length >= 0) {
            blogs = remote;
        }
    }

    if (!blogs) blogs = getBlogsLocal();

    if (!blogs || blogs.length === 0) {
        blogsListEl.innerHTML = '<p class="no-data">No blog posts yet. Click "Add New Blog" to create one.</p>';
        return;
    }

    // Sort by date descending
    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    blogsListEl.innerHTML = blogs.map(b => `
        <div class="note-card">
            <div class="note-header">
                <h3>${b.title}</h3>
                <span class="badge">${new Date(b.date).toLocaleDateString()}</span>
            </div>
            <p>${b.excerpt || ''}</p>
            <div class="note-meta">
                <button class="btn btn-secondary btn-sm" onclick="editBlog('${b.id || b._docId || ''}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="deleteBlog('${b.id || b._docId || ''}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

window.editBlog = async function (id) {
    // Try Firestore first
    let blog = null;
    if (window.firebase && firebase.firestore) {
        try {
            const doc = await firebase.firestore().collection('blogs').doc(String(id)).get();
            if (doc.exists) blog = doc.data();
        } catch (err) {
            console.error('Error loading blog from Firestore for edit:', err);
        }
    }

    // Fallback to localStorage
    if (!blog) {
        const blogs = getBlogsLocal();
        blog = blogs.find(b => (b.id && String(b.id) === String(id)) || (b._docId && String(b._docId) === String(id)));
    }

    if (!blog) {
        alert('Blog not found');
        return;
    }

    editingBlogId = id;
    document.getElementById('blogTitle').value = blog.title || '';
    document.getElementById('blogDate').value = blog.date ? new Date(blog.date).toISOString().substr(0,10) : '';
    document.getElementById('blogExcerpt').value = blog.excerpt || '';
    document.getElementById('blogThumbnail').value = blog.thumbnail || '';
    if (blogContent) blogContent.innerHTML = blog.content || '';
    if (blogModal) blogModal.style.display = 'flex';
    else if (blogForm) blogForm.style.display = 'block';
};

// Editor toolbar actions
document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    const cmd = btn.getAttribute('data-cmd');
    if (cmd === 'createLink') {
        const url = prompt('Enter the URL');
        if (url) document.execCommand('createLink', false, url);
        return;
    }
    if (cmd === 'insertImage') {
        const url = prompt('Enter image URL');
        if (url) document.execCommand('insertImage', false, url);
        return;
    }
    document.execCommand(cmd, false, null);
});

const fontSizeSelect = document.getElementById('fontSizeSelect');
if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', function () {
        const val = this.value;
        if (val) document.execCommand('fontSize', false, val);
        this.selectedIndex = 0;
    });
}

const fontColor = document.getElementById('fontColor');
if (fontColor) {
    fontColor.addEventListener('input', function () {
        document.execCommand('foreColor', false, this.value);
    });
}

// initialize list on admin page load
if (blogsListEl) renderAdminBlogs();

// Wire up user search input (if present)
const userSearchInput = document.getElementById('userSearch');
const clearUserSearchBtn = document.getElementById('clearUserSearch');
if (userSearchInput) {
    userSearchInput.addEventListener('input', async (e) => {
        const q = e.target.value || '';
        // update the main list as before
        loadUsers(q);
        // show suggestions dropdown
        const all = await fetchUsersRaw();
        const filtered = filterUsersByQuery(all, q).slice(0, 6);
        renderSearchSuggestions(filtered);
    });
}
if (clearUserSearchBtn) {
    clearUserSearchBtn.addEventListener('click', () => {
        if (userSearchInput) userSearchInput.value = '';
        loadUsers('');
        renderSearchSuggestions([]);
    });
}

// Fetch users helper used by both loadUsers and suggestions
async function fetchUsersRaw() {
    let users = [];
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('users').get();
            users = snapshot.docs.map(d => {
                const data = d.data(); data._docId = d.id; return data;
            });
        } catch (err) {
            console.error('Error fetching users from Firestore (suggestions):', err);
            users = JSON.parse(localStorage.getItem('users') || '[]');
        }
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
    }
    return users;
}

function filterUsersByQuery(users, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
        const name = (u.fullName || (u.firstName ? (u.firstName + (u.lastName ? ' ' + u.lastName : '')) : '') || u.name || u.displayName || '').toString().toLowerCase();
        const email = (u.email || '').toString().toLowerCase();
        const phone = (u.telephone || u.phone || u.tel || '').toString().toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
    });
}

function renderSearchSuggestions(users) {
    const container = document.getElementById('userSearchResults');
    if (!container) return;
    if (!users || users.length === 0) {
        container.innerHTML = '';
        return;
    }

    const list = users.map(u => {
        const displayName = u.fullName || (u.firstName ? (u.firstName + (u.lastName ? ' ' + u.lastName : '')) : (u.name || u.displayName || 'Unnamed'));
        const phone = u.telephone || u.phone || u.tel || '-';
        const docId = u._docId || u.uid || '';
        return `<div class="search-suggestion-item" data-docid="${docId}" style="padding:8px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg, #fff);margin-bottom:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;flex-direction:column;text-align:left">
                <strong>${escapeHtml(displayName)}</strong>
                <small style="color:var(--text-light)">${escapeHtml(u.email || '-') } • ${escapeHtml(phone)}</small>
            </div>
            <div style="font-size:14px;color:var(--text-light)"><i class="fas fa-user"></i></div>
        </div>`;
    }).join('');

    container.innerHTML = `<div style="position:absolute;left:0;right:0;z-index:3000;max-height:300px;overflow:auto;padding:6px;box-shadow:0 6px 18px rgba(2,8,23,0.12);border-radius:8px;background:white">${list}</div>`;

    // attach click handlers
    container.querySelectorAll('.search-suggestion-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const docId = el.getAttribute('data-docid');
            if (docId) {
                // open the user modal
                showUserModal(docId);
                // hide suggestions
                renderSearchSuggestions([]);
            }
        });
    });
}

// small helper to escape HTML inside suggestion list
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    const container = document.getElementById('userSearchResults');
    const input = document.getElementById('userSearch');
    if (!container || !input) return;
    if (!container.contains(e.target) && e.target !== input) {
        renderSearchSuggestions([]);
    }
});

// Certify modal event wiring
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('certifyStudentBtn');
    if (btn) btn.addEventListener('click', () => openCertifyModal());
    const closeBtn = document.getElementById('certifyModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeCertifyModal);
    const cancelBtn = document.getElementById('cancelCertify');
    if (cancelBtn) cancelBtn.addEventListener('click', closeCertifyModal);
    const saveBtn = document.getElementById('saveCertify');
    if (saveBtn) saveBtn.addEventListener('click', saveCertificate);

    const search = document.getElementById('certifySearch');
    if (search) {
        let t = null;
        search.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                const q = (search.value || '').trim().toLowerCase();
                if (!q) { renderCertifyResults([]); return; }
                const list = (_usersCacheForCertify || []).filter(u => (u.fullName || u.name || u.displayName || u.email || '').toLowerCase().includes(q));
                renderCertifyResults(list.slice(0,50));
            }, 200);
        });
    }
});

// User modal helpers
async function showUserModal(docId) {
    if (!docId) {
        alert('Invalid user reference');
        return;
    }
    let user = null;

    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const doc = await db.collection('users').doc(docId).get();
            if (doc.exists) user = doc.data();
        } catch (err) {
            console.error('Error fetching user for modal:', err);
        }
    }

    if (!user) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        user = users.find(u => (u._docId && u._docId === docId) || u.uid === docId || u.email === docId || u.id === docId);
    }

    if (!user) {
        alert('User not found');
        return;
    }

    const displayName = user.fullName || (user.firstName ? (user.firstName + (user.lastName ? ' ' + user.lastName : '')) : (user.name || user.displayName || 'Unnamed'));
    const phone = user.telephone || user.phone || user.tel || '-';

    function formatDOBForDisplay(value) {
        if (!value) return '-';
        // already dd/mm/yyyy
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
        // ISO yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const parts = value.split('-'); return parts[2] + '/' + parts[1] + '/' + parts[0];
        }
        // Firestore Timestamp-like object
        try {
            if (value && typeof value === 'object' && typeof value.toDate === 'function') {
                const d = value.toDate();
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return dd + '/' + mm + '/' + yyyy;
            }
            const d2 = new Date(value);
            if (!isNaN(d2.getTime())) {
                const dd = String(d2.getDate()).padStart(2, '0');
                const mm = String(d2.getMonth() + 1).padStart(2, '0');
                const yyyy = d2.getFullYear();
                return dd + '/' + mm + '/' + yyyy;
            }
        } catch (e) {}
        return String(value);
    }

    const content = document.getElementById('userModalContent');
    // Prefer a human-readable EAT registration timestamp if present
    let enrolledDisplay = '';
    if (user.registeredAtEAT) {
        enrolledDisplay = user.registeredAtEAT + ' (EAT)';
    } else if (user.enrolledDate) {
        try { enrolledDisplay = new Date(user.enrolledDate).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' }); } catch (e) { enrolledDisplay = user.enrolledDate; }
    } else if (user.createdAt) {
        // Firestore serverTimestamp may be a Timestamp object
        try {
            if (user.createdAt.toDate) {
                enrolledDisplay = user.createdAt.toDate().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' });
            } else {
                enrolledDisplay = new Date(user.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' });
            }
        } catch (e) {
            enrolledDisplay = '';
        }
    }

    const dobDisplay = formatDOBForDisplay(user.dob);

    content.innerHTML = `
        <h3>${displayName}</h3>
        <p><strong>Email:</strong> ${user.email || '-'}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>DOB:</strong> ${dobDisplay}</p>
        <p><strong>Registered:</strong> ${enrolledDisplay}</p>
        <p><strong>Progress:</strong> ${user.progress || 0}%</p>
        <p><strong>Status:</strong> ${user.verified ? '<span style="color:var(--primary-green)">Verified</span>' : '<span style="color:var(--accent-orange)">Waiting</span>'}</p>
        <div style="margin-top:12px;display:flex;gap:8px">
            ${user.verified ? '' : `<button class="btn btn-primary" id="markVerifiedBtn">Verify</button>`}
            <button class="btn btn-secondary" id="closeUserModal">Close</button>
        </div>
    `;

    document.getElementById('userModal').style.display = 'flex';

    const modalClose = document.getElementById('userModalClose');
    if (modalClose) modalClose.addEventListener('click', () => { document.getElementById('userModal').style.display = 'none'; });
    const closeBtn = document.getElementById('closeUserModal');
    if (closeBtn) closeBtn.addEventListener('click', () => { document.getElementById('userModal').style.display = 'none'; });

    const markBtn = document.getElementById('markVerifiedBtn');
    if (markBtn) {
        markBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to verify this user?')) return;
            await markUserVerified(docId);
            document.getElementById('userModal').style.display = 'none';
        });
    }
}

async function markUserVerified(docId) {
    // Update Firestore if available
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(docId).update({ verified: true, status: 'approved' });
        } catch (err) {
            console.error('Error updating user verified flag:', err);
        }
    }

    // Update localStorage fallback
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const idx = users.findIndex(u => (u._docId && u._docId === docId) || u.uid === docId || u.id === docId || u.email === docId);
    if (idx !== -1) {
        users[idx].verified = true;
        users[idx].status = 'approved';
        localStorage.setItem('users', JSON.stringify(users));
    }

    // Refresh view and stats
    loadUsers();
    loadDashboardStats();
}
