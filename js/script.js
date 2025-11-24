
document.addEventListener('DOMContentLoaded', function () {

    // ===================================
    // LANGUAGE SELECT MODAL (Google Translate)
    // ===================================

    // Full Google Translate language list (code => display name)
    // This list mirrors commonly supported languages; codes may vary slightly
    // across different GT widget versions (eg. 'zh-CN'/'zh-TW').
    const KAKN_LANGUAGES = [
        { code: 'af', name: 'Afrikaans' },
        { code: 'sq', name: 'Albanian' },
        { code: 'am', name: 'Amharic' },
        { code: 'ar', name: 'Arabic' },
        { code: 'hy', name: 'Armenian' },
        { code: 'az', name: 'Azerbaijani' },
        { code: 'eu', name: 'Basque' },
        { code: 'be', name: 'Belarusian' },
        { code: 'bn', name: 'Bengali' },
        { code: 'bs', name: 'Bosnian' },
        { code: 'bg', name: 'Bulgarian' },
        { code: 'ca', name: 'Catalan' },
        { code: 'ceb', name: 'Cebuano' },
        { code: 'ny', name: 'Chichewa' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
        { code: 'zh-TW', name: 'Chinese (Traditional)' },
        { code: 'co', name: 'Corsican' },
        { code: 'hr', name: 'Croatian' },
        { code: 'cs', name: 'Czech' },
        { code: 'da', name: 'Danish' },
        { code: 'nl', name: 'Dutch' },
        { code: 'en', name: 'English' },
        { code: 'eo', name: 'Esperanto' },
        { code: 'et', name: 'Estonian' },
        { code: 'tl', name: 'Filipino' },
        { code: 'fi', name: 'Finnish' },
        { code: 'fr', name: 'French' },
        { code: 'fy', name: 'Frisian' },
        { code: 'gl', name: 'Galician' },
        { code: 'ka', name: 'Georgian' },
        { code: 'de', name: 'German' },
        { code: 'el', name: 'Greek' },
        { code: 'gu', name: 'Gujarati' },
        { code: 'ht', name: 'Haitian Creole' },
        { code: 'ha', name: 'Hausa' },
        { code: 'haw', name: 'Hawaiian' },
        { code: 'he', name: 'Hebrew' },
        { code: 'hi', name: 'Hindi' },
        { code: 'hmn', name: 'Hmong' },
        { code: 'hu', name: 'Hungarian' },
        { code: 'is', name: 'Icelandic' },
        { code: 'ig', name: 'Igbo' },
        { code: 'id', name: 'Indonesian' },
        { code: 'ga', name: 'Irish' },
        { code: 'it', name: 'Italian' },
        { code: 'ja', name: 'Japanese' },
        { code: 'jw', name: 'Javanese' },
        { code: 'kn', name: 'Kannada' },
        { code: 'kk', name: 'Kazakh' },
        { code: 'km', name: 'Khmer' },
        { code: 'ko', name: 'Korean' },
        { code: 'ku', name: 'Kurdish' },
        { code: 'ky', name: 'Kyrgyz' },
        { code: 'lo', name: 'Lao' },
        { code: 'la', name: 'Latin' },
        { code: 'lv', name: 'Latvian' },
        { code: 'lt', name: 'Lithuanian' },
        { code: 'lb', name: 'Luxembourgish' },
        { code: 'mk', name: 'Macedonian' },
        { code: 'mg', name: 'Malagasy' },
        { code: 'ms', name: 'Malay' },
        { code: 'ml', name: 'Malayalam' },
        { code: 'mt', name: 'Maltese' },
        { code: 'mi', name: 'Maori' },
        { code: 'mr', name: 'Marathi' },
        { code: 'mn', name: 'Mongolian' },
        { code: 'my', name: 'Myanmar (Burmese)' },
        { code: 'ne', name: 'Nepali' },
        { code: 'no', name: 'Norwegian' },
        { code: 'ps', name: 'Pashto' },
        { code: 'fa', name: 'Persian' },
        { code: 'pl', name: 'Polish' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'pa', name: 'Punjabi' },
        { code: 'ro', name: 'Romanian' },
        { code: 'ru', name: 'Russian' },
        { code: 'sm', name: 'Samoan' },
        { code: 'gd', name: 'Scots Gaelic' },
        { code: 'sr', name: 'Serbian' },
        { code: 'st', name: 'Sesotho' },
        { code: 'sn', name: 'Shona' },
        { code: 'sd', name: 'Sindhi' },
        { code: 'si', name: 'Sinhala' },
        { code: 'sk', name: 'Slovak' },
        { code: 'sl', name: 'Slovenian' },
        { code: 'so', name: 'Somali' },
        { code: 'es', name: 'Spanish' },
        { code: 'su', name: 'Sundanese' },
        { code: 'sw', name: 'Swahili' },
        { code: 'sv', name: 'Swedish' },
        { code: 'tg', name: 'Tajik' },
        { code: 'ta', name: 'Tamil' },
        { code: 'te', name: 'Telugu' },
        { code: 'th', name: 'Thai' },
        { code: 'tr', name: 'Turkish' },
        { code: 'uk', name: 'Ukrainian' },
        { code: 'ur', name: 'Urdu' },
        { code: 'uz', name: 'Uzbek' },
        { code: 'vi', name: 'Vietnamese' },
        { code: 'cy', name: 'Welsh' },
        { code: 'xh', name: 'Xhosa' },
        { code: 'yi', name: 'Yiddish' },
        { code: 'yo', name: 'Yoruba' },
        { code: 'zu', name: 'Zulu' }
    ];

    // Create and inject the modal into the page (once)
    function createLanguageModal() {
        if (document.querySelector('.lang-modal')) return;

        const modal = document.createElement('div');
        modal.className = 'lang-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="modal-card" role="document">
                <div class="modal-header">
                    <h3>Select language</h3>
                    <div>
                        <input type="search" class="lang-search" placeholder="Search language..." aria-label="Search languages">
                        <button type="button" class="lang-modal-close" aria-label="Close language selector">×</button>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="lang-list" tabindex="0"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Populate list with optional filter
        const list = modal.querySelector('.lang-list');
        function renderList(filter) {
            list.innerHTML = '';
            const q = (filter || '').toLowerCase().trim();
            KAKN_LANGUAGES.forEach(lang => {
                if (q && !(lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q))) return;
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'lang-item';
                item.textContent = lang.name;
                item.dataset.lang = lang.code;
                item.addEventListener('click', function() {
                    setGoogleTranslateLanguage(this.dataset.lang);
                    closeLanguageModal();
                });
                list.appendChild(item);
            });
        }

        renderList();

        // Search handling
        const searchInput = modal.querySelector('.lang-search');
        searchInput.addEventListener('input', function() {
            renderList(this.value);
        });
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                const first = list.querySelector('.lang-item');
                if (first) first.focus();
            }
        });

        // Close handlers
        modal.querySelector('.lang-modal-close').addEventListener('click', closeLanguageModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeLanguageModal();
        });

        // Keyboard: Escape to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) closeLanguageModal();
        });
    }

    function openLanguageModal() {
        createLanguageModal();
        const modal = document.querySelector('.lang-modal');
        if (!modal) return;
        modal.classList.add('open');
        // Focus first item for accessibility
        const first = modal.querySelector('.lang-item');
        if (first) first.focus();
    }

    function closeLanguageModal() {
        const modal = document.querySelector('.lang-modal');
        if (!modal) return;
        modal.classList.remove('open');
    }

    // Ensure there is a footer language button inside each .footer-translate
    function ensureFooterLanguageButtons() {
        const footers = document.querySelectorAll('.footer-translate');
        footers.forEach(ft => {
            if (ft.querySelector('.lang-btn')) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lang-btn';
            btn.textContent = 'Language';
            btn.addEventListener('click', openLanguageModal);

            // Insert the button before the google translate element if present
            const gt = ft.querySelector('#google_translate_element');
            if (gt) ft.insertBefore(btn, gt);
            else ft.appendChild(btn);
        });
    }

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

    // Initialize footer buttons on load
    ensureFooterLanguageButtons();

    
    console.log('KAKN Sites loaded successfully. Visit count:', JSON.parse(localStorage.getItem('kakn_visits') || '[]').length);
});
