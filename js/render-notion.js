document.addEventListener("DOMContentLoaded", async () => {
    // Déterminer le préfixe vers la racine
    const basePath = window.SITE_ROOT !== undefined ? window.SITE_ROOT : (window.location.pathname.includes('/pages/') ? "../" : "");

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
        } catch(e) { console.error("Erreur chargement personnel", e); }
        
        try {
            const resEdu = await fetch(eduUrl);
            if (resEdu.ok) {
                const data = await resEdu.json();
                data.forEach(p => p.category = "cours");
                allProjects.push(...data);
            }
        } catch(e) { console.error("Erreur chargement educatif", e); }
        
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
                    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
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
            imgPath = basePath + imgPath.substring(6); // photo/...
        }

        let linkDir = projet.category === "perso" ? "pages/personnel/" : "pages/educatif/";
        let projectLink = basePath + linkDir + projet.url;

        return `
            <a href="${projectLink}" class="card-podcast reveal-on-scroll is-visible" data-category="${projet.category}" style="display:flex;">
                <div class="card-image-wrapper">
                    <img src="${imgPath}" alt="${projet.titre}" loading="lazy">
                    <div class="badges-container">${badgesHtml}</div>
                </div>
                <div style="padding: 20px;">
                    <h3 style="font-family: var(--police-titre); font-size: 1.5rem;">${projet.titre}</h3>
                    <p style="color: var(--couleur-texte-secondaire); font-size: 0.9rem; margin-top: 5px;">${projet.date}</p>
                </div>
            </a>
        `;
    }

    const allProjects = await fetchAllProjects();

    // 1. Remplir le Portfolio
    const gridPortfolio = document.getElementById("grid-portfolio");
    if (gridPortfolio) {
        if (allProjects.length === 0) {
            gridPortfolio.innerHTML = `<p style="text-align: center; width: 100%; grid-column: 1/-1;">Aucun projet trouvé.</p>`;
        } else {
            gridPortfolio.innerHTML = allProjects.map(p => createCard(p, basePath)).join('');
        }
    }

    // 2. Remplir l'Accueil
    const gridIndex = document.getElementById("grid-index");
    if (gridIndex) {
        let accueilProjects = allProjects.filter(p => p.accueil === true);
        if (accueilProjects.length === 0) {
            accueilProjects = allProjects.slice(0, 6);
        }
        
        if (accueilProjects.length === 0) {
            gridIndex.innerHTML = `<p style="text-align: center; width: 100%; grid-column: 1/-1;">Aucun projet trouvé.</p>`;
        } else {
            gridIndex.innerHTML = accueilProjects.map(p => createCard(p, basePath)).join('');
        }
    }

    // 3. Système de Filtrage Dynamique (Doit s'exécuter après l'injection)
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filterValue = btn.getAttribute('data-filter');
                const projectCards = document.querySelectorAll('.card-podcast');

                projectCards.forEach(card => {
                    const category = card.getAttribute('data-category');
                    if (filterValue === 'tous' || filterValue === category) {
                        card.style.display = 'flex';
                        card.classList.remove('is-visible');
                        setTimeout(() => {
                            card.classList.add('is-visible');
                        }, 50);
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    }
});
