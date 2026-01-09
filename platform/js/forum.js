document.addEventListener('DOMContentLoaded', function() {
    const discussionItems = document.querySelectorAll('.discussion-item');

    discussionItems.forEach(item => {
        item.addEventListener('click', function() {
            const title = this.querySelector('h4').textContent;
            alert(`Opening discussion: "${title}"\n\nIn a real implementation, this would open the full discussion thread.`);
        });
    });
});
