document.addEventListener('DOMContentLoaded', function() {
    const videoCards = document.querySelectorAll('.video-card');

    videoCards.forEach(card => {
        card.addEventListener('click', function() {
            const videoTitle = this.querySelector('h4').textContent;
            alert(`Opening video: "${videoTitle}"\n\nIn a real implementation, this would open the video player with the selected tutorial.`);
        });
    });
});
