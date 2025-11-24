document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const signupLink = document.getElementById('signupLink');

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }

            const user = {
                email: email,
                fullName: 'John Doe',
                isLoggedIn: true,
                loginTime: new Date().toISOString()
            };

            localStorage.setItem('currentUser', JSON.stringify(user));

            if (rememberMe) {
                localStorage.setItem('rememberUser', 'true');
            }

            window.location.href = 'dashboard.html';
        });
    }

    if (signupLink) {
        signupLink.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Sign up functionality will be implemented in the next phase. For now, use any email and password to login.');
        });
    }
});
