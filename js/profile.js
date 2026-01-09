// Profile Page Logic

// Check if user is logged in
const currentUser = getCurrentUser();

if (!currentUser) {
    window.location.href = 'login.html';
}

// Populate profile data
function loadProfileData() {
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editEmail').value = currentUser.email;
    document.getElementById('editPhone').value = currentUser.phone || '';
    
    // Format enrolled date
    const enrolledDate = new Date(currentUser.enrolledDate);
    document.getElementById('enrolledDate').textContent = enrolledDate.toLocaleDateString();
    
    // Display progress
    document.getElementById('userProgress').textContent = currentUser.progress + '%';
    
    // Load theme preference
    if (currentUser.theme === 'dark') {
        document.getElementById('themeToggle').checked = true;
        document.body.classList.add('dark-theme');
    }
}

// Edit Profile Form
document.getElementById('editProfileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    currentUser.name = document.getElementById('editName').value;
    currentUser.email = document.getElementById('editEmail').value;
    currentUser.phone = document.getElementById('editPhone').value;
    
    const newPassword = document.getElementById('editPassword').value;
    if (newPassword) {
        currentUser.password = newPassword;
    }
    
    const result = updateUser(currentUser);
    
    if (result.success) {
        alert('Profile updated successfully!');
        loadProfileData();
        document.getElementById('editPassword').value = '';
    } else {
        alert('Failed to update profile!');
    }
});

// Theme Toggle
document.getElementById('themeToggle').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('dark-theme');
        currentUser.theme = 'dark';
    } else {
        document.body.classList.remove('dark-theme');
        currentUser.theme = 'light';
    }
    updateUser(currentUser);
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// Load profile data on page load
loadProfileData();
