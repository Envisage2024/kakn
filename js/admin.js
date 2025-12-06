// Admin Dashboard Logic

// Check if admin is logged in
const currentAdmin = getCurrentAdmin();

if (!currentAdmin) {
    window.location.href = 'admin-login.html';
}

// Display admin name
document.getElementById('adminName').textContent = currentAdmin.name;

// Sidebar Toggle
document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('adminSidebar').classList.toggle('active');
});

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
    });
});

// Load Section Data
function loadSectionData(sectionName) {
    switch(sectionName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'assignments':
            loadAssignments();
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
    document.getElementById('totalAssignments').textContent = assignments.length;

    const unread = messages.filter(m => !m.adminRead).length;
    document.getElementById('unreadMessages').textContent = unread;

    const certified = users.filter(u => u.certified).length;
    document.getElementById('totalCertified').textContent = certified;

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

document.getElementById('addAssignmentBtn').addEventListener('click', () => {
    document.getElementById('assignmentForm').style.display = 'block';
});

document.getElementById('cancelAssignment').addEventListener('click', () => {
    document.getElementById('assignmentForm').style.display = 'none';
    document.getElementById('createAssignmentForm').reset();
});

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

function loadAssignments() {
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const assignmentsList = document.getElementById('assignmentsList');
    
    if (assignments.length === 0) {
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
                <span><i class="fas fa-question-circle"></i> ${assignment.questions.length} Questions</span>
                <span><i class="fas fa-calendar"></i> ${new Date(assignment.createdDate).toLocaleDateString()}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="viewResponses('${assignment.id}')">
                <i class="fas fa-eye"></i> View Responses
            </button>
        </div>
    `).join('');
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

function loadMessages() {
    const messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
    const conversationsList = document.getElementById('conversationsList');
    
    if (messages.length === 0) {
        conversationsList.innerHTML = '<p class="no-data">No messages yet</p>';
        return;
    }
    
    // Group messages by user
    const conversations = {};
    messages.forEach(msg => {
        if (!conversations[msg.userId]) {
            conversations[msg.userId] = [];
        }
        conversations[msg.userId].push(msg);
    });
    
    conversationsList.innerHTML = Object.keys(conversations).map(userId => {
        const userMessages = conversations[userId];
        const lastMessage = userMessages[userMessages.length - 1];
        const unread = userMessages.filter(m => !m.adminRead).length;
        
        return `
            <div class="conversation-item ${unread > 0 ? 'unread' : ''}" onclick="openConversation('${userId}')">
                <i class="fas fa-user-circle"></i>
                <div class="conversation-info">
                    <h4>${lastMessage.userName}</h4>
                    <p>${lastMessage.message.substring(0, 50)}...</p>
                </div>
                ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
            </div>
        `;
    }).join('');
}

function openConversation(userId) {
    currentConversationUser = userId;
    const messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
    const userMessages = messages.filter(m => m.userId === userId);
    
    // Mark messages as read
    messages.forEach(m => {
        if (m.userId === userId) {
            m.adminRead = true;
        }
    });
    localStorage.setItem('adminMessages', JSON.stringify(messages));
    
    const user = JSON.parse(localStorage.getItem('users') || '[]').find(u => u.id === userId);
    
    document.getElementById('messageThreadHeader').innerHTML = `
        <i class="fas fa-user-circle"></i>
        <h3>${user ? user.name : 'Student'}</h3>
    `;
    
    document.getElementById('messageThreadContent').innerHTML = userMessages.map(msg => `
        <div class="message-bubble ${msg.isFromAdmin ? 'admin-message' : 'user-message'}">
            <p>${msg.message}</p>
            <small>${new Date(msg.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
    
    document.getElementById('messageReplyForm').style.display = 'flex';
    loadMessages();
}

document.getElementById('sendReplyBtn').addEventListener('click', () => {
    const replyText = document.getElementById('replyMessage').value;
    
    if (!replyText || !currentConversationUser) return;
    
    const messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
    const user = JSON.parse(localStorage.getItem('users') || '[]').find(u => u.id === currentConversationUser);
    
    messages.push({
        id: Date.now().toString(),
        userId: currentConversationUser,
        userName: user.name,
        message: replyText,
        timestamp: new Date().toISOString(),
        isFromAdmin: true,
        adminRead: true,
        userRead: false
    });
    
    localStorage.setItem('adminMessages', JSON.stringify(messages));
    
    document.getElementById('replyMessage').value = '';
    openConversation(currentConversationUser);
});

// Certifications Management
function loadCertifications() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Students who completed all modules are eligible
    const eligible = users.filter(u => !u.certified && u.progress >= 100);
    const certified = users.filter(u => u.certified);
    
    const eligibleStudents = document.getElementById('eligibleStudents');
    const certifiedStudents = document.getElementById('certifiedStudents');
    
    if (eligible.length === 0) {
        eligibleStudents.innerHTML = '<p class="no-data">No eligible students yet</p>';
    } else {
        eligibleStudents.innerHTML = eligible.map(user => `
            <div class="student-item">
                <div class="student-info">
                    <i class="fas fa-user-graduate"></i>
                    <div>
                        <h4>${user.name}</h4>
                        <p>Progress: ${user.progress}%</p>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="issueCertificate('${user.id}')">
                    <i class="fas fa-certificate"></i> Issue Certificate
                </button>
            </div>
        `).join('');
    }
    
    if (certified.length === 0) {
        certifiedStudents.innerHTML = '<p class="no-data">No certified students yet</p>';
    } else {
        certifiedStudents.innerHTML = certified.map(user => `
            <div class="student-item certified">
                <i class="fas fa-check-circle"></i>
                <div>
                    <h4>${user.name}</h4>
                    <p>Certified on ${new Date(user.certifiedDate).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
    }
}

function issueCertificate(userId) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.id === userId);
    
    if (user) {
        user.certified = true;
        user.certifiedDate = new Date().toISOString();
        localStorage.setItem('users', JSON.stringify(users));
        
        alert(`Certificate issued to ${user.name}!`);
        loadCertifications();
        loadDashboardStats();
    }
}

// Notes Management
document.getElementById('addNoteBtn').addEventListener('click', () => {
    document.getElementById('noteForm').style.display = 'block';
});

document.getElementById('cancelNote').addEventListener('click', () => {
    document.getElementById('noteForm').style.display = 'none';
    document.getElementById('uploadNoteForm').reset();
});

document.getElementById('uploadNoteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('noteFile');
    const fileName = fileInput.files[0] ? fileInput.files[0].name : null;
    
    const note = {
        id: Date.now().toString(),
        title: document.getElementById('noteTitle').value,
        module: document.getElementById('noteModule').value,
        content: document.getElementById('noteContent').value,
        fileName: fileName,
        uploadDate: new Date().toISOString()
    };
    
    const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
    notes.push(note);
    localStorage.setItem('courseNotes', JSON.stringify(notes));
    
    alert('Note uploaded successfully!');
    document.getElementById('noteForm').style.display = 'none';
    document.getElementById('uploadNoteForm').reset();
    loadNotes();
});

function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
    const notesList = document.getElementById('notesList');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<p class="no-data">No notes uploaded yet. Click "Upload New Note" to add one.</p>';
        return;
    }
    
    notesList.innerHTML = notes.map(note => `
        <div class="note-card">
            <div class="note-header">
                <h3>${note.title}</h3>
                <span class="badge">Module ${note.module}</span>
            </div>
            <p>${note.content.substring(0, 100)}...</p>
            ${note.fileName ? `<p class="note-file"><i class="fas fa-file"></i> ${note.fileName}</p>` : ''}
            <div class="note-meta">
                <span><i class="fas fa-calendar"></i> ${new Date(note.uploadDate).toLocaleDateString()}</span>
                <button class="btn btn-secondary btn-sm" onclick="deleteNote('${note.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
        const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
        const filtered = notes.filter(n => n.id !== noteId);
        localStorage.setItem('courseNotes', JSON.stringify(filtered));
        loadNotes();
    }
}

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
const cancelBlog = document.getElementById('cancelBlog');
const createBlogForm = document.getElementById('createBlogForm');
const blogsListEl = document.getElementById('blogsList');
const blogContent = document.getElementById('blogContent');

function getBlogs() {
    return JSON.parse(localStorage.getItem('blogs') || '[]');
}

function saveBlogs(blogs) {
    localStorage.setItem('blogs', JSON.stringify(blogs));
}

function renderAdminBlogs() {
    const blogs = getBlogs();
    if (!blogs || blogs.length === 0) {
        blogsListEl.innerHTML = '<p class="no-data">No blog posts yet. Click "Add New Blog" to create one.</p>';
        return;
    }

    blogsListEl.innerHTML = blogs.slice().reverse().map(b => `
        <div class="note-card">
            <div class="note-header">
                <h3>${b.title}</h3>
                <span class="badge">${new Date(b.date).toLocaleDateString()}</span>
            </div>
            <p>${b.excerpt || ''}</p>
            <div class="note-meta">
                <button class="btn btn-secondary btn-sm" onclick="editBlog('${b.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="deleteBlog('${b.id}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

window.editBlog = function (id) {
    const blogs = getBlogs();
    const blog = blogs.find(b => b.id === id);
    if (!blog) return;
    editingBlogId = id;
    document.getElementById('blogTitle').value = blog.title;
    document.getElementById('blogDate').value = new Date(blog.date).toISOString().substr(0,10);
    document.getElementById('blogExcerpt').value = blog.excerpt || '';
    document.getElementById('blogThumbnail').value = blog.thumbnail || '';
    if (blogContent) blogContent.innerHTML = blog.content || '';
    blogForm.style.display = 'block';
};

window.deleteBlog = function (id) {
    if (!confirm('Delete this blog post?')) return;
    const blogs = getBlogs();
    const filtered = blogs.filter(b => b.id !== id);
    saveBlogs(filtered);
    renderAdminBlogs();
};

if (addBlogBtn) {
    addBlogBtn.addEventListener('click', () => {
        editingBlogId = null;
        createBlogForm.reset();
        if (blogContent) blogContent.innerHTML = '';
        blogForm.style.display = 'block';
    });
}

if (cancelBlog) {
    cancelBlog.addEventListener('click', () => {
        blogForm.style.display = 'none';
        createBlogForm.reset();
        if (blogContent) blogContent.innerHTML = '';
        editingBlogId = null;
    });
}

if (createBlogForm) {
    createBlogForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('blogTitle').value;
        const date = document.getElementById('blogDate').value || new Date().toISOString();
        const excerpt = document.getElementById('blogExcerpt').value;
        const thumbnail = document.getElementById('blogThumbnail').value;
        const content = blogContent ? blogContent.innerHTML : '';

        const blogs = getBlogs();
        if (editingBlogId) {
            const idx = blogs.findIndex(b => b.id === editingBlogId);
            if (idx !== -1) {
                blogs[idx] = { id: editingBlogId, title, date, excerpt, thumbnail, content };
            }
        } else {
            const id = Date.now().toString();
            blogs.push({ id, title, date, excerpt, thumbnail, content });
        }

        saveBlogs(blogs);
        blogForm.style.display = 'none';
        createBlogForm.reset();
        if (blogContent) blogContent.innerHTML = '';
        editingBlogId = null;
        renderAdminBlogs();
        alert('Blog saved successfully');
    });
}

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
