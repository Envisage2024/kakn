document.addEventListener('DOMContentLoaded', function() {
    loadDashboardStats();
});

function loadDashboardStats() {
    const stats = JSON.parse(localStorage.getItem('dashboardStats')) || {
        completionPercentage: 75,
        pendingAssignments: 5,
        newVideos: 8,
        newNotes: 12,
        newMessages: 3
    };

    document.getElementById('completionPercentage').textContent = stats.completionPercentage + '%';
    document.getElementById('pendingAssignments').textContent = stats.pendingAssignments;
    document.getElementById('newVideos').textContent = stats.newVideos;
    document.getElementById('newNotes').textContent = stats.newNotes;
    document.getElementById('newMessages').textContent = stats.newMessages;
}
