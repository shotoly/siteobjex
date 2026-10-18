document.addEventListener("DOMContentLoaded", async () => {
    // 1. Détection du basePath et de la langue
    let basePath = "";
    if (window.SITE_ROOT !== undefined) {
        basePath = window.SITE_ROOT;
    } else if (window.location.pathname.includes('/en/pages/')) {
        basePath = "../../";
    } else if (window.location.pathname.includes('/pages/')) {
        basePath = "../";
    }

    const isEn = document.documentElement.lang === "en" || window.location.pathname.includes('/en/');

    function slugify(text) {
        if (!text) return "";
        return text.toString().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // ==========================================================================
    // 2. LOGIQUE PORTFOLIO & ACCUEIL (PROJETS PERSONNELS & ÉDUCATIFS)
    // ==========================================================================
    async function fetchAllProjects() {
        const persoUrl = basePath + "pages/personnel/donnees.json";
        const eduUrl = basePath + "pages/educatif/donnees.json";
        let allProjects = [];
        
        try {
            const resPerso = await fetch(persoUrl);
            if (resPerso.ok) {
                const data = await resPerso.json();
                data.forEach(p => p.category = "perso");
                allProjects.push(...data);
            }
        } catch(e) { console.warn("Notice: chargement personnel non disponible", e.message); }
        
        try {
            const resEdu = await fetch(eduUrl);
            if (resEdu.ok) {
                const data = await resEdu.json();
                data.forEach(p => p.category = "cours");
                allProjects.push(...data);
            }
        } catch(e) { console.warn("Notice: chargement educatif non disponible", e.message); }
        
        // Trier par date décroissante
        allProjects.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        return allProjects;
    }

    function createCard(projet, basePath) {
        let badgesHtml = '';
        if (projet.etiquettes && Array.isArray(projet.etiquettes)) {
            badgesHtml = projet.etiquettes.map(tag => {
                const palette = [
                    "#E63946", "#1D3557", "#457B9D", "#2A9D8F", "#E76F51", 
                    "#6A4C93", "#1982C4", "#55A630", "#FF595E", "#D62828", 
                    "#003049", "#D66800", "#7B2CBF", "#0077B6", "#4C956C",
                    "#8338EC", "#3A86FF", "#FB5607", "#FF006E", "#023E8A"
                ];
                let hash = 0;
                for (let i = 0; i < tag.length; i++) {
                    hash = tag.codePointAt(i) + ((hash << 5) - hash);
                }
                hash = Math.abs(hash);
                let badgeColor = palette[hash % palette.length];
                return `<div class="date-badge" style="background: ${badgeColor}; color: white;">${tag}</div>`;
            }).join('');
        } else if (projet.etiquettes) {
            badgesHtml = `<div class="date-badge" style="background: var(--provence-violet); color: white;">${projet.etiquettes}</div>`;
        }

        // Gestion du chemin d'image
        let imgPath = projet.image || "";
        if (imgPath.startsWith("../../")) {
            imgPath = basePath + imgPath.substring(6);
        } else if (imgPath.startsWith("../")) {
            imgPath = basePath + imgPath.substring(3);
        } else if (imgPath && !imgPath.startsWith("http")) {
            imgPath = basePath + imgPath;
        }

        let linkDir = projet.category === "perso" ? "pages/personnel/" : "pages/educatif/";
        let projectLink = basePath + linkDir + (projet.url || "#");

        return `
            <a href="${projectLink}" class="card-podcast reveal-on-scroll is-visible" data-category="${projet.category}" style="display:flex;">
                <div class="card-image-wrapper">
                    <img src="${imgPath}" alt="${projet.titre}" loading="lazy">
                    <div class="badges-container">${badgesHtml}</div>
                </div>
                <div style="padding: 20px;">
                    <h3 style="font-family: var(--police-titre); font-size: 1.5rem;">${projet.titre}</h3>
                    <p style="color: var(--couleur-texte-secondaire); font-size: 0.9rem; margin-top: 5px;">${projet.date || ''}</p>
                </div>
            </a>
        `;
    }

    // Initialisation Portfolio & Accueil si présents dans le DOM
    const gridPortfolio = document.getElementById("grid-portfolio");
    const gridIndex = document.getElementById("grid-index");

    if (gridPortfolio || gridIndex) {
        const allProjects = await fetchAllProjects();

        if (gridPortfolio) {
            if (allProjects.length === 0) {
                gridPortfolio.innerHTML = `<p style="text-align: center; width: 100%; grid-column: 1/-1;">${isEn ? 'No projects found.' : 'Aucun projet trouvé.'}</p>`;
            } else {
                gridPortfolio.innerHTML = allProjects.map(p => createCard(p, basePath)).join('');
            }
        }

        if (gridIndex) {
            let accueilProjects = allProjects.filter(p => p.accueil === true);
            if (accueilProjects.length === 0) {
                accueilProjects = allProjects.slice(0, 6);
            }
            
            if (accueilProjects.length === 0) {
                gridIndex.innerHTML = `<p style="text-align: center; width: 100%; grid-column: 1/-1;">${isEn ? 'No projects found.' : 'Aucun projet trouvé.'}</p>`;
            } else {
                gridIndex.innerHTML = accueilProjects.map(p => createCard(p, basePath)).join('');
            }
        }
    }

    // ==========================================================================
    // 3. LOGIQUE SERVICES : PROJETS CLIENTS & CATALOGUE FILAMENTS
    // ==========================================================================
    const gridClientProjects = document.getElementById("grid-client-projects");
    const gridFilaments = document.getElementById("grid-filaments");

    async function fetchServicesData() {
        const servicesUrl = basePath + "pages/services/donnees_services.json";
        try {
            const res = await fetch(servicesUrl);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.warn("Notice: donnees_services.json introuvable, tentative fichiers séparés", e.message);
        }

        let clientProjects = [];
        let filaments = [];

        try {
            const resProj = await fetch(basePath + "pages/services/projets_clients.json");
            if (resProj.ok) clientProjects = await resProj.json();
        } catch(e) {}

        try {
            const resFil = await fetch(basePath + "pages/services/filaments.json");
            if (resFil.ok) filaments = await resFil.json();
        } catch(e) {}

        return { clientProjects, filaments };
    }

    function createClientProjectCard(projet, basePath, isEn) {
        const titre = (isEn && projet.titreEn) ? projet.titreEn : projet.titre;
        const description = (isEn && projet.descriptionEn) ? projet.descriptionEn : (projet.description || "");
        
        let imgHtml = '';
        if (projet.image) {
            let imgPath = projet.image;
            if (imgPath.startsWith("../../")) imgPath = imgPath.substring(6);
            else if (imgPath.startsWith("../")) imgPath = imgPath.substring(3);
            const fullImgPath = basePath + imgPath;
            imgHtml = `<img src="${fullImgPath}" alt="${titre}" loading="lazy">`;
        } else {
            imgHtml = `<div class="card-image-placeholder"><i class="fa-solid fa-cube"></i></div>`;
        }

        const rawService = projet.service || "Impression 3D";
        const serviceSlug = slugify(rawService);

        const tags = (projet.etiquettes && Array.isArray(projet.etiquettes) && projet.etiquettes.length > 0)
            ? projet.etiquettes
            : [rawService];

        const allTagsSlugs = tags.map(t => slugify(t)).join(' ');

        const badgesHtml = tags.map(tag => {
            return `<div class="date-badge" style="background: var(--provence-violet); color: white;">${tag}</div>`;
        }).join('');

        const clientLabel = isEn ? "Client" : "Client";

        return `
            <div class="card-podcast reveal-on-scroll is-visible" data-service="${serviceSlug}" data-tags="${allTagsSlugs}" style="display:flex;">
                <div class="card-image-wrapper">
                    ${imgHtml}
                    <div class="badges-container">${badgesHtml}</div>
                    ${projet.client ? `<div class="client-tag-badge"><i class="fa-solid fa-briefcase"></i> ${clientLabel} : ${projet.client}</div>` : ''}
                </div>
                <div class="client-project-body">
                    <h3 style="font-family: var(--police-titre); font-size: 1.4rem; color: var(--couleur-texte);">${titre}</h3>
                    ${description ? `<p class="client-project-desc">${description}</p>` : ''}
                    <div class="client-project-meta">
                        <span><i class="fa-solid fa-layer-group" style="color: var(--provence-violet); margin-right: 6px;"></i>${rawService}</span>
                        ${projet.date ? `<span><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i>${projet.date}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function createFilamentCard(filament, isEn) {
        let stockClass = "stock-instock";
        let stockText = isEn ? "In Stock" : "En stock";
        let stockIcon = '<i class="fa-solid fa-circle-check"></i>';
        
        const rawStock = (filament.stock || "").toLowerCase();
        if (rawStock.includes("commen") || rawStock.includes("comman") || rawStock.includes("order")) {
            stockClass = "stock-onorder";
            stockText = isEn ? "On Order" : "Sur commande";
            stockIcon = '<i class="fa-solid fa-clock"></i>';
        } else if (rawStock.includes("absent") || rawStock.includes("rupture") || rawStock.includes("out")) {
            stockClass = "stock-out";
            stockText = isEn ? "Absent" : "Absent";
            stockIcon = '<i class="fa-solid fa-circle-xmark"></i>';
        }

        const mat = filament.materiau || "PLA";
        const matSlug = slugify(mat);
        const hex = filament.codeHex || "#7C3AED";

        return `
            <div class="card-filament reveal-on-scroll is-visible" data-material="${matSlug}">
                <div>
                    <div class="filament-header">
                        <span class="filament-material-badge">${mat}</span>
                        <span class="filament-stock-badge ${stockClass}">${stockIcon} ${stockText}</span>
                    </div>
                    <h3 class="filament-title">${filament.nom}</h3>
                    <div class="filament-color-row">
                        <span class="color-dot" style="background-color: ${hex};"></span>
                        <span class="color-name">${filament.couleur || 'Standard'}</span>
                        <span class="color-hex">${hex}</span>
                    </div>
                </div>
                <div>
                    <div class="filament-specs">
                        ${filament.marque ? `<span><strong>${isEn ? 'Brand' : 'Marque'} :</strong> ${filament.marque}</span>` : '<span></span>'}
                        ${filament.prix ? `<span><strong>${isEn ? 'Price' : 'Prix'} :</strong> ${filament.prix} €</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    if (gridClientProjects || gridFilaments) {
        const servicesData = await fetchServicesData();

        // Rendu Projets Clients
        if (gridClientProjects && servicesData.clientProjects) {
            if (servicesData.clientProjects.length === 0) {
                gridClientProjects.innerHTML = `
                    <div class="empty-notice">
                        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--provence-violet); margin-bottom: 15px; display: block; opacity: 0.7;"></i>
                        <h4 style="font-family: var(--police-titre); font-size: 1.2rem; color: var(--couleur-texte); margin-bottom: 8px;">
                            ${isEn ? 'No client projects published yet' : 'Aucun projet client publié pour le moment'}
                        </h4>
                        <p style="color: var(--couleur-texte-secondaire); font-size: 0.95rem; max-width: 500px; margin: 0 auto;">
                            ${isEn ? 'Projects marked as public in Notion will automatically appear here upon next build.' : 'Les projets cochés comme publics dans Notion apparaîtront automatiquement ici au prochain build.'}
                        </p>
                    </div>`;
            } else {
                gridClientProjects.innerHTML = servicesData.clientProjects.map(p => createClientProjectCard(p, basePath, isEn)).join('');
            }
        }

        // Rendu Filaments
        if (gridFilaments && servicesData.filaments) {
            if (servicesData.filaments.length === 0) {
                gridFilaments.innerHTML = `
                    <div class="empty-notice">
                        <i class="fa-solid fa-cubes-stacked" style="font-size: 2.5rem; color: var(--provence-violet); margin-bottom: 15px; display: block; opacity: 0.7;"></i>
                        <h4 style="font-family: var(--police-titre); font-size: 1.2rem; color: var(--couleur-texte); margin-bottom: 8px;">
                            ${isEn ? 'No filaments currently in catalog' : 'Aucun filament dans le catalogue pour le moment'}
                        </h4>
                        <p style="color: var(--couleur-texte-secondaire); font-size: 0.95rem; max-width: 500px; margin: 0 auto;">
                            ${isEn ? 'Filaments marked as public in Notion will automatically appear here upon next build.' : 'Les filaments cochés comme publics dans Notion apparaîtront automatiquement ici au prochain build.'}
                        </p>
                    </div>`;
            } else {
                gridFilaments.innerHTML = servicesData.filaments.map(f => createFilamentCard(f, isEn)).join('');
            }
            window.dispatchEvent(new CustomEvent('objex:services-rendered'));
        }
    }

    // ==========================================================================
    // 4. SYSTÈMES DE FILTRAGE DYNAMIQUE
    // ==========================================================================
    // Filtres Portfolio Général
    const portfolioFilters = document.querySelectorAll('.portfolio-filters:not(#filaments-filters):not(#services-filters) .filter-btn');
    if (portfolioFilters.length > 0) {
        portfolioFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                portfolioFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.filter;
                document.querySelectorAll('#grid-portfolio .card-podcast, #grid-index .card-podcast').forEach(card => {
                    const cat = card.dataset.category;
                    if (val === 'tous' || val === cat) {
                        card.style.display = 'flex';
                        card.classList.remove('is-visible');
                        setTimeout(() => card.classList.add('is-visible'), 50);
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // Filtres Projets Clients
    const clientFilters = document.querySelectorAll('#services-filters .filter-btn');
    if (clientFilters.length > 0) {
        clientFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                clientFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.filter;
                document.querySelectorAll('#grid-client-projects .card-podcast').forEach(card => {
                    const s = card.dataset.service || "";
                    const tags = card.dataset.tags || "";
                    if (val === 'tous' || s.includes(val) || val.includes(s) || tags.includes(val)) {
                        card.style.display = 'flex';
                        card.classList.remove('is-visible');
                        setTimeout(() => card.classList.add('is-visible'), 50);
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }

    // Filtres Catalogue Filaments
    const filamentFilters = document.querySelectorAll('#filaments-filters .filter-btn');
    if (filamentFilters.length > 0) {
        filamentFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                filamentFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filterMat = (btn.dataset.material || "").toLowerCase();
                document.querySelectorAll('#grid-filaments .card-filament').forEach(card => {
                    const mat = (card.dataset.material || "").toLowerCase();
                    let match = false;
                    if (filterMat === 'tous') {
                        match = true;
                    } else if (filterMat === 'technique') {
                        match = mat.includes('nylon') || mat.includes('pc') || mat.includes('pa');
                    } else if (filterMat === 'abs') {
                        match = mat.includes('abs') || mat.includes('asa');
                    } else if (filterMat === 'resine') {
                        match = mat.includes('resine') || mat.includes('sla');
                    } else {
                        match = mat.includes(filterMat);
                    }

                    if (match) {
                        card.style.display = 'flex';
                        card.classList.remove('is-visible');
                        setTimeout(() => card.classList.add('is-visible'), 50);
                    } else {
                        card.style.display = 'none';
                    }
                });
                window.dispatchEvent(new CustomEvent('objex:filaments-filtered'));
            });
        });
    }
});
