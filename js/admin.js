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
function loadDashboardStats() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const messages = JSON.parse(localStorage.getItem('adminMessages') || '[]');
    
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('totalAssignments').textContent = assignments.length;
    
    const unread = messages.filter(m => !m.adminRead).length;
    document.getElementById('unreadMessages').textContent = unread;
    
    const certified = users.filter(u => u.certified).length;
    document.getElementById('totalCertified').textContent = certified;
    
    // Recent enrollments
    const recentEnrollments = document.getElementById('recentEnrollments');
    if (users.length > 0) {
        const sorted = users.sort((a, b) => new Date(b.enrolledDate) - new Date(a.enrolledDate));
        const recent = sorted.slice(0, 5);
        recentEnrollments.innerHTML = recent.map(user => `
            <div class="activity-item">
                <i class="fas fa-user-plus"></i>
                <span>${user.name} enrolled</span>
                <small>${new Date(user.enrolledDate).toLocaleDateString()}</small>
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
function loadUsers() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const usersList = document.getElementById('usersList');
    
    if (users.length === 0) {
        usersList.innerHTML = '<p class="no-data">No users registered yet</p>';
        return;
    }
    
    usersList.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Enrolled</th>
                    <th>Progress</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.phone || '-'}</td>
                        <td>${new Date(user.enrolledDate).toLocaleDateString()}</td>
                        <td>${user.progress}%</td>
                        <td>${user.certified ? '<span class="badge green">Certified</span>' : '<span class="badge blue">Active</span>'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
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
