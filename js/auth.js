// Authentication System (STUBBED)
// NOTE: Authentication logic has been disabled for a full rewrite.
// The original implementations have been replaced with no-op stubs
// to avoid accidental authentication while you implement the new flow.

const AUTH_DISABLED = true;

function initializeAdmin() {
    // intentionally left blank — admin initialization disabled
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
    return { success: false, message: 'Signup is disabled while authentication is being rewritten.' };
}

// User Login
function loginUser(email, password) {
    return { success: false, message: 'Login is disabled while authentication is being rewritten.' };
}

// Admin Login
async function hashString(str) {
    // Prefer Web Crypto API when available
    if (window.crypto && crypto.subtle) {
        const enc = new TextEncoder();
        const data = enc.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Pure-JS SHA-256 fallback for environments without Web Crypto (ensures cross-device consistency)
    function sha256_js(message) {
        // constants [first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311]
        const K = [1116352408,1899447441,-1245643825,-373957723,961987163,1508970993,-1841331548,-1424204075,-670586216,310598401,607225278,1426881987,1925078388,-2132889090,-1680079193,-1046744716,-459576895,-272742522,264347078,604807628,770255983,1249150122,1555081692,1996064986,-1740746414,-1473132947,-1341970488,-1084653625,-958395405,-710438585,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,-2117940946,-1838011259,-1564481375,-1474664885,-1035236496,-949202525,-778901479,-694614492,-200395387,-360896,106296,344756,0,0,0,0,0,0,0,0];// truncated filler allowed
        function rightRotate(n, x){ return (x >>> n) | (x << (32 - n)); }
        const msg = unescape(encodeURIComponent(message));
        const msgLen = msg.length;
        const words = [];
        for (let i = 0; i < msgLen; i++) words.push(msg.charCodeAt(i));
        // append '1' bit and pad with zeros
        words.push(0x80);
        // append zeros until message length in bits ≡ 448 mod 512
        while ((words.length % 64) !== 56) words.push(0);
        // append original length in bits as 64-bit big-endian integer
        const bitLen = msgLen * 8;
        for (let i = 7; i >= 0; i--) words.push((bitLen >>> (i * 8)) & 0xff);

        const H = [1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];

        for (let i = 0; i < words.length; i += 64) {
            const w = new Array(64);
            for (let t = 0; t < 16; t++) {
                w[t] = (words[i + (t*4)] << 24) | (words[i + (t*4) + 1] << 16) | (words[i + (t*4) + 2] << 8) | (words[i + (t*4) + 3]);
            }
            for (let t = 16; t < 64; t++) {
                const s0 = (rightRotate(7, w[t-15]) ^ rightRotate(18, w[t-15]) ^ (w[t-15] >>> 3)) >>> 0;
                const s1 = (rightRotate(17, w[t-2]) ^ rightRotate(19, w[t-2]) ^ (w[t-2] >>> 10)) >>> 0;
                w[t] = ( (w[t-16] + s0 + w[t-7] + s1) >>> 0 );
            }

            let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

            for (let t = 0; t < 64; t++) {
                const S1 = (rightRotate(6, e) ^ rightRotate(11, e) ^ rightRotate(25, e)) >>> 0;
                const ch = ((e & f) ^ (~e & g)) >>> 0;
                const temp1 = (h + S1 + ch + (K[t] >>> 0) + (w[t] >>> 0)) >>> 0;
                const S0 = (rightRotate(2, a) ^ rightRotate(13, a) ^ rightRotate(22, a)) >>> 0;
                const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                const temp2 = (S0 + maj) >>> 0;

                h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
            }

            H[0] = (H[0] + a) >>> 0;
            H[1] = (H[1] + b) >>> 0;
            H[2] = (H[2] + c) >>> 0;
            H[3] = (H[3] + d) >>> 0;
            H[4] = (H[4] + e) >>> 0;
            H[5] = (H[5] + f) >>> 0;
            H[6] = (H[6] + g) >>> 0;
            H[7] = (H[7] + h) >>> 0;
        }

        return H.map(h => ('00000000' + (h >>> 0).toString(16)).slice(-8)).join('');
    }

    return sha256_js(str || '');
}

async function loginAdmin(username, password) {
    // Prefer Firestore if available
    try {
        const usernameRaw = (username || '').toString();
        const usernameNorm = canonicalUsername(usernameRaw);
        const passwordNorm = (password || '').toString().normalize ? (password || '').toString().normalize('NFC').trim() : (password || '').toString().trim();
        const pwdHash = await hashString(passwordNorm);

        if (window.firebase && firebase.firestore) {
            try {
                const db = firebase.firestore();
                const docId = usernameNorm; // use canonical username as doc id for consistency
                let doc = await db.collection('admin').doc(docId).get();
                // If not found, try legacy encoded id (some code previously used encodeURIComponent)
                if (!doc.exists) {
                    try {
                        const altId = encodeURIComponent(usernameNorm);
                        doc = await db.collection('admin').doc(altId).get();
                    } catch (e) { /* ignore */ }
                }
                let data = null;
                if (doc.exists) {
                    data = doc.data();
                } else {
                    // fallback: search collection for matching username field
                    const snapshot = await db.collection('admin').get();
                    snapshot.forEach(d => {
                        if (data) return;
                        const u = (d.data().canonical || d.data().username || '').toString();
                        if (canonicalUsername(u) === usernameNorm) data = d.data();
                    });
                }

                if (!data) {
                    console.debug('loginAdmin: no admin data found for', usernameNorm);
                    return { success: false, message: 'Admin account not found.' };
                }
                if (!data.passwordHash) {
                    console.debug('loginAdmin: admin record has no passwordHash', data);
                    return { success: false, message: 'Admin account has no password set.' };
                }
                const storedHash = (data.passwordHash || '').toString().toLowerCase();
                const computedHash = (pwdHash || '').toString().toLowerCase();
                if (storedHash === computedHash) {
                    const admin = { username: usernameNorm, name: data.name || usernameRaw, role: 'admin' };
                    localStorage.setItem('currentAdmin', JSON.stringify(admin));
                    return { success: true, message: 'Admin login successful.', admin };
                }
                console.debug('loginAdmin: password hash mismatch', { usernameNorm, storedHash, computedHash });
                return { success: false, message: 'Invalid admin credentials.' };
            } catch (err) {
                console.error('Error querying Firestore for admin:', err);
                return { success: false, message: 'Error connecting to auth backend.' };
            }
        }

        // If Firebase SDK isn't available (removed due to CSP), try Firestore REST API
        try {
            const project = 'kakn-sites-7c4e9';
            const docUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/admin/${encodeURIComponent(usernameNorm)}`;
            const r = await fetch(docUrl, { method: 'GET' });
            if (r.ok) {
                const d = await r.json();
                const fields = d.fields || {};
                const storedHash = (fields.passwordHash && fields.passwordHash.stringValue) ? fields.passwordHash.stringValue.toString().toLowerCase() : '';
                const computedHash = (pwdHash || '').toString().toLowerCase();
                if (storedHash && storedHash === computedHash) {
                    const admin = { username: usernameNorm, name: (fields.name && fields.name.stringValue) ? fields.name.stringValue : usernameRaw, role: 'admin' };
                    localStorage.setItem('currentAdmin', JSON.stringify(admin));
                    return { success: true, message: 'Admin login successful (REST).', admin };
                }
                console.debug('loginAdmin (REST): storedHash/computedHash', storedHash, computedHash);
            }
            // If direct doc lookup failed or hash mismatch, try listing the collection and searching
            try {
                const listUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/admin`;
                const listRes = await fetch(listUrl, { method: 'GET' });
                if (listRes.ok) {
                    const listJson = await listRes.json();
                    const docs = listJson.documents || [];
                    for (const docItem of docs) {
                        const f = docItem.fields || {};
                        const candCanonical = (f.canonical && f.canonical.stringValue) ? f.canonical.stringValue : (f.username && f.username.stringValue ? f.username.stringValue : '');
                        if (!candCanonical) continue;
                        if (canonicalUsername(candCanonical) === usernameNorm) {
                            const stored = (f.passwordHash && f.passwordHash.stringValue) ? f.passwordHash.stringValue.toString() : '';
                            // prepare candidate representations to compare against stored value
                            const candidates = [];
                            // normalized SHA-256 hex (from earlier)
                            if (pwdHash) candidates.push(pwdHash.toString());
                            // lowercase hex
                            if (pwdHash) candidates.push(pwdHash.toString().toLowerCase());
                            // base64 of password (legacy fallback used btoa)
                            try { candidates.push(btoa(passwordNorm)); } catch (e) {}
                            // raw password (in case previously stored plain)
                            candidates.push(passwordNorm);

                            console.debug('loginAdmin (REST-list): found candidate', { docName: docItem.name, candCanonical, stored, candidates });

                            if (stored && candidates.includes(stored)) {
                                const admin = { username: usernameNorm, name: (f.name && f.name.stringValue) ? f.name.stringValue : usernameRaw, role: 'admin' };
                                localStorage.setItem('currentAdmin', JSON.stringify(admin));
                                return { success: true, message: 'Admin login successful (REST-list).', admin };
                            }
                            return { success: false, message: 'Invalid admin credentials (REST-list).' };
                        }
                    }
                } else {
                    console.debug('loginAdmin REST list failed:', listRes.status, await listRes.text());
                }
            } catch (listErr) {
                console.debug('loginAdmin REST list error:', listErr);
            }
        } catch (restErr) {
            console.debug('loginAdmin REST lookup failed:', restErr);
        }

        // Fallback to localStorage legacy admin account
        const admin = JSON.parse(localStorage.getItem('adminAccount') || 'null');
        if (admin && ((admin.username && admin.username.toLowerCase() === usernameNorm) || (admin.email && admin.email.toLowerCase() === usernameNorm)) ) {
            // If stored as plain password
            if (admin.password && admin.password === password) {
                localStorage.setItem('currentAdmin', JSON.stringify(admin));
                return { success: true, message: 'Admin login successful (local).', admin };
            }
            // If stored as passwordHash
            if (admin.passwordHash && admin.passwordHash === pwdHash) {
                localStorage.setItem('currentAdmin', JSON.stringify(admin));
                return { success: true, message: 'Admin login successful (local).', admin };
            }
        }

        return { success: false, message: 'Invalid admin credentials.' };
    } catch (err) {
        console.error('loginAdmin error:', err);
        return { success: false, message: 'Unexpected error during admin authentication.' };
    }
}

// Canonicalize username for consistent storage and lookup across devices
function canonicalUsername(input) {
    if (!input) return '';
    try {
        return input.toString().normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    } catch (e) {
        return input.toString().replace(/\s+/g, ' ').trim().toLowerCase();
    }
}
// expose to global in case other scripts want to use it
window.canonicalUsername = canonicalUsername;

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

// Disable automatic initialization and form handlers while auth is rewritten
initializeAdmin();
initializeUsers();

// If forms exist, disable submit actions and show informative message
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Login is disabled while authentication is being rewritten.');
    });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Signup is disabled while authentication is being rewritten.');
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
