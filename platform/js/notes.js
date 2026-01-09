document.addEventListener('DOMContentLoaded', function() {
    const listEl = document.getElementById('notesList');
    const searchEl = document.getElementById('notesSearchInput');
    const noMsgEl = document.getElementById('noNotesMessage');
    const spinnerEl = document.getElementById('notesSpinner');
    function showSpinner(){ if (spinnerEl){ spinnerEl.style.display = 'block'; spinnerEl.classList.add('centered-in-content'); } if (listEl) listEl.style.visibility = 'hidden'; }
    function hideSpinner(){ if (spinnerEl){ spinnerEl.style.display = 'none'; spinnerEl.classList.remove('centered-in-content'); } if (listEl) listEl.style.visibility = 'visible'; }
    function showNoNotes(text, mode){
        if (noMsgEl) {
            noMsgEl.textContent = text;
            noMsgEl.classList.remove('fixed-center','below-search');
            if (mode === 'page') noMsgEl.classList.add('fixed-center');
            else if (mode === 'search') noMsgEl.classList.add('below-search');
            noMsgEl.style.display = 'block';
        }
        if (listEl) listEl.innerHTML = '';
    }
    function hideNoNotes(){ if (noMsgEl) noMsgEl.style.display = 'none'; }

    async function loadNotes() {
        if (!listEl) return;
        // show centered spinner and hide placeholders while we fetch
        if (noMsgEl) noMsgEl.style.display = 'none';
        listEl.innerHTML = '';
        showSpinner();

        // Try Firestore SDK
        let docs = null;
        if (window.firebase && firebase.firestore) {
            try {
                const db = firebase.firestore();
                const snap = await db.collection('notes').orderBy('createdAt','desc').get();
                docs = snap.docs.map(d => {
                    const data = d.data();
                    const created = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || null);
                    return { id: d.id, title: data.title || '', module: data.module || '', url: data.url || '', uploadDate: created };
                });
            } catch (e) { console.debug('Firestore SDK fetch failed', e); docs = null; }
        }

        // REST fallback
        if (!docs) {
            try {
                const project = 'kakn-sites-7c4e9';
                const listUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/notes`;
                const res = await fetch(listUrl);
                if (res.ok) {
                    const json = await res.json();
                    const documents = (json.documents||[]).map(docItem => {
                        const f = docItem.fields || {};
                        const id = docItem.name ? docItem.name.split('/').pop() : null;
                        const created = f.createdAt && (f.createdAt.timestampValue || f.createdAt.stringValue) ? (f.createdAt.timestampValue || f.createdAt.stringValue) : null;
                        return { id, title: f.title && f.title.stringValue ? f.title.stringValue : '', module: f.module && f.module.stringValue ? f.module.stringValue : '', url: f.url && f.url.stringValue ? f.url.stringValue : '', uploadDate: created };
                    });
                    docs = documents.sort((a,b)=>{ const da = a.uploadDate?new Date(a.uploadDate):0; const db = b.uploadDate?new Date(b.uploadDate):0; return db - da; });
                }
            } catch (e) { console.debug('Firestore REST fetch failed', e); }
        }

        // LocalStorage fallback
        if (!docs || docs.length === 0) {
            const notes = JSON.parse(localStorage.getItem('courseNotes') || '[]');
            if (!notes || notes.length === 0) {
                // Show centered page-level empty state
                showNoNotes('No notes available yet. Please try again later.', 'page');
                window.__notesCache = [];
                return;
            }
            docs = notes.map(n => ({ id: n.id, title: n.title||'', module: n.module||'', url: n.url||'', uploadDate: n.uploadDate||'' })).sort((a,b)=> (new Date(b.uploadDate||0) - new Date(a.uploadDate||0)));
        }

        window.__notesCache = docs.slice();
        renderList(window.__notesCache);
        hideSpinner();
    }

    function renderList(items) {
        const q = (searchEl && searchEl.value) ? (searchEl.value || '').toString().trim() : '';
        if (!items || items.length === 0) {
            hideSpinner();
            if (q) showNoNotes('No notes found', 'search');
            else showNoNotes('No notes available yet. Please try again later.', 'page');
            return;
        }
        hideNoNotes();
        hideSpinner();
        listEl.innerHTML = items.map(item => {
            const dateText = item.uploadDate ? new Date(item.uploadDate).toLocaleDateString() : '';
                return `
                        <div class="note-card">
                        <div class="note-icon"><i class="fas fa-file-pdf"></i></div>
                        <div class="note-info">
                            <h4>${escapeHtml(item.title)}</h4>
                            <p class="note-description">Module ${escapeHtml(item.module)}</p>
                            <div class="note-meta">
                                <span><i class="fas fa-calendar"></i> ${escapeHtml(dateText)}</span>
                            </div>
                        </div>
                        <div class="note-actions">
                            <button class="btn-outline btn-sm" data-url="${escapeHtml(item.url)}"><i class="fas fa-eye"></i> View</button>
                            <button class="btn-primary btn-sm" data-url="${escapeHtml(item.url)}" data-title="${escapeHtml(item.title)}"><i class="fas fa-download"></i> Download</button>
                        </div>
                    </div>
                `;
        }).join('');

        // wire actions
        listEl.querySelectorAll('.note-actions .btn-outline').forEach(b => b.addEventListener('click', (e)=>{
            const url = e.currentTarget.dataset.url; if (!url) return alert('No URL for this note'); window.open(url, '_blank');
            try { const title = e.currentTarget.dataset.title || ''; if (window.logActivity) window.logActivity('pdf_view', title || 'PDF View', { url }); } catch(e) {}
        }));
        listEl.querySelectorAll('.note-actions .btn-primary').forEach(b => b.addEventListener('click', async (e)=>{
            const url = e.currentTarget.dataset.url; const title = e.currentTarget.dataset.title || '';
            if (!url) return alert('No URL for this note');

            // If this is a Google Drive share link, convert to direct download URL and open that.
            const driveId = extractDriveId(url);
            if (driveId) {
                const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
                // open in new tab — Drive will serve a download or an intermediate page for large files
                window.open(downloadUrl, '_blank', 'noopener');
                return;
            }

            // Prepare filename
            const safeTitle = (title ? title.replace(/[^a-z0-9\-_. ]/gi,'').trim().replace(/\s+/g,'_') : '');
            const tryFilename = safeTitle || filenameFromUrl(url) || 'note.pdf';

            // First attempt: fetch the resource and download as blob (works when CORS allows)
            try {
                const res = await fetch(url, { method: 'GET', mode: 'cors' });
                if (!res.ok) throw new Error('Network response not ok');
                const blob = await res.blob();
                const ext = (blob.type && blob.type.split('/')[1]) ? (`.${blob.type.split('/')[1].split('+')[0]}`) : '';
                const filename = (safeTitle ? safeTitle : (filenameFromUrl(url) || ('note' + ext || '.pdf')));
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(()=> URL.revokeObjectURL(blobUrl), 10000);
                return;
            } catch (err) {
                console.debug('Blob fetch/download failed (likely CORS). Attempting anchor download fallback:', err);
            }

            // Fallback: create an anchor with download attribute — may still open in new tab for cross-origin resources in some browsers
            try {
                const a2 = document.createElement('a');
                a2.href = url;
                a2.download = tryFilename;
                a2.target = '_blank';
                a2.rel = 'noopener';
                a2.style.display = 'none';
                document.body.appendChild(a2);
                a2.click();
                a2.remove();
                return;
            } catch (err) {
                console.debug('Anchor download fallback failed:', err);
            }

            // Last resort: inform user and open in new tab
            alert('Unable to download directly due to cross-origin restrictions. The PDF will open in a new tab; if you want direct downloads, host PDFs in the same origin or configure CORS on the storage provider.');
            window.open(url, '_blank');
            try { if (window.logActivity) window.logActivity('pdf_download', title || 'PDF Download', { url }); } catch(e) {}
        }));

        function extractDriveId(u) {
            try {
                const parsed = new URL(u);
                if (!parsed.hostname.includes('drive.google.com')) return null;
                // patterns: /file/d/FILEID/, /d/FILEID/, ?id=FILEID
                const path = parsed.pathname;
                const m = path.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (m && m[1]) return m[1];
                const qs = parsed.searchParams.get('id');
                if (qs) return qs;
                // sometimes url is /uc?id=FILEID
                const uc = path.match(/\/uc/);
                if (uc) {
                    const id2 = parsed.searchParams.get('id');
                    if (id2) return id2;
                }
                return null;
            } catch (e) { return null; }
        }

        function filenameFromUrl(u) {
            try {
                const p = u.split('?')[0];
                const name = decodeURIComponent(p.substring(p.lastIndexOf('/')+1)) || '';
                return name || null;
            } catch(e) { return null; }
        }
    }

    

    function escapeHtml(str){ return (str||'').toString().replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

    if (searchEl) {
        searchEl.addEventListener('input', (e)=>{
            const q = (e.target.value||'').toLowerCase().trim();
            const filtered = (window.__notesCache || []).filter(n => (n.title||'').toLowerCase().includes(q));
            renderList(filtered);
        });
    }

    loadNotes();
});
