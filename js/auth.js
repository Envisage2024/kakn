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

// User Signup (local storage + Firestore write when available)
async function signupUser(name, email, phone, password, extras = {}) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    // Check if user already exists
    if (users.find(u => u.email === email)) {
        return { success: false, message: 'Email already registered!' };
    }

    // Ensure dob in extras is formatted as dd/mm/yyyy
    function formatDOBToDDMMYYYY(input) {
        if (!input) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return input;
        if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            const parts = input.split('-');
            return parts[2] + '/' + parts[1] + '/' + parts[0];
        }
        try {
            const d = new Date(input);
            if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return dd + '/' + mm + '/' + yyyy;
            }
        } catch (e) {}
        return input;
    }

    if (extras && extras.dob) {
        extras.dob = formatDOBToDDMMYYYY(extras.dob);
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
        certified: false,
        verified: false, // admin verifies after payment
        status: 'waiting',
        ...extras
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    // If Firebase is available, write to Firestore as well
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const docId = encodeURIComponent(email.toLowerCase());
            await db.collection('users').doc(docId).set(newUser);
        } catch (err) {
            console.error('Error writing user to Firestore:', err);
        }
    }

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

// Login Form Handler (platform IDs: 'email' and 'password')
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (document.getElementById('email') || document.getElementById('loginEmail')).value;
        const password = (document.getElementById('password') || document.getElementById('loginPassword')).value;

        // Prefer Firestore-authenticated users if available
        if (window.firebase && firebase.firestore) {
            try {
                const db = firebase.firestore();
                const docId = encodeURIComponent(email.toLowerCase());
                const doc = await db.collection('users').doc(docId).get();
                if (doc.exists) {
                    const user = doc.data();
                    // Check password (demo: plaintext)
                    if (user.password !== password) {
                        alert('Invalid email or password!');
                        return;
                    }

                    // If not verified, show waiting message and block access
                    if (!user.verified) {
                        showWaitingApprovalModule(user);
                        // store as currentUser but restricted
                        localStorage.setItem('currentUser', JSON.stringify(user));
                        return;
                    }

                    // Verified -> login
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    alert('Login successful!');
                    window.location.href = 'profile.html';
                    return;
                }
                // If not in Firestore, fallback to localStorage login
            } catch (err) {
                console.error('Error checking Firestore user:', err);
            }
        }

        const result = loginUser(email, password);

        if (result.success) {
            // If local user exists but has a verified flag, enforce it
            const current = result.user;
            if (current.verified === false) {
                showWaitingApprovalModule(current);
                localStorage.setItem('currentUser', JSON.stringify(current));
                return;
            }
            alert(result.message);
            window.location.href = 'profile.html';
        } else {
            alert(result.message);
        }
    });
}

// Signup Form Handler (platform fields)
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const name = `${firstName} ${lastName}`.trim();
        const email = document.getElementById('signupEmail').value;
        const phone = document.getElementById('telephone').value;
        const dob = document.getElementById('dob').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        const extras = { dob };
        const result = await signupUser(name, email, phone, password, extras);

        if (result.success) {
            // Store current user locally (restricted until verified)
            localStorage.setItem('currentUser', JSON.stringify(result.user));

            // Show payment/enrolment message with contact details
            showPaymentModule(result.user);
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

// Platform page IDs: bind signup/link toggles if present
const signupLink = document.getElementById('signupLink');
const backToLogin = document.getElementById('backToLogin');
if (signupLink) {
    signupLink.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('loginForm').style.display = 'none'; document.getElementById('signupForm').style.display = 'block'; });
}
if (backToLogin) {
    backToLogin.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('signupForm').style.display = 'none'; document.getElementById('loginForm').style.display = 'block'; });
}

// Admin login is handled on the admin login page (uses async Firestore flow)

// -----------------------------
// UI helpers: payment & waiting modules
// -----------------------------
function getEnrolmentContact() {
    // Provide a single source of truth for enrolment contact details.
    // Replace these placeholders or set `window.ENROLMENT_CONTACT = { name, phone, email, details }` elsewhere.
    return window.ENROLMENT_CONTACT || { name: 'Andrew Kizito', phone: 'PHONE_NUMBER', email: 'EMAIL_ADDRESS', details: 'Please contact the admin to complete payment of the enrolment fee.' };
}

function removeExistingModule() {
    const existing = document.getElementById('enrolmentModuleOverlay');
    if (existing) existing.remove();
}

function showPaymentModule(user) {
    removeExistingModule();
    const contact = getEnrolmentContact();
    const div = document.createElement('div');
    div.id = 'enrolmentModuleOverlay';
    div.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:20000;padding:20px;';

    div.innerHTML = `
        <div style="background:white;padding:22px;border-radius:12px;max-width:720px;width:100%;box-shadow:0 12px 40px rgba(2,8,23,0.35);">
            <h3 style="margin-top:0">Complete Enrolment</h3>
            <p>To complete enrolment for the course, you need to pay the enrolment fee to <strong>${contact.name}</strong>.</p>
            <p><strong>Phone:</strong> ${contact.phone} <br><strong>Email:</strong> ${contact.email}</p>
            <p>${contact.details}</p>
            <p>When completed your registration will be approved and you will access the course details.</p>
            <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end">
                <button id="enrolCloseBtn" class="btn btn-secondary">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(div);
    document.getElementById('enrolCloseBtn').addEventListener('click', () => removeExistingModule());
}

function showWaitingApprovalModule(user) {
    removeExistingModule();
    const contact = getEnrolmentContact();
    const div = document.createElement('div');
    div.id = 'enrolmentModuleOverlay';
    div.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:20000;padding:20px;';

    div.innerHTML = `
        <div style="background:white;padding:22px;border-radius:12px;max-width:720px;width:100%;box-shadow:0 12px 40px rgba(2,8,23,0.35);">
            <h3 style="margin-top:0">Waiting for Admin Approval</h3>
            <p>Your account is awaiting admin approval to complete enrolment and login.</p>
            <div style="margin-top:12px;">
                <button id="learnMoreBtn" class="btn btn-primary">Learn more</button>
                <button id="enrolCloseBtn" class="btn btn-secondary">Close</button>
            </div>
            <div id="learnMoreDetails" style="display:none;margin-top:12px;padding:12px;border-radius:8px;background:#f8fafc;border:1px solid var(--border-color);">
                <h4>Enrolment Fee Details</h4>
                <p>Please pay the enrolment fee to <strong>${contact.name}</strong> using the contact details below. After payment, the admin will mark your account as verified.</p>
                <p><strong>Phone:</strong> ${contact.phone}<br><strong>Email:</strong> ${contact.email}</p>
            </div>
        </div>
    `;

    document.body.appendChild(div);
    document.getElementById('enrolCloseBtn').addEventListener('click', () => removeExistingModule());
    document.getElementById('learnMoreBtn').addEventListener('click', () => {
        const d = document.getElementById('learnMoreDetails');
        d.style.display = d.style.display === 'none' ? 'block' : 'none';
    });
}
