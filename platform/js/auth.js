document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const signupLink = document.getElementById('signupLink');
    const signupForm = document.getElementById('signupForm');
    const backToLogin = document.getElementById('backToLogin');
    const loginBox = document.querySelector('.login-box');

    // Ensure firebase initialized (index.html loads the SDK and calls initializeApp)
    if (!window.firebase || !firebase.apps || firebase.apps.length === 0) {
        console.error('Firebase not initialized. Make sure the SDK and config are loaded before auth.js');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // Page loader control: show until we confirm auth state
    function showLoader() {
        const l = document.getElementById('pageLoader');
        if (l) {
            l.style.display = 'flex';
            l.setAttribute('aria-hidden', 'false');
        }
    }
    function hideLoader() {
        const l = document.getElementById('pageLoader');
        if (l) {
            l.style.display = 'none';
            l.setAttribute('aria-hidden', 'true');
        }
    }
    // show loader immediately; we'll hide it when auth state resolves
    showLoader();
    // fallback: ensure loader doesn't hang forever
    const _loaderFallback = setTimeout(() => { hideLoader(); }, 5000);

    // If user already authenticated, check their Firestore profile and send them appropriately
    auth.onAuthStateChanged(user => {
        // auth state resolved; cancel fallback
        clearTimeout(_loaderFallback);
        if (user) {
            // check Firestore user doc to ensure verified flag
            db.collection('users').doc(user.uid).get().then(doc => {
                const profile = doc.exists ? doc.data() : null;
                const verified = profile && profile.verified;
                // store basic user info locally for UI
                try { localStorage.setItem('currentUser', JSON.stringify({ uid: user.uid, email: user.email, fullName: user.displayName || '', verified: !!verified })); } catch (e) {}

                if (!verified) {
                    // Not verified: sign out and show waiting modal on the login page
                    auth.signOut().then(() => {
                        hideLoader();
                        if (window.location.pathname.endsWith('/platform/') || window.location.pathname.endsWith('/platform/index.html') || window.location.pathname.endsWith('/index.html')) {
                            showWaitingApprovalModule({ firstName: profile ? (profile.firstName || '') : '', email: user.email });
                        } else {
                            // on other pages redirect to login
                            window.location.href = 'index.html';
                        }
                    });
                    return;
                }

                // If this is the login page, redirect logged-in & verified users
                if (window.location.pathname.endsWith('/platform/') || window.location.pathname.endsWith('/platform/index.html') || window.location.pathname.endsWith('/index.html')) {
                    // allow loader to remain while redirecting
                    window.location.href = 'dashboard.html';
                } else {
                    hideLoader();
                }
            }).catch(err => {
                console.error('Error fetching user profile on auth state change', err);
                hideLoader();
            });
        } else {
            // no user - hide loader to reveal login form
            hideLoader();
        }
    });

    // Toggle signup UI
    if (signupLink && signupForm) {
        signupLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (loginForm) loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            if (loginBox) loginBox.classList.add('signup-active');
        });
    }
    if (backToLogin && loginForm && signupForm) {
        backToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            signupForm.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
            if (loginBox) loginBox.classList.remove('signup-active');
        });
    }

    // Login handler using Firebase Auth
    // helper to toggle button loading state and add inline spinner
    function setButtonLoading(btn) {
        if (!btn) return function() {};
        // If already disabled, return a noop restore
        if (btn.disabled) return function() {};
        btn.disabled = true;
        btn.classList.add('disabled');
        const spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        // insert spinner at the start so it appears before the button text
        btn.insertBefore(spinner, btn.firstChild);
        return function restore() {
            btn.disabled = false;
            btn.classList.remove('disabled');
            if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
        };
    }

    if (loginForm) {
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const rememberCheckbox = document.getElementById('rememberMe');

        // Restore saved remember-me preference (persists checkbox state only)
        try {
            const saved = localStorage.getItem('rememberMe');
            if (saved !== null && rememberCheckbox) {
                rememberCheckbox.checked = saved === 'true';
            }
        } catch (e) { /* ignore storage errors */ }

        if (rememberCheckbox) {
            rememberCheckbox.addEventListener('change', function (e) {
                try { localStorage.setItem('rememberMe', !!e.target.checked); } catch (err) {}
            });
        }

        // Do not trigger loading spinner on keydown (Enter) — show spinner only when submit begins
        // This avoids premature spinner display and keeps perceived login time minimal.

        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }

            const restoreUI = setButtonLoading(submitBtn);

            const persistence = rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
            auth.setPersistence(persistence).then(() => {
                return auth.signInWithEmailAndPassword(email, password);
            }).then(cred => {
                // after sign-in, check user's Firestore profile for verified flag
                return db.collection('users').doc(cred.user.uid).get();
            }).then(doc => {
                const profile = doc.exists ? doc.data() : null;
                const verified = profile && profile.verified;
                if (!verified) {
                    // not verified: sign out and show waiting module
                    auth.signOut().then(() => {
                        showWaitingApprovalModule({ firstName: profile ? (profile.firstName || '') : '', email });
                    });
                    return;
                }
                // verified -> proceed
                window.location.href = 'dashboard.html';
            }).catch(err => {
                console.error(err);
                alert('Invalid credentials. Please try again');
            }).finally(() => {
                // restore button state regardless of outcome
                try { restoreUI(); } catch (e) {}
            });
        });
    }

    // Signup handler using Firebase Auth + Firestore
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const telephone = document.getElementById('telephone').value.trim();
            const dob = document.getElementById('dob').value;

            function formatDOBToDDMMYYYY(input) {
                if (!input) return '';
                // If already in dd/mm/yyyy, return as-is
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return input;
                // If in YYYY-MM-DD (common for input[type=date])
                if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                    const parts = input.split('-'); // [YYYY,MM,DD]
                    return parts[2] + '/' + parts[1] + '/' + parts[0];
                }
                // Try Date parse
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
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!firstName || !lastName || !email || !telephone || !dob || !password || !confirmPassword) {
                alert('Please fill in all fields');
                return;
            }

            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                alert('Please enter a valid email address');
                return;
            }

            if (password.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            // Create user in Firebase Auth
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCred => {
                    const user = userCred.user;
                    // Save profile to Firestore under collection 'users' using UID
                    // Also record a human-readable EAT (East Africa Time) registration timestamp
                    const registeredAtEAT = new Intl.DateTimeFormat('en-GB', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                        hour12: false,
                        timeZone: 'Africa/Nairobi'
                    }).format(new Date());

                    const formattedDob = formatDOBToDDMMYYYY(dob);
                    return db.collection('users').doc(user.uid).set({
                        uid: user.uid,
                        firstName,
                        lastName,
                        fullName: firstName + ' ' + lastName,
                        email,
                        telephone,
                        dob: formattedDob,
                        progress: 0,
                        verified: false,
                        status: 'waiting',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        registeredAtEAT: registeredAtEAT
                    }).then(() => user);
                })
                .then(user => {
                    // Optionally set displayName
                    if (user && user.updateProfile) {
                        return user.updateProfile({ displayName: firstName + ' ' + lastName });
                    }
                })
                .then(() => {
                    // after successful signup, store user info locally and redirect to dashboard (but will be blocked by verified check)
                    const u = auth.currentUser;
                    try { localStorage.setItem('currentUser', JSON.stringify({ uid: u.uid, email: u.email, fullName: u.displayName || (firstName + ' ' + lastName), verified: false })); } catch (e) {}
                    // show payment/enrolment message instead of redirecting directly
                    showPaymentModule({ firstName: firstName, email });
                })
                .catch(err => {
                    console.error(err);
                    alert(err.message || 'Sign up failed');
                });
        });
    }

    // Simple waiting/payment overlay for platform pages
    function removeExistingModule() {
        const existing = document.getElementById('enrolmentModuleOverlay');
        if (existing) existing.remove();
    }
    function showPaymentModule(user) {
        removeExistingModule();
        const contact = window.ENROLMENT_CONTACT || { name: 'Andrew Kizito', phone: 'PHONE_NUMBER', email: 'EMAIL_ADDRESS', details: '' };
        const div = document.createElement('div');
        div.id = 'enrolmentModuleOverlay';
        div.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:20000;padding:20px;';
        div.innerHTML = `
            <div style="background:white;padding:22px;border-radius:12px;max-width:720px;width:100%;box-shadow:0 12px 40px rgba(2,8,23,0.35);position:relative;">
                <button id="enrolCloseBtn" aria-label="Close" style="position:absolute;right:12px;top:12px;border:0;background:transparent;font-size:18px;color:#616161;cursor:pointer"><i class="fas fa-times"></i></button>
                <h3 style="margin-top:0">Complete Enrolment</h3>
                <p>To complete enrolment for the course, you need to pay the enrolment fee to <strong>${contact.name}</strong>.</p>
                <p><strong>Phone:</strong> ${contact.phone} <br><strong>Email:</strong> ${contact.email}</p>
                <p>${contact.details}</p>
                <div style="margin-top:12px;">
                    <button id="learnPaymentBtn" class="btn btn-primary">Learn more</button>
                    <button id="enrolCloseAction" class="btn btn-secondary">Close</button>
                </div>
                <div id="paymentDetails" style="display:none;margin-top:12px;padding:12px;border-radius:8px;background:#f8fafc;border:1px solid var(--border-color);">
                    <h4>Payment Details</h4>
                    <p>Please follow the payment instructions provided by ${contact.name}. After payment, message the admin with the transaction details so your account can be verified.</p>
                    <p><strong>Phone:</strong> ${contact.phone}<br><strong>Email:</strong> ${contact.email}</p>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        const closeIconBtn = document.getElementById('enrolCloseBtn');
        const closeActionBtn = document.getElementById('enrolCloseAction');
        const learnBtn = document.getElementById('learnPaymentBtn');
        const paymentDetails = document.getElementById('paymentDetails');

        function handleCloseFlow() {
            const ok = confirm('Have you read and understood the enrolment instructions? Click OK for Yes, Cancel for No.');
            if (ok) {
                removeExistingModule();
                window.location.href = '../index.html';
            } else {
                // show the details section to the user
                if (paymentDetails) paymentDetails.style.display = 'block';
            }
        }

        if (closeIconBtn) closeIconBtn.addEventListener('click', handleCloseFlow);
        if (closeActionBtn) closeActionBtn.addEventListener('click', handleCloseFlow);
        if (learnBtn) learnBtn.addEventListener('click', () => {
            if (paymentDetails) paymentDetails.style.display = (paymentDetails.style.display === 'none' ? 'block' : 'none');
        });
    }
    function showWaitingApprovalModule(user) {
        removeExistingModule();
        const contact = window.ENROLMENT_CONTACT || { name: 'Andrew Kizito', phone: 'PHONE_NUMBER', email: 'EMAIL_ADDRESS', details: '' };
        const div = document.createElement('div');
        div.id = 'enrolmentModuleOverlay';
        div.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:20000;padding:20px;';
        div.innerHTML = `
            <div style="background:white;padding:22px;border-radius:12px;max-width:720px;width:100%;box-shadow:0 12px 40px rgba(2,8,23,0.35);position:relative;">
                <button id="enrolCloseBtn" aria-label="Close" style="position:absolute;right:12px;top:12px;border:0;background:transparent;font-size:18px;color:#616161;cursor:pointer"><i class="fas fa-times"></i></button>
                <h3 style="margin-top:0">Waiting for Admin Approval</h3>
                <p>Your account is awaiting admin approval to complete enrolment and login.</p>
                <div style="margin-top:12px;">
                    <button id="learnMoreBtn" class="btn btn-primary">Learn more</button>
                    <button id="enrolCloseAction" class="btn btn-secondary">Close</button>
                </div>
                <div id="learnMoreDetails" style="display:none;margin-top:12px;padding:12px;border-radius:8px;background:#f8fafc;border:1px solid var(--border-color);">
                    <h4>Enrolment Fee Details</h4>
                    <p>Please pay the enrolment fee to <strong>${contact.name}</strong> using the contact details below. After payment, the admin will mark your account as verified.</p>
                    <p><strong>Phone:</strong> ${contact.phone}<br><strong>Email:</strong> ${contact.email}</p>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        const closeIconBtn = document.getElementById('enrolCloseBtn');
        const closeActionBtn = document.getElementById('enrolCloseAction');
        const learnBtn = document.getElementById('learnMoreBtn');
        const details = document.getElementById('learnMoreDetails');

        function handleCloseFlowWaiting() {
            const ok = confirm('Have you read and understood the enrolment instructions? Click OK for Yes, Cancel for No.');
            if (ok) {
                removeExistingModule();
                window.location.href = '../index.html';
            } else {
                if (details) details.style.display = 'block';
            }
        }

        if (closeIconBtn) closeIconBtn.addEventListener('click', handleCloseFlowWaiting);
        if (closeActionBtn) closeActionBtn.addEventListener('click', handleCloseFlowWaiting);
        if (learnBtn) learnBtn.addEventListener('click', () => {
            if (details) details.style.display = details.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Forgot password modal + flow using Firebase Auth
    function removeForgotPasswordModal() {
        const existing = document.getElementById('forgotPasswordOverlay');
        if (existing) existing.remove();
    }
    function showForgotPasswordModal(prefillEmail) {
        removeForgotPasswordModal();
        const div = document.createElement('div');
        div.id = 'forgotPasswordOverlay';
        div.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);z-index:20000;padding:20px;';
        div.innerHTML = `
            <div style="background:white;padding:18px;border-radius:12px;max-width:520px;width:100%;box-shadow:0 12px 40px rgba(2,8,23,0.35);position:relative;">
                <button id="forgotCloseBtn" aria-label="Close" style="position:absolute;right:12px;top:12px;border:0;background:transparent;font-size:18px;color:#616161;cursor:pointer">&times;</button>
                <h3 style="margin-top:0">Reset Password</h3>
                <p>Enter the email address associated with your account and we'll send instructions to reset your password.</p>
                <input id="forgotEmailInput" type="email" placeholder="Your email address" value="${prefillEmail || ''}" style="width:100%;padding:10px;margin-top:8px;border:1px solid var(--gray);border-radius:8px" />
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                    <button id="forgotSendBtn" class="btn btn-primary">Send</button>
                    <button id="forgotCancelBtn" class="btn btn-secondary">Cancel</button>
                </div>
                <div id="forgotMessage" style="margin-top:12px;color:var(--red);display:none;"></div>
            </div>
        `;
        document.body.appendChild(div);

        const closeBtn = document.getElementById('forgotCloseBtn');
        const cancelBtn = document.getElementById('forgotCancelBtn');
        const sendBtn = document.getElementById('forgotSendBtn');
        const emailInput = document.getElementById('forgotEmailInput');
        const msg = document.getElementById('forgotMessage');

        function closeFlow() { removeForgotPasswordModal(); }
        if (closeBtn) closeBtn.addEventListener('click', closeFlow);
        if (cancelBtn) cancelBtn.addEventListener('click', closeFlow);

        if (sendBtn) sendBtn.addEventListener('click', function () {
            const email = (emailInput && emailInput.value || '').trim();
            msg.style.display = 'none';
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                msg.textContent = 'Please enter a valid email address.';
                msg.style.display = 'block';
                return;
            }
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            auth.sendPasswordResetEmail(email).then(() => {
                // replace modal content with instructions
                const container = document.getElementById('forgotPasswordOverlay');
                if (!container) return;
                container.innerHTML = `
                    <div style="background:white;padding:18px;border-radius:12px;max-width:520px;width:100%;box-shadow:0 12px 40px rgba(2,8,23,0.35);position:relative;">
                        <h3 style="margin-top:0">Password Reset Sent</h3>
                        <p>An email with a link you can use to reset your password has been sent to <strong>${email}</strong>. Please check your <strong>inbox or spam</strong> folders.</p>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                            <button id="forgotOkBtn" class="btn btn-primary">OK</button>
                        </div>
                    </div>
                `;
                const okBtn = document.getElementById('forgotOkBtn');
                if (okBtn) okBtn.addEventListener('click', function () {
                    const confirmed = confirm('Are you sure you have read and understood the above instructions?');
                    if (confirmed) removeForgotPasswordModal();
                });
            }).catch(err => {
                console.error('Password reset error', err);
                msg.textContent = err && err.message ? err.message : 'Failed to send reset email. Try again later.';
                msg.style.display = 'block';
            }).finally(() => {
                if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
            });
        });
    }

    // wire the forgot-password links
    document.querySelectorAll('.forgot-password').forEach(el => {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const prefill = (document.getElementById('email') && document.getElementById('email').value) || '';
            showForgotPasswordModal(prefill.trim());
        });
    });

    // Password visibility toggle buttons (for login and signup forms)
    (function initPasswordToggles() {
        const toggles = document.querySelectorAll('.toggle-password');
        toggles.forEach(btn => {
            btn.addEventListener('click', function () {
                const targetId = this.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;
                const icon = this.querySelector('i');
                if (input.type === 'password') {
                    input.type = 'text';
                    if (icon) {
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    }
                    this.setAttribute('aria-label', 'Hide password');
                } else {
                    input.type = 'password';
                    if (icon) {
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                    this.setAttribute('aria-label', 'Show password');
                }
            });
        });
    })();
});
