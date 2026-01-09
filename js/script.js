
document.addEventListener('DOMContentLoaded', function () {

    // (Google Translate UI removed — translator element no longer used)

    // ===================================
    // NAVBAR HIDE-ON-SCROLL (restore behavior)
    // ===================================
    (function enableNavbarHideOnScroll() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        let lastScroll = window.pageYOffset || document.documentElement.scrollTop;
        const hideThreshold = 10; // pixels of delta before toggling
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

                // If at top, always show
                if (currentScroll <= 0) {
                    navbar.classList.remove('nav-hidden');
                    lastScroll = 0;
                    ticking = false;
                    return;
                }

                // Scrolling down -> hide
                if (currentScroll > lastScroll + hideThreshold) {
                    navbar.classList.add('nav-hidden');
                }

                // Scrolling up -> show
                if (currentScroll < lastScroll - hideThreshold) {
                    navbar.classList.remove('nav-hidden');
                }

                lastScroll = currentScroll;
                ticking = false;
            });
        }, { passive: true });
    })();

    // (Removed duplicate older translation + overlay helpers - using the improved async versions defined above)

    // No footer language buttons to initialize (translator removed)

    
    console.log('KAKN Sites loaded successfully. Visit count:', JSON.parse(localStorage.getItem('kakn_visits') || '[]').length);
});

// Add mobile nav toggle behavior (keeps script isolated and unobtrusive)
document.addEventListener('DOMContentLoaded', function () {
    (function enableNavToggle() {
        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');
        if (!toggle || !menu) return;

        // Initialize aria-expanded for accessibility
        toggle.setAttribute('aria-expanded', menu.classList.contains('active') ? 'true' : 'false');

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            menu.classList.toggle('active');
            toggle.classList.toggle('open');
            const expanded = menu.classList.contains('active');
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });

        // Close menu when a link inside it is clicked (mobile UX)
        menu.addEventListener('click', function (e) {
            const target = e.target;
            if (target && target.tagName === 'A' && menu.classList.contains('active')) {
                menu.classList.remove('active');
                toggle.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && menu.classList.contains('active')) {
                menu.classList.remove('active');
                toggle.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Optional: clicking outside closes the menu
        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target) && !toggle.contains(e.target) && menu.classList.contains('active')) {
                menu.classList.remove('active');
                toggle.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    })();
});

// Blog listing + search (public)
document.addEventListener('DOMContentLoaded', function () {
    // If a dedicated blog loader is active (Firestore-aware), don't render here.
    if (window.blogLoaderActive) return;
    const searchInput = document.getElementById('blogSearch');
    const searchBtn = document.getElementById('blogSearchBtn');
    const blogList = document.getElementById('blogList');
    const blogCarousel = document.getElementById('blogCarousel');

    function getBlogs() {
        return JSON.parse(localStorage.getItem('blogs') || '[]');
    }

    function renderBlogs(blogs) {
        if (!blogList) return;
        if (!blogs || blogs.length === 0) {
            blogList.innerHTML = '<p class="no-data">No blog posts yet.</p>';
            if (blogCarousel) blogCarousel.innerHTML = '';
            return;
        }

        blogList.innerHTML = blogs.map(b => `
            <article class="post-card" style="background:white;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.05);overflow:hidden;">
                <div style="height:180px;overflow:hidden;">
                    <img src="${b.thumbnail || 'attached_assets/stock_images/digital_learning_edu_ae60e2a0.jpg'}" alt="${escapeHtml(b.title)}" style="width:100%;height:100%;object-fit:cover;display:block;">
                </div>
                <div style="padding:18px;">
                    <h3 style="margin-bottom:8px;color:var(--primary-blue);">${escapeHtml(b.title)}</h3>
                    <small style="color:var(--text-light);display:block;margin-bottom:12px;">${new Date(b.date).toLocaleDateString()}</small>
                    <p style="color:var(--text-light);">${escapeHtml(b.excerpt || '').substring(0,200)}${(b.excerpt||'').length>200? '...' : ''}</p>
                </div>
            </article>
        `).join('');

        if (blogCarousel) {
            blogCarousel.innerHTML = blogs.map(b => `
                <div style="min-width:220px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,0.06);">
                    <img src="${b.thumbnail || 'attached_assets/stock_images/digital_learning_edu_ae60e2a0.jpg'}" alt="${escapeHtml(b.title)}" style="width:100%;height:120px;object-fit:cover;display:block;">
                    <div style="padding:10px;"><strong>${escapeHtml(b.title)}</strong><div style="font-size:0.85rem;color:var(--text-light);">${new Date(b.date).toLocaleDateString()}</div></div>
                </div>
            `).join('');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, function (s) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s];
        });
    }

    function doSearch() {
        const q = (searchInput && searchInput.value || '').trim().toLowerCase();
        const blogs = getBlogs();
        if (!q) {
            renderBlogs(blogs.reverse());
            return;
        }
        const filtered = blogs.filter(b => (b.title || '').toLowerCase().includes(q));
        renderBlogs(filtered.reverse());
    }

    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (searchInput) searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

    // On pages with blogList, render stored blogs
    if (blogList) {
        const blogs = getBlogs();
        renderBlogs(blogs.reverse());
    }
});
