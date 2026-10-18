/**
 * Objex3D - Pagination Mobile pour Impressions Vedette et Filaments
 * - Impressions 3D vedette : 4 cartes par page sur mobile
 * - Filaments en magasin : 6 cartes par page sur mobile (avec synchronisation des filtres par matériau)
 * - Vue Bureau (> 768px) : affichage standard complet sans pagination
 */
(function() {
    const MOBILE_BREAKPOINT = 768;
    const PRINTS_PER_PAGE_MOBILE = 4;
    const FILAMENTS_PER_PAGE_MOBILE = 6;

    let currentPrintPage = 1;
    let currentFilamentPage = 1;

    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    /* -------------------------------------------------------------
       1. PAGINATION IMPRESSIONS 3D VEDETTE (4 par page sur mobile)
       ------------------------------------------------------------- */
    function initFeaturedPrintsPagination() {
        const grid = document.getElementById('grid-featured-prints');
        if (!grid) return;

        let container = document.getElementById('pagination-featured-prints');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pagination-featured-prints';
            container.className = 'pagination-container';
            grid.parentNode.insertBefore(container, grid.nextSibling);
        }

        function renderPrints() {
            const cards = Array.from(grid.querySelectorAll('.card-pod-item'));
            if (cards.length === 0) return;

            if (!isMobile()) {
                // Sur Desktop : tout afficher
                cards.forEach(c => {
                    c.style.display = 'flex';
                });
                container.style.display = 'none';
                return;
            }

            // Sur Mobile : paginer 4 cartes par page
            container.style.display = 'flex';
            const totalPages = Math.ceil(cards.length / PRINTS_PER_PAGE_MOBILE);
            if (currentPrintPage > totalPages) currentPrintPage = totalPages;
            if (currentPrintPage < 1) currentPrintPage = 1;

            const startIndex = (currentPrintPage - 1) * PRINTS_PER_PAGE_MOBILE;
            const endIndex = startIndex + PRINTS_PER_PAGE_MOBILE;

            cards.forEach((card, idx) => {
                if (idx >= startIndex && idx < endIndex) {
                    card.style.setProperty('display', 'flex', 'important');
                } else {
                    card.style.setProperty('display', 'none', 'important');
                }
            });

            // Boutons de pagination
            renderPaginationControls(container, currentPrintPage, totalPages, (newPage) => {
                currentPrintPage = newPage;
                renderPrints();
                grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }

        renderPrints();
        window.addEventListener('resize', debounce(renderPrints, 150));
    }

    /* -------------------------------------------------------------
       2. PAGINATION FILAMENTS EN MAGASIN (6 par page sur mobile)
       ------------------------------------------------------------- */
    function initFilamentsPagination() {
        const grid = document.getElementById('grid-filaments');
        if (!grid) return;

        let container = document.getElementById('pagination-filaments');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pagination-filaments';
            container.className = 'pagination-container';
            grid.parentNode.insertBefore(container, grid.nextSibling);
        }

        function getActiveFilter() {
            const activeBtn = document.querySelector('#filaments-filters .filter-btn.active');
            return activeBtn ? (activeBtn.dataset.material || 'tous').toLowerCase() : 'tous';
        }

        function matchesFilter(card, filterMat) {
            if (!filterMat || filterMat === 'tous') return true;
            const mat = (card.dataset.material || '').toLowerCase();
            if (filterMat === 'technique') {
                return mat.includes('nylon') || mat.includes('pc') || mat.includes('pa');
            } else if (filterMat === 'abs') {
                return mat.includes('abs') || mat.includes('asa');
            } else if (filterMat === 'resine') {
                return mat.includes('resine') || mat.includes('sla');
            } else {
                return mat.includes(filterMat);
            }
        }

        function renderFilaments() {
            const cards = Array.from(grid.querySelectorAll('.card-filament'));
            if (cards.length === 0) return;

            const filterMat = getActiveFilter();
            const matchingCards = cards.filter(c => matchesFilter(c, filterMat));

            if (!isMobile()) {
                // Sur Desktop : afficher tous les filaments qui correspondent au filtre
                cards.forEach(card => {
                    card.style.display = matchesFilter(card, filterMat) ? 'flex' : 'none';
                });
                container.style.display = 'none';
                return;
            }

            // Sur Mobile : paginer 6 cartes par page parmi les correspondances
            container.style.display = matchingCards.length > FILAMENTS_PER_PAGE_MOBILE ? 'flex' : (matchingCards.length > 0 ? 'flex' : 'none');
            const totalPages = Math.max(1, Math.ceil(matchingCards.length / FILAMENTS_PER_PAGE_MOBILE));
            if (currentFilamentPage > totalPages) currentFilamentPage = totalPages;
            if (currentFilamentPage < 1) currentFilamentPage = 1;

            const startIndex = (currentFilamentPage - 1) * FILAMENTS_PER_PAGE_MOBILE;
            const endIndex = startIndex + FILAMENTS_PER_PAGE_MOBILE;

            cards.forEach(card => {
                const matchIndex = matchingCards.indexOf(card);
                if (matchIndex >= startIndex && matchIndex < endIndex) {
                    card.style.setProperty('display', 'flex', 'important');
                } else {
                    card.style.setProperty('display', 'none', 'important');
                }
            });

            renderPaginationControls(container, currentFilamentPage, totalPages, (newPage) => {
                currentFilamentPage = newPage;
                renderFilaments();
                grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }

        // Écouter les événements de rendu et de filtrage Notion
        window.addEventListener('objex:services-rendered', () => {
            currentFilamentPage = 1;
            renderFilaments();
        });

        window.addEventListener('objex:filaments-filtered', () => {
            currentFilamentPage = 1;
            renderFilaments();
        });

        // Observer les changements dynamiques d'enfants dans la grille de filaments
        const observer = new MutationObserver((mutations) => {
            let hasChildChange = false;
            mutations.forEach(m => {
                if (m.type === 'childList') hasChildChange = true;
            });
            if (hasChildChange) {
                renderFilaments();
            }
        });
        observer.observe(grid, { childList: true });

        // Écouter les clics sur les filtres de filaments
        const filterBtns = document.querySelectorAll('#filaments-filters .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentFilamentPage = 1;
                setTimeout(renderFilaments, 30);
            });
        });

        renderFilaments();
        window.addEventListener('resize', debounce(renderFilaments, 150));
    }

    /* -------------------------------------------------------------
       GÉNÉRATEUR DE CONTRÔLES DE PAGINATION
       ------------------------------------------------------------- */
    function renderPaginationControls(container, currentPage, totalPages, onPageChange) {
        container.innerHTML = '';
        if (totalPages <= 1) {
            container.style.display = 'none';
            return;
        }

        // Bouton Précédent
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'page-btn page-btn-prev';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.ariaLabel = 'Page précédente';
        prevBtn.disabled = (currentPage === 1);
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) onPageChange(currentPage - 1);
        });
        container.appendChild(prevBtn);

        // Boutons numérotés
        for (let i = 1; i <= totalPages; i++) {
            const numBtn = document.createElement('button');
            numBtn.type = 'button';
            numBtn.className = `page-btn page-btn-num ${i === currentPage ? 'active' : ''}`;
            numBtn.textContent = i;
            numBtn.ariaLabel = `Page ${i}`;
            numBtn.addEventListener('click', () => {
                if (i !== currentPage) onPageChange(i);
            });
            container.appendChild(numBtn);
        }

        // Bouton Suivant
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'page-btn page-btn-next';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.ariaLabel = 'Page suivante';
        nextBtn.disabled = (currentPage === totalPages);
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) onPageChange(currentPage + 1);
        });
        container.appendChild(nextBtn);
    }

    function debounce(fn, delay) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initFeaturedPrintsPagination();
            initFilamentsPagination();
        });
    } else {
        initFeaturedPrintsPagination();
        initFilamentsPagination();
    }
})();
