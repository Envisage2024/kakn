document.addEventListener('DOMContentLoaded', function() {
    const grid = document.getElementById('videosGrid');
    const noMsgEl = document.getElementById('noVideosMessage');
    const spinnerEl = document.getElementById('tutorialsSpinner');
    function showSpinner(){ if (spinnerEl){ spinnerEl.style.display = 'block'; spinnerEl.classList.add('centered-in-content'); } if (grid) grid.style.visibility = 'hidden'; }
    function hideSpinner(){ if (spinnerEl){ spinnerEl.style.display = 'none'; spinnerEl.classList.remove('centered-in-content'); } if (grid) grid.style.visibility = 'visible'; }
    function showNoVideos(text, mode){ if (!noMsgEl) return; noMsgEl.textContent = text; noMsgEl.classList.remove('fixed-center','below-search'); if (mode === 'page') noMsgEl.classList.add('fixed-center'); else if (mode === 'search') noMsgEl.classList.add('below-search'); noMsgEl.style.display = 'block'; if (grid) grid.innerHTML = ''; }
    function hideNoVideos(){ if (noMsgEl) noMsgEl.style.display = 'none'; }

    async function getYouTubeId(url) {
        if (!url) return null;
        // common YouTube URL patterns
        const ytRegex = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
        const m = url.match(ytRegex);
        return m ? m[1] : null;
    }

    async function getVimeoThumbnail(url) {
        try {
            const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
            const r = await fetch(oembed);
            if (!r.ok) return null;
            const j = await r.json();
            return j.thumbnail_url || null;
        } catch (e) {
            return null;
        }
    }

    async function getThumbnailForUrl(url) {
        if (!url) return null;
        // YouTube
        const ytId = await getYouTubeId(url);
        if (ytId) {
            // prefer high-res thumbnail
            return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        }
        // Vimeo
        if (url.includes('vimeo.com')) {
            const vThumb = await getVimeoThumbnail(url);
            if (vThumb) return vThumb;
        }
        // No known provider -> return null to indicate fallback
        return null;
    }

    async function getYouTubeTitle(url) {
        try {
            const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const r = await fetch(oembed);
            if (!r.ok) return null;
            const j = await r.json();
            return j.title || null;
        } catch (e) {
            return null;
        }
    }

    async function getDescriptionForUrl(url) {
        if (!url) return null;
        // Vimeo oEmbed provides description
        try {
            if (url.includes('vimeo.com')) {
                const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
                const r = await fetch(oembed);
                if (r.ok) {
                    const j = await r.json();
                    if (j.description) return j.description;
                }
            }
        } catch (e) {}
        // fallback: try noembed for other providers (may include description)
        try {
            const r2 = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
            if (r2.ok) {
                const j2 = await r2.json();
                if (j2 && j2.description) return j2.description;
            }
        } catch (e) {}
        return null;
    }

    async function getTitleForUrl(url) {
        if (!url) return null;
        // YouTube
        const ytId = await getYouTubeId(url);
        if (ytId) {
            const t = await getYouTubeTitle(url);
            if (t) return t;
        }
        // Vimeo via oEmbed
        if (url.includes('vimeo.com')) {
            try {
                const oembed = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
                const r = await fetch(oembed);
                if (r.ok) {
                    const j = await r.json();
                    if (j.title) return j.title;
                }
            } catch (e) {}
        }
        return null;
    }

    async function renderVideos(docs) {
        if (!grid) return;
        // If docs are already enriched and cached, render directly
        if (!docs || docs.length === 0) {
            // decide whether this is a search or initial page state
            const searchInput = document.getElementById('tutorialsSearch');
            const q = searchInput ? (searchInput.value || '').toString().trim() : '';
            if (q) showNoVideos('No videos found', 'search');
            else showNoVideos('No videos found. Please try again later.', 'page');
            return;
        }

        if (docs && docs.length > 0 && docs[0]._cached) {
            hideNoVideos();
            hideSpinner();
            grid.innerHTML = docs.map(d => {
                const title = d.title || 'Untitled Tutorial';
                const url = d.url || '#';
                const date = d.createdAt ? (new Date(d.createdAt)).toLocaleDateString() : '';
                const thumb = d._thumb || null;
                const thumbAttr = thumb ? `style="background-image:url('${thumb}');background-size:cover;background-position:center;"` : '';
                const desc = d._desc || '';
                const excerpt = desc ? (desc.length > 180 ? (desc.substring(0,177) + '...') : desc) : '';
                return `
                        <div class="video-card" data-url="${url}">
                            <div class="video-thumbnail" ${thumbAttr}>
                                <i class="fas fa-play-circle play-icon"></i>
                            </div>
                            <div class="video-info">
                                <h4>${escapeHtml(title)}</h4>
                                <p class="video-description">${escapeHtml(excerpt)}</p>
                                <div class="video-meta">
                                    <span><i class="fas fa-calendar"></i> ${date}</span>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('');

            const videoCards = document.querySelectorAll('.video-card');
            videoCards.forEach(card => {
                card.addEventListener('click', function() {
                    const videoUrl = this.getAttribute('data-url');
                    if (!videoUrl || videoUrl === '#') return alert('No URL available for this tutorial.');
                    window.open(videoUrl, '_blank');
                });
            });
            return;
        }
        hideNoVideos();
        hideSpinner();

        // resolve thumbnails, missing titles and descriptions in parallel
        const thumbPromises = docs.map(d => getThumbnailForUrl(d.url));
        const titlePromises = docs.map(d => d.title ? Promise.resolve(d.title) : getTitleForUrl(d.url));
        const descPromises = docs.map(d => d.description ? Promise.resolve(d.description) : getDescriptionForUrl(d.url));
        const thumbs = await Promise.all(thumbPromises);
        const fetchedTitles = await Promise.all(titlePromises);
        const fetchedDescs = await Promise.all(descPromises);

        // cache enriched docs for client-side search/filtering
        const enriched = docs.map((d, idx) => ({
            title: (d.title && d.title.trim()) ? d.title : (fetchedTitles[idx] || 'Untitled Tutorial'),
            url: d.url || '#',
            createdAt: d.createdAt || null,
            _thumb: thumbs[idx] || null,
            _desc: (d.description && d.description.trim()) ? d.description : (fetchedDescs[idx] || ''),
            _cached: true
        }));
        window.__videoTutorialsCache = enriched;

        grid.innerHTML = docs.map((d, idx) => {
            const title = (d.title && d.title.trim()) ? d.title : (fetchedTitles[idx] || 'Untitled Tutorial');
            const url = d.url || '#';
            const created = d.createdAt ? new Date(d.createdAt) : null;
            const date = created ? created.toLocaleDateString() : '';
            const thumb = thumbs[idx];
            const thumbAttr = thumb ? `style="background-image:url('${thumb}');background-size:cover;background-position:center;"` : '';
            const desc = (d.description && d.description.trim()) ? d.description : (fetchedDescs[idx] || '');
            const excerpt = desc ? (desc.length > 180 ? (desc.substring(0,177) + '...') : desc) : '';
            return `
                <div class="video-card" data-url="${url}">
                    <div class="video-thumbnail" ${thumbAttr}>
                        <i class="fas fa-play-circle play-icon"></i>
                    </div>
                    <div class="video-info">
                        <h4>${escapeHtml(title)}</h4>
                        <p class="video-description">${escapeHtml(excerpt)}</p>
                        <div class="video-meta">
                            <span><i class="fas fa-calendar"></i> ${date}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // attach click handlers
        const videoCards = document.querySelectorAll('.video-card');
        videoCards.forEach(card => {
            card.addEventListener('click', function() {
                const videoUrl = this.getAttribute('data-url');
                if (!videoUrl || videoUrl === '#') return alert('No URL available for this tutorial.');
                window.open(videoUrl, '_blank');
            });
        });
    }

    function escapeHtml(str) {
        return (str||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
    }

    async function loadFromFirestoreSDK() {
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('videos').orderBy('createdAt','desc').get();
            const docs = snapshot.docs.map(d => {
                const data = d.data();
                return { title: data.title || '', url: data.url || '', description: data.description || '', createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null) };
            });
            await renderVideos(docs);
            return true;
        } catch (err) {
            console.debug('Firestore SDK load failed', err);
            return false;
        }
    }

    async function loadFromREST() {
        try {
            const project = 'kakn-sites-7c4e9';
            const listUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/videos`;
            const res = await fetch(listUrl, { method: 'GET' });
            if (!res.ok) {
                console.debug('Firestore REST list failed', res.status, await res.text());
                return false;
            }
            const json = await res.json();
            const docs = (json.documents || []).map(docItem => {
                const f = docItem.fields || {};
                const title = f.title && f.title.stringValue ? f.title.stringValue : '';
                const url = f.url && f.url.stringValue ? f.url.stringValue : '';
                const description = f.description && f.description.stringValue ? f.description.stringValue : '';
                const createdAt = f.createdAt && f.createdAt.timestampValue ? new Date(f.createdAt.timestampValue) : null;
                return { title, url, description, createdAt };
            });
            await renderVideos(docs);
            return true;
        } catch (err) {
            console.debug('Firestore REST load error', err);
            return false;
        }
    }

    (async function init() {
        // remove placeholder content and show centered spinner while initial load is in progress
        const spinnerInit = document.getElementById('tutorialsSpinner');
        if (grid) { grid.innerHTML = ''; grid.style.visibility = 'hidden'; }
        if (noMsgEl) noMsgEl.style.display = 'none';
        if (spinnerInit) { spinnerInit.style.display = 'block'; spinnerInit.classList.add('fixed-center'); }
        try{
            // Prefer SDK if available
            if (window.firebase && firebase.firestore) {
                const ok = await loadFromFirestoreSDK();
                if (ok) return;
            }
            await loadFromREST();
        } finally {
            // ensure spinner hidden and grid restored if renderVideos did not already do so
            if (spinnerInit) { spinnerInit.style.display = 'none'; spinnerInit.classList.remove('fixed-center'); }
            if (grid) grid.style.visibility = 'visible';
        }
        // wire search box (client-side filtering using cached enriched docs)
        const searchInput = document.getElementById('tutorialsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const q = (e.target.value || '').toLowerCase().trim();
                const cached = window.__videoTutorialsCache || [];
                const filtered = cached.filter(v => (v.title || '').toLowerCase().includes(q));
                // render filtered using cached structure
                renderVideos(filtered);
            });
        }
    })();

});
