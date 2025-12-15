// Rewards Page Logic

const currentUser = getCurrentUser();

if (!currentUser) {
    window.location.href = 'login.html';
}

// Load certificate status
function loadCertificateStatus() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const certificateContainer = document.getElementById('certificateContainer');
    
    progressFill.style.width = currentUser.progress + '%';
    progressText.textContent = currentUser.progress + '% Complete';
    
    if (currentUser.certified) {
        // Show certificate
        document.getElementById('certificateTemplate').style.display = 'block';
        document.getElementById('certStudentName').textContent = currentUser.name;
        document.getElementById('certDate').textContent = new Date(currentUser.certifiedDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        certificateContainer.innerHTML = `
            <div class="congrats-message">
                <i class="fas fa-trophy"></i>
                <h2>Congratulations!</h2>
                <p>You have successfully completed the course and earned your certificate!</p>
            </div>
        `;
    } else if (currentUser.progress >= 100) {
        certificateContainer.innerHTML = `
            <div class="pending-message">
                <i class="fas fa-clock"></i>
                <h2>Awaiting Certification</h2>
                <p>You've completed all requirements! Your certificate will be issued soon by the instructor.</p>
            </div>
        `;
    } else {
        certificateContainer.innerHTML = `
            <div class="incomplete-message">
                <i class="fas fa-tasks"></i>
                <h2>Keep Going!</h2>
                <p>Complete all assignments to earn your certificate of completion.</p>
                <p>You're ${currentUser.progress}% there!</p>
                <a href="assignments.html" class="btn btn-primary">
                    <i class="fas fa-pencil-alt"></i> View Assignments
                </a>
            </div>
        `;
    }
}

// Download certificate
function downloadCertificate() {
    const certificate = document.querySelector('.certificate');
    
    html2canvas(certificate, {
        scale: 2,
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Certificate_${currentUser.name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

// Share certificate
function shareCertificate() {
    if (navigator.share) {
        navigator.share({
            title: 'My KAKN Sites Certificate',
            text: `I just completed the Practical Computer Applications and ICT Integration Course at KAKN Sites!`,
            url: window.location.href
        }).catch(err => {
            console.log('Error sharing:', err);
        });
    } else {
        alert('Sharing feature not supported on this browser. Use the download button to save and share manually.');
    }
}

// Print certificate
function printCertificate() {
    window.print();
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// Load certificate status on page load
loadCertificateStatus();
