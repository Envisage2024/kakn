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
});
