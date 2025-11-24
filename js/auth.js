// Authentication System using Local Storage

// Initialize demo admin account
function initializeAdmin() {
    // Demo admin creation removed - credentials are now stored in Firestore
}

// Initialize users array if it doesn't exist
function initializeUsers() {
    const users = localStorage.getItem('users');
    if (!users) {
        localStorage.setItem('users', JSON.stringify([]));
    }
}

// User Signup
function signupUser(name, email, phone, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Check if user already exists
    if (users.find(u => u.email === email)) {
        return { success: false, message: 'Email already registered!' };
    }
    
    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        phone,
        password,
        role: 'user',
        enrolledDate: new Date().toISOString(),
        progress: 0,
        completedModules: [],
        theme: 'light',
        certified: false
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    return { success: true, message: 'Account created successfully!', user: newUser };
}

// User Login
function loginUser(email, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        // Set current user session
        localStorage.setItem('currentUser', JSON.stringify(user));
        return { success: true, message: 'Login successful!', user };
    }
    
    return { success: false, message: 'Invalid email or password!' };
}

// Admin Login
async function hashString(str) {
    if (window.crypto && crypto.subtle) {
        const enc = new TextEncoder();
        const data = enc.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback (not secure)
    return btoa(str);
}

async function loginAdmin(username, password) {
    // If Firebase is available, check Firestore admin collection for stored hashed credentials
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const docId = encodeURIComponent(username.toLowerCase());
            const doc = await db.collection('admin').doc(docId).get();
            if (!doc.exists) {
                return { success: false, message: 'Admin account not found!' };
            }
            const data = doc.data();
            const hashed = await hashString(password);
            if (data.passwordHash === hashed) {
                const admin = { username: username.toLowerCase(), name: data.name || username, role: 'admin' };
                localStorage.setItem('currentAdmin', JSON.stringify(admin));
                return { success: true, message: 'Admin login successful!', admin };
            } else {
                return { success: false, message: 'Invalid admin credentials!' };
            }
        } catch (err) {
            return { success: false, message: 'Error connecting to auth system.' };
        }
    }

    // Fallback to localStorage (legacy) - support adminAccount keys with email or username
    const admin = JSON.parse(localStorage.getItem('adminAccount'));
    if (admin && ((admin.username && admin.username === username) || (admin.email && admin.email === username)) && admin.password === password) {
        localStorage.setItem('currentAdmin', JSON.stringify(admin));
        return { success: true, message: 'Admin login successful!', admin };
    }
    return { success: false, message: 'Invalid admin credentials!' };
}

// Logout
function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentAdmin');
    window.location.href = 'index.html';
}

// Check if user is logged in
function getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
}

// Check if admin is logged in
function getCurrentAdmin() {
    const admin = localStorage.getItem('currentAdmin');
    return admin ? JSON.parse(admin) : null;
}

// Update user data
function updateUser(updatedUser) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const index = users.findIndex(u => u.id === updatedUser.id);
    
    if (index !== -1) {
        users[index] = updatedUser;
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return { success: true };
    }
    
    return { success: false };
}

// Initialize on page load
initializeAdmin();
initializeUsers();

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const result = loginUser(email, password);
        
        if (result.success) {
            alert(result.message);
            window.location.href = 'profile.html';
        } else {
            alert(result.message);
        }
    });
}

// Signup Form Handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const phone = document.getElementById('signupPhone').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        
        const result = signupUser(name, email, phone, password);
        
        if (result.success) {
            alert(result.message);
            // Auto login after signup
            loginUser(email, password);
            window.location.href = 'profile.html';
        } else {
            alert(result.message);
        }
    });
}

// Toggle between login and signup forms
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');

if (showSignup) {
    showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    });
}

if (showLogin) {
    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });
}

// Admin login is handled on the admin login page (uses async Firestore flow)
