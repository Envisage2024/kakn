document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const certificateName = document.getElementById('certificateName');
    const completionDate = document.getElementById('completionDate');
    const downloadBtn = document.getElementById('downloadCertBtn');
    const shareBtn = document.getElementById('shareCertBtn');
    const shareOptions = document.getElementById('shareOptions');

    if (user && certificateName) {
        certificateName.textContent = user.fullName;
    }

    if (completionDate) {
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        completionDate.textContent = today;
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            alert('Certificate download functionality will be implemented in the next phase.\n\nYour certificate would be downloaded as a PDF file.');
        });
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            if (shareOptions.style.display === 'none' || !shareOptions.style.display) {
                shareOptions.style.display = 'block';
            } else {
                shareOptions.style.display = 'none';
            }
        });
    }

    const shareButtons = document.querySelectorAll('.share-btn');
    shareButtons.forEach(button => {
        button.addEventListener('click', function() {
            const platform = this.textContent.trim();
            alert(`Sharing certificate on ${platform}\n\nIn a real implementation, this would open the share dialog for the selected platform.`);
        });
    });
    // Show issued certificate link if admin has issued one
    const certArea = document.getElementById('certificateLinkContainer');
    if (!certArea) return;

    function renderCertificateLink(cert) {
        const url = cert.accessUrl || cert.certificateUrl || cert.url || '#';
        const issued = cert.issuedAtStr || '';
        certArea.innerHTML = `
            <div style="padding:12px;border-radius:8px;background:#fff;border:1px solid #eee;display:inline-block;text-align:left;max-width:720px">
                <p style="margin:0 0 10px 0;font-size:1.05rem;color:#222">Your certificate of completion has been issued.</p>
                <p style="margin:0 0 8px 0;color:#666">Issued on ${issued}</p>
                <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener noreferrer">Click here to view your certificate</a>
            </div>
        `;
    }

    (function loadStudentCertificate() {
        function handleCurrent(current) {
            if (!current) return;
            (async () => {
                try {
                    if (window.firebase && firebase.firestore) {
                        let found = null;
                        // Try match by auth UID first
                        if (current.uid) {
                            try {
                                const snap = await firebase.firestore().collection('certificates').where('userId','==', current.uid).orderBy('issuedAt','desc').limit(1).get();
                                if (!snap.empty) found = snap.docs[0].data();
                            } catch (e) { console.warn('UID query failed', e); }
                        }

                        // Then try by email
                        if (!found && current.email) {
                            try {
                                const snap2 = await firebase.firestore().collection('certificates').where('userEmail','==', current.email).orderBy('issuedAt','desc').limit(1).get();
                                if (!snap2.empty) found = snap2.docs[0].data();
                            } catch (e) { console.warn('Email query failed', e); }
                        }

                        // As a last resort, fetch recent certificates and match client-side
                        if (!found) {
                            try {
                                const recent = await firebase.firestore().collection('certificates').orderBy('issuedAt','desc').limit(50).get();
                                for (const doc of recent.docs) {
                                    const d = doc.data();
                                    if ((current.uid && d.userId === current.uid) || (current.email && d.userEmail === current.email)) { found = d; break; }
                                }
                            } catch (e) { console.warn('Recent fetch failed', e); }
                        }

                        if (found) {
                            const issuedAtStr = found.issuedAt && found.issuedAt.toDate ? found.issuedAt.toDate().toLocaleDateString() : (found.issuedAt || '');
                            renderCertificateLink({ accessUrl: found.accessUrl || '#', issuedAtStr });
                            return;
                        }
                    }

                    // Fallback to localStorage
                    try {
                        const certs = JSON.parse(localStorage.getItem('certificates') || '[]');
                        const match = certs.find(c => c.userId === (current.uid || current.id) || (current.email && c.userEmail === current.email));
                        if (match) {
                            renderCertificateLink({ accessUrl: match.accessUrl || '#', issuedAtStr: new Date(match.issuedAt || Date.now()).toLocaleDateString() });
                        }
                    } catch (e) {
                        console.warn('LocalStorage certificate check failed', e);
                    }
                } catch (err) { console.error('Failed to load student certificate', err); }
            })();
        }

        // Use Firebase Auth state if available, otherwise localStorage
        if (window.firebase && firebase.auth) {
            firebase.auth().onAuthStateChanged(user => {
                if (user) handleCurrent(user);
                else {
                    try { const stored = JSON.parse(localStorage.getItem('currentUser') || 'null'); handleCurrent(stored); } catch(e) {}
                }
            });
        } else {
            try { const stored = JSON.parse(localStorage.getItem('currentUser') || 'null'); handleCurrent(stored); } catch(e) {}
        }
    })();
});
