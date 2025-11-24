document.addEventListener('DOMContentLoaded', function() {
    const filterTabs = document.querySelectorAll('.tab-btn');
    const assignmentCards = document.querySelectorAll('.assignment-card');

    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const filter = this.getAttribute('data-filter');
            
            assignmentCards.forEach(card => {
                const status = card.getAttribute('data-status');
                if (filter === 'all' || status === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    const submitButtons = document.querySelectorAll('.assignment-card .btn-primary');
    submitButtons.forEach(button => {
        button.addEventListener('click', function() {
            alert('Assignment submission functionality will be implemented in the next phase.');
        });
    });

    const viewButtons = document.querySelectorAll('.assignment-card .btn-outline');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            alert('View submission/feedback functionality will be implemented in the next phase.');
        });
    });
});
