// Assignments Page Logic

const currentUser = getCurrentUser();

if (!currentUser) {
    window.location.href = 'login.html';
}

// Load assignments
function loadAssignments() {
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const responses = JSON.parse(localStorage.getItem('assignmentResponses') || '[]');
    const container = document.getElementById('assignmentsContainer');
    
    if (assignments.length === 0) {
        container.innerHTML = '<p class="no-data">No assignments available yet. Check back later!</p>';
        return;
    }
    
    container.innerHTML = assignments.map(assignment => {
        const userResponse = responses.find(r => r.assignmentId === assignment.id && r.userId === currentUser.id);
        const isCompleted = !!userResponse;
        
        return `
            <div class="assignment-card ${isCompleted ? 'completed' : ''}">
                <div class="assignment-header">
                    <h3>${assignment.title}</h3>
                    <span class="badge">Module ${assignment.module}</span>
                </div>
                <p>${assignment.instructions}</p>
                <div class="assignment-meta">
                    <span><i class="fas fa-question-circle"></i> ${assignment.questions.length} Questions</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(assignment.createdDate).toLocaleDateString()}</span>
                </div>
                ${isCompleted 
                    ? `<button class="btn btn-secondary" disabled>
                        <i class="fas fa-check-circle"></i> Completed
                       </button>`
                    : `<button class="btn btn-primary" onclick="openAssignment('${assignment.id}')">
                        <i class="fas fa-pencil-alt"></i> Start Assignment
                       </button>`
                }
            </div>
        `;
    }).join('');
}

let currentAssignmentId = null;

function openAssignment(assignmentId) {
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const assignment = assignments.find(a => a.id === assignmentId);
    
    if (!assignment) return;
    
    currentAssignmentId = assignmentId;
    
    document.getElementById('modalAssignmentTitle').textContent = assignment.title;
    document.getElementById('modalInstructions').textContent = assignment.instructions;
    
    const questionsHtml = assignment.questions.map((q, index) => `
        <div class="form-group">
            <label><strong>Question ${index + 1}:</strong> ${q.question}</label>
            <textarea id="answer_${index}" rows="4" required placeholder="Enter your answer here..."></textarea>
        </div>
    `).join('');
    
    document.getElementById('modalQuestions').innerHTML = questionsHtml;
    document.getElementById('assignmentModal').style.display = 'block';
}

// Close modal
document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('assignmentModal').style.display = 'none';
});

// Submit assignment
document.getElementById('assignmentResponseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const assignment = assignments.find(a => a.id === currentAssignmentId);
    
    const answers = [];
    assignment.questions.forEach((q, index) => {
        answers.push({
            question: q.question,
            answer: document.getElementById(`answer_${index}`).value
        });
    });
    
    const response = {
        id: Date.now().toString(),
        assignmentId: currentAssignmentId,
        userId: currentUser.id,
        userName: currentUser.name,
        answers: answers,
        submittedDate: new Date().toISOString()
    };
    
    const responses = JSON.parse(localStorage.getItem('assignmentResponses') || '[]');
    responses.push(response);
    localStorage.setItem('assignmentResponses', JSON.stringify(responses));
    
    // Update user progress
    updateUserProgress();
    
    alert('Assignment submitted successfully!');
    document.getElementById('assignmentModal').style.display = 'none';
    loadAssignments();
});

function updateUserProgress() {
    const assignments = JSON.parse(localStorage.getItem('assignments') || '[]');
    const responses = JSON.parse(localStorage.getItem('assignmentResponses') || '[]');
    const userResponses = responses.filter(r => r.userId === currentUser.id);
    
    if (assignments.length > 0) {
        const progress = Math.round((userResponses.length / assignments.length) * 100);
        currentUser.progress = progress;
        updateUser(currentUser);
    }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// Load assignments on page load
loadAssignments();
