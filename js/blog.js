// blog.js — loads blogs from Firestore (if available) or localStorage and renders them

// Indicate to other scripts that the blog loader is active (prevents duplicate rendering)
window.blogLoaderActive = true;

async function fetchBlogs() {
    // Try Firestore first
    if (window.firebase && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const snap = await db.collection('blogs').get();
            const docs = snap.docs.map(d => ({ ...(d.data() || {}), _docId: d.id }));
            return docs;
        } catch (err) {
            console.error('Error fetching blogs from Firestore:', err);
        }
    }
    // Fallback to localStorage
    try {
        return JSON.parse(localStorage.getItem('blogs') || '[]');
    } catch (e) {
        return [];
    }
}

function renderPostCard(b, showRead = true) {
    const thumb = b.thumbnail || 'attached_assets/stock_images/digital_learning_edu_ae60e2a0.jpg';
    const url = `#`; // could link to blog detail if implemented
    return `
        <article class="post-card" data-id="${escapeHtml(b.id || b._docId || '')}" style="cursor:pointer;">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(b.title)}">
            <div class="post-body">
                <h3 style="margin:0 0 8px 0">${escapeHtml(b.title)}</h3>
                <small style="color:var(--text-light)">${new Date(b.date).toLocaleDateString()}</small>
                <p style="color:var(--text-light);margin-top:8px">${b.excerpt || ''}</p>
                ${showRead ? '<a href="#" class="btn btn-primary" style="margin-top:8px;display:inline-block">Read</a>' : ''}
            </div>
        </article>
    `;
}

function renderCarouselItem(b) {
    const thumb = b.thumbnail || 'attached_assets/stock_images/digital_learning_edu_ae60e2a0.jpg';
    return `
        <div style="min-width:220px;max-width:220px">
            <div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(2,8,23,0.06);">
                <img src="${escapeHtml(thumb)}" alt="${escapeHtml(b.title)}" style="width:100%;height:120px;object-fit:cover;display:block">
                <div style="padding:10px">
                    <h4 style="margin:0 0 6px 0;font-size:0.95rem">${escapeHtml(b.title)}</h4>
                    <small style="color:var(--text-light)">${new Date(b.date).toLocaleDateString()}</small>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadAndRenderBlogs(query = '') {
    const listEl = document.getElementById('blogList');
    const latestEl = document.getElementById('latestGrid');
    if (!listEl || !latestEl) return;
    // show spinner while fetching (use section-spinner container for consistent centering)
    const spinnerHtml = '<div class="section-spinner"><div class="spinner" role="status" aria-label="Loading"></div></div>';
    const spinnerSmall = '<div class="section-spinner section-spinner--small"><div class="spinner" style="width:32px;height:32px;border-width:4px;" role="status" aria-label="Loading"></div></div>';
    latestEl.innerHTML = spinnerHtml;
    listEl.innerHTML = spinnerSmall;
    const posts = await fetchBlogs();
    if (!posts || posts.length === 0) {
        latestEl.innerHTML = '<p class="no-data">No posts yet.</p>';
        listEl.innerHTML = '';
        return;
    }

    // filter by query (title)
    const q = (query || '').trim().toLowerCase();
    let filtered = posts;
    if (q) filtered = posts.filter(p => (p.title || '').toString().toLowerCase().includes(q));

    // sort by date desc
    filtered.sort((a,b) => new Date(b.date) - new Date(a.date));

    // If a search query is present, hide section headers and show matched posts
    const latestSection = latestEl.closest('section');
    const listSection = listEl.closest('section');
    if (q) {
        if (latestSection) {
            const sh = latestSection.querySelector('.section-header'); if (sh) sh.style.display = 'none';
            latestSection.style.display = 'none';
        }
        if (listSection) {
            const sh = listSection.querySelector('.section-header'); if (sh) sh.style.display = 'none';
            listSection.style.display = '';
        }
        // Render all filtered results into the main posts grid using the 4-across layout
        listEl.innerHTML = filtered.map(b => renderPostCard(b, false)).join('');
    } else {
        // restore default layout and headers
        if (latestSection) {
            const sh = latestSection.querySelector('.section-header'); if (sh) sh.style.display = '';
            latestSection.style.display = '';
        }
        if (listSection) {
            const sh = listSection.querySelector('.section-header'); if (sh) sh.style.display = '';
            listSection.style.display = '';
        }
        const latest = filtered.slice(0,4);
        latestEl.innerHTML = latest.map(b => renderPostCard(b, true)).join('');
        listEl.innerHTML = filtered.map(b => renderPostCard(b, false)).join('');
    }

    // Wire a single delegated click handler (add once) to open post modals when a card is clicked
    if (!window._blogCardDelegated) {
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.post-card');
            if (card) {
                const id = card.getAttribute('data-id');
                if (id) openPostModal(id);
            }
        });
        window._blogCardDelegated = true;
    }

    // If page was opened with a deep link (#post=...), open that post
    if (window._blogPendingOpen) {
        const pid = window._blogPendingOpen;
        window._blogPendingOpen = null;
        // open after small delay to ensure UI ready
        setTimeout(() => openPostModal(pid), 150);
    }
}

// Wire search
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('blogSearch');
    const searchBtn = document.getElementById('blogSearchBtn');
    // Check deep-link (hash or query param)
    const url = new URL(window.location.href);
    const hash = window.location.hash || '';
    let pending = null;
    if (hash.startsWith('#post=')) pending = decodeURIComponent(hash.replace('#post=',''));
    else if (url.searchParams.get('post')) pending = url.searchParams.get('post');
    if (pending) window._blogPendingOpen = pending;
    loadAndRenderBlogs();
    if (searchBtn && searchInput) {
        const latestEl = document.getElementById('latestGrid');
        const listEl = document.getElementById('blogList');
        const spinnerHtml = '<div class="section-spinner"><div class="spinner" role="status" aria-label="Loading"></div></div>';
        const spinnerSmall = '<div class="section-spinner section-spinner--small"><div class="spinner" style="width:32px;height:32px;border-width:4px;" role="status" aria-label="Loading"></div></div>';

        const prepareAndSearch = () => {
            const latestSection = latestEl ? latestEl.closest('section') : null;
            const listSection = listEl ? listEl.closest('section') : null;
            if (latestSection) {
                const sh = latestSection.querySelector('.section-header'); if (sh) sh.style.display = 'none';
                latestSection.style.display = 'none';
            }
            if (listSection) {
                const sh = listSection.querySelector('.section-header'); if (sh) sh.style.display = 'none';
                listSection.style.display = '';
            }
            if (latestEl) latestEl.innerHTML = spinnerHtml;
            if (listEl) listEl.innerHTML = spinnerSmall;
            loadAndRenderBlogs(searchInput.value || '');
        };

        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            prepareAndSearch();
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                prepareAndSearch();
            }
        });
    }
});

// Modal helpers
// prevent background scroll while modal is open
function disableBodyScroll() {
    try {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        document.body.setAttribute('data-scroll-y', String(scrollY));
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
    } catch (e) {
        // fallback: add a simple overflow hidden class
        document.body.classList.add('no-scroll');
    }
}

function enableBodyScroll() {
    try {
        const y = parseInt(document.body.getAttribute('data-scroll-y') || '0');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.removeAttribute('data-scroll-y');
        window.scrollTo(0, y);
    } catch (e) {
        document.body.classList.remove('no-scroll');
    }
}
function openPostModal(id) {
    // find post from last fetched list (we can fetch from storage)
    fetchBlogs().then(posts => {
        const post = (posts || []).find(p => String(p.id) === String(id) || String(p._docId) === String(id));
        if (!post) {
            alert('Post not found');
            return;
        }
        const modal = document.getElementById('postModal');
        const cover = document.getElementById('postCover');
        const title = document.getElementById('postModalTitle');
        const date = document.getElementById('postModalDate');
        const body = document.getElementById('postModalBody');

        // cover image as background image
        const thumb = post.thumbnail || 'attached_assets/stock_images/digital_learning_edu_ae60e2a0.jpg';
        cover.style.backgroundImage = `url('${escapeHtml(thumb)}')`;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
        cover.style.height = '300px';

        title.textContent = post.title || '';
        date.textContent = post.date ? new Date(post.date).toLocaleDateString() : '';
        // trust admin content (stored as HTML)
        body.innerHTML = post.content || post.excerpt || '';

        modal.style.display = 'flex';

        // disable background scrolling while modal is open
        disableBodyScroll();

        // update URL hash so it can be shared
        try { history.replaceState(null, '', '#post=' + encodeURIComponent(post.id || post._docId || '')); } catch (e) {}

        // wire buttons
        const closeBtn = document.getElementById('postModalClose');
        if (closeBtn) closeBtn.onclick = closePostModal;
        const readMoreBtn = document.getElementById('postModalReadMore');
        if (readMoreBtn) readMoreBtn.onclick = () => { closePostModal(); const all = document.getElementById('blogList'); if (all) all.scrollIntoView({behavior:'smooth'}); };
        const shareBtn = document.getElementById('postModalShare');
        if (shareBtn) shareBtn.onclick = () => sharePostLink(post);
    });
}

function closePostModal() {
    const modal = document.getElementById('postModal');
    if (!modal) return;
    modal.style.display = 'none';
    // re-enable background scrolling when modal closes
    enableBodyScroll();
    // remove hash without reloading
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
}

function sharePostLink(post) {
    const id = post.id || post._docId || '';
    const url = window.location.origin + window.location.pathname + '#post=' + encodeURIComponent(id);
    if (navigator.share) {
        navigator.share({ title: post.title || 'Blog post', url }).catch(err => console.error('Share failed', err));
        return;
    }
    // fallback: copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard'))
            .catch(() => window.prompt('Copy this link', url));
    } else {
        window.prompt('Copy this link', url);
    }
}
