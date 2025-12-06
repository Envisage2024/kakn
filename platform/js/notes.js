document.addEventListener('DOMContentLoaded', function() {
    const viewButtons = document.querySelectorAll('.note-card .btn-outline');
    const downloadButtons = document.querySelectorAll('.note-card .btn-primary');

    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const noteTitle = this.closest('.note-card').querySelector('h4').textContent;
            alert(`Viewing: "${noteTitle}"\n\nIn a real implementation, this would open the PDF viewer.`);
        });
    });

    downloadButtons.forEach(button => {
        button.addEventListener('click', function() {
            const noteTitle = this.closest('.note-card').querySelector('h4').textContent;
            alert(`Downloading: "${noteTitle}"\n\nIn a real implementation, this would download the PDF file.`);
        });
    });
});
