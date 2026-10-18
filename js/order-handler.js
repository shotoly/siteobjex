/**
 * Gestionnaire de commande Print-on-Demand & Projets Personnalisés Objex3D
 * Intègre :
 *  - Carrousel multimédia interactif (photos et vidéos)
 *  - Calcul de prix dynamique en temps réel : (Poids * Prix du filament) * 1.5
 *  - Filtrage automatique des filaments en rupture de stock
 *  - Soumission hybride résiliente (n8n Webhook -> Repli automatique sur mailto:)
 */

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

    // Cache des données
    let storeModels = [];
    let filaments = [];
    let currentModel = null;
    let currentMediaIndex = 0;

    // État de sélection des filaments (Couleur 1 et Couleur 2)
    let selectedColor1 = null;
    let selectedColor2 = null;
    let isBicolorActive = false;
    let activePickingSlot = 1; // 1 ou 2
    let activeMaterialFilter = "all";
    let activeSearchQuery = "";

    // Éléments du DOM (Modal POD)
    const podModal = document.getElementById("pod-modal");
    const podModalClose = document.getElementById("pod-modal-close");
    const podMediaContainer = document.getElementById("pod-media-viewer");
    const podThumbnails = document.getElementById("pod-thumbnails");
    const podPrevBtn = document.getElementById("pod-carousel-prev");
    const podNextBtn = document.getElementById("pod-carousel-next");
    const podModelTitle = document.getElementById("pod-model-title");
    const podModelAuthor = document.getElementById("pod-model-author");
    const podModelWeight = document.getElementById("pod-model-weight");
    const podModelTime = document.getElementById("pod-model-time");
    const podFilamentSelect = document.getElementById("pod-filament-select");
    const podQuantity = document.getElementById("pod-quantity");
    const podFormulaBreakdown = document.getElementById("pod-formula-breakdown");
    const podCalcPrice = document.getElementById("pod-calc-price");
    const podOrderForm = document.getElementById("pod-order-form");
    const podSubmitBtn = document.getElementById("pod-submit-btn");
    const podStatusMsg = document.getElementById("pod-status-msg");

    // Éléments du DOM (Sélecteur Visuel & Bicolore)
    const btnPickColor1 = document.getElementById("btn-pick-color1");
    const btnPickColor2 = document.getElementById("btn-pick-color2");
    const podBicolorCheckbox = document.getElementById("pod-bicolor-checkbox");
    const podSlotColor2 = document.getElementById("pod-slot-color2");
    const podLockedMaterialSpan = document.getElementById("pod-locked-material");

    const podColor1Name = document.getElementById("pod-color1-name");
    const podColor1Meta = document.getElementById("pod-color1-meta");
    const podColor1Badge = document.getElementById("pod-color1-badge");
    const podColor1Img = document.getElementById("pod-color1-img");
    const podColor1Dot = document.getElementById("pod-color1-dot");

    const podColor2Name = document.getElementById("pod-color2-name");
    const podColor2Meta = document.getElementById("pod-color2-meta");
    const podColor2Badge = document.getElementById("pod-color2-badge");
    const podColor2Img = document.getElementById("pod-color2-img");
    const podColor2Dot = document.getElementById("pod-color2-dot");

    // Éléments du DOM (Modal Galerie Filament Picker)
    const filamentPickerModal = document.getElementById("filament-picker-modal");
    const filamentPickerClose = document.getElementById("filament-picker-close");
    const filamentPickerTitle = document.getElementById("filament-picker-title");
    const filamentPickerDesc = document.getElementById("filament-picker-desc");
    const filamentPickerSearch = document.getElementById("filament-picker-search");
    const filamentPickerTabs = document.getElementById("filament-picker-tabs");
    const filamentPickerGrid = document.getElementById("filament-picker-grid");

    // Éléments du DOM (Modal Projet Personnalisé)
    const customModal = document.getElementById("custom-modal");
    const customModalClose = document.getElementById("custom-modal-close");
    const customOpenBtns = document.querySelectorAll(".btn-custom-cta, #btn-custom-project-cta, .btn-custom-project");
    const customOrderForm = document.getElementById("custom-order-form");
    const customSubmitBtn = document.getElementById("custom-submit-btn");
    const customStatusMsg = document.getElementById("custom-status-msg");

    // Toast notification
    function showToast(message, type = "info") {
        let toast = document.getElementById("objex-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "objex-toast";
            toast.className = "objex-toast";
            document.body.appendChild(toast);
        }
        toast.className = `objex-toast toast-${type} show`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle'}"></i> <span>${message}</span>`;
        setTimeout(() => {
            toast.classList.remove("show");
        }, 5000);
    }

    // Résolution propre de l'URL d'image d'un filament
    function resolveFilamentImgUrl(imgRelPath) {
        if (!imgRelPath) return basePath + "photo/filaments/filament_default.jpg";
        let clean = imgRelPath;
        if (clean.startsWith("../../../")) clean = clean.substring(9);
        else if (clean.startsWith("../../")) clean = clean.substring(6);
        else if (clean.startsWith("../")) clean = clean.substring(3);
        if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
        return basePath + clean;
    }

    // 2. Chargement des données
    async function loadData() {
        try {
            const resStore = await fetch(basePath + "pages/services/store_prints.json");
            if (resStore.ok) {
                storeModels = await resStore.json();
            }
        } catch (e) {
            console.warn("Notice: store_prints.json non chargé via fetch", e.message);
        }

        try {
            const resFil = await fetch(basePath + "pages/services/filaments.json");
            if (resFil.ok) {
                const allFilaments = await resFil.json();
                // Règle Jalon 2 : exclure les filaments en rupture de stock
                filaments = allFilaments.filter(f => {
                    const st = (f.stock || "").toLowerCase();
                    return !f.enRupture && !st.includes("absent") && !st.includes("rupture") && !st.includes("out");
                });
            }
        } catch (e) {
            console.warn("Notice: filaments.json non chargé via fetch", e.message);
        }

        // Sélection par défaut
        if (filaments.length > 0) {
            selectedColor1 = filaments[0];
            // Trouver une couleur 2 par défaut du même matériau si possible
            const sameMat = filaments.filter(f => (f.materiau || '').toLowerCase() === (selectedColor1.materiau || '').toLowerCase());
            selectedColor2 = sameMat.length > 1 ? sameMat[1] : sameMat[0];
        }

        populateFilamentSelect();
        updateColorSlotDisplay(1);
        updateColorSlotDisplay(2);
    }

    // Mise à jour visuelle des cartes de sélection d'une couleur (Slot 1 ou 2)
    function updateColorSlotDisplay(slot) {
        const item = slot === 1 ? selectedColor1 : selectedColor2;
        if (!item) return;

        const nameEl = slot === 1 ? podColor1Name : podColor2Name;
        const metaEl = slot === 1 ? podColor1Meta : podColor2Meta;
        const badgeEl = slot === 1 ? podColor1Badge : podColor2Badge;
        const imgEl = slot === 1 ? podColor1Img : podColor2Img;
        const dotEl = slot === 1 ? podColor1Dot : podColor2Dot;

        if (nameEl) nameEl.textContent = item.nom || "Filament";
        if (metaEl) {
            const brand = item.marque ? `${item.marque} • ` : "";
            const price = item.prixKg ? `${item.prixKg} €/kg` : `${((item.prixGramme || 0.022) * 1000).toFixed(0)} €/kg`;
            metaEl.textContent = `${brand}${price}`;
        }
        if (badgeEl) badgeEl.textContent = item.materiau || "PLA";
        if (imgEl) {
            imgEl.src = resolveFilamentImgUrl(item.image);
            imgEl.alt = item.nom;
        }
        if (dotEl) {
            const hex = item.codeHex || item.couleur || "#7C3AED";
            dotEl.style.backgroundColor = hex.startsWith("#") ? hex : "#7C3AED";
        }

        if (slot === 1 && podLockedMaterialSpan) {
            podLockedMaterialSpan.textContent = item.materiau || "PLA+";
        }
    }

    // 3. Remplissage du sélecteur de filaments (compatibilité + calcul)
    function populateFilamentSelect() {
        if (!podFilamentSelect) return;
        podFilamentSelect.innerHTML = "";

        if (filaments.length === 0) {
            const opt = document.createElement("option");
            opt.value = "standard";
            opt.textContent = isEn ? "Standard PLA (0.022 €/g)" : "PLA Standard de précision (0.022 €/g)";
            opt.dataset.priceGram = "0.022";
            opt.dataset.name = "PLA Standard";
            podFilamentSelect.appendChild(opt);
            return;
        }

        filaments.forEach((f, idx) => {
            const opt = document.createElement("option");
            opt.value = f.id || `fil_${idx}`;
            const priceG = f.prixGramme || (f.prix ? (f.prix / 1000) : 0.022);
            opt.dataset.priceGram = priceG.toString();
            opt.dataset.name = f.nom;
            opt.dataset.color = f.codeHex || "#7C3AED";
            opt.dataset.material = f.materiau || "PLA";

            const matTag = f.materiau ? `[${f.materiau}] ` : "";
            const colorTxt = f.couleur && f.couleur !== "Standard" ? ` - ${f.couleur}` : "";
            const priceTxt = ` (${(priceG * 1000).toFixed(0)} €/kg)`;

            opt.textContent = `${matTag}${f.nom}${colorTxt}${priceTxt}`;
            podFilamentSelect.appendChild(opt);
        });

        if (selectedColor1) {
            const foundIdx = filaments.findIndex(f => f.id === selectedColor1.id);
            if (foundIdx >= 0) podFilamentSelect.selectedIndex = foundIdx;
        }
    }

    // Synchronisation du select caché quand selectedColor1 change
    function syncHiddenSelect() {
        if (!podFilamentSelect || !selectedColor1) return;
        for (let i = 0; i < podFilamentSelect.options.length; i++) {
            if (podFilamentSelect.options[i].dataset.name === selectedColor1.nom || podFilamentSelect.options[i].value === selectedColor1.id) {
                podFilamentSelect.selectedIndex = i;
                break;
            }
        }
    }

    // 4. Calcul de prix en temps réel basé sur Notion (+ majoration bicolore)
    function calculatePrice() {
        if (!currentModel) return;

        const weight = parseFloat(currentModel.weight || currentModel.poids || 50);
        const priceGram1 = selectedColor1 ? (selectedColor1.prixGramme || (selectedColor1.prix ? selectedColor1.prix / 1000 : 0.022)) : 0.022;
        const priceGram2 = selectedColor2 ? (selectedColor2.prixGramme || (selectedColor2.prix ? selectedColor2.prix / 1000 : 0.022)) : priceGram1;
        
        // Si bicolore, prix du filament = moyenne pondérée des deux couleurs
        const priceGram = isBicolorActive ? ((priceGram1 + priceGram2) / 2) : priceGram1;
        const qty = podQuantity ? Math.max(1, parseInt(podQuantity.value || 1, 10)) : 1;

        // Taux de majoration bicolore (+25%)
        const bicolorRate = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.BICOLOR_SURCHARGE_RATE) !== undefined 
            ? window.OBJEX_CONFIG.BICOLOR_SURCHARGE_RATE 
            : 0.25;
        const bicolorMultiplier = isBicolorActive ? (1 + bicolorRate) : 1.0;

        // Prix défini dynamiquement dans Notion pour ce modèle
        const notionModelPrice = (currentModel.prix !== undefined && currentModel.prix !== null && currentModel.prix > 0)
            ? parseFloat(currentModel.prix)
            : ((currentModel.price !== undefined && currentModel.price !== null && currentModel.price > 0) ? parseFloat(currentModel.price) : null);

        const coeff = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.COEFFICIENT_MARGE) || 1.5;
        const minPrice = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.PRIX_MINIMUM) || 2.0;

        let baseUnitPrice = 0;
        let formulaHtml = '';

        if (notionModelPrice !== null) {
            baseUnitPrice = Math.max(minPrice, notionModelPrice);
            const unitPrice = baseUnitPrice * bicolorMultiplier;
            const totalPrice = unitPrice * qty;

            formulaHtml = `
                <div class="formula-line" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <span style="color: var(--couleur-texte-secondaire); font-size: 0.88rem;">${isEn ? 'Unit price' : 'Prix unitaire'} : <strong>${unitPrice.toFixed(2)} €</strong> ${qty > 1 ? `× ${qty}` : ''}</span>
                    ${isBicolorActive ? `<span class="pod-bicolor-pill-badge" style="font-size: 0.76rem; background: rgba(124, 58, 237, 0.1); color: var(--provence-violet); padding: 2px 10px; border-radius: 20px; font-weight: 600;">+25% Bicolore</span>` : ''}
                </div>
            `;

            if (podFormulaBreakdown) podFormulaBreakdown.innerHTML = formulaHtml;
            if (podCalcPrice) podCalcPrice.textContent = `${totalPrice.toFixed(2)} €`;

            return {
                unitPrice: Number(unitPrice.toFixed(2)),
                totalPrice: Number(totalPrice.toFixed(2)),
                weight,
                priceGram,
                qty,
                isBicolor: isBicolorActive
            };
        } else {
            const rawUnitPrice = (weight * priceGram) * coeff;
            baseUnitPrice = Math.max(minPrice, rawUnitPrice);
            const unitPrice = baseUnitPrice * bicolorMultiplier;
            const totalPrice = unitPrice * qty;

            formulaHtml = `
                <div class="formula-line" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <span style="color: var(--couleur-texte-secondaire); font-size: 0.88rem;">${isEn ? 'Unit price' : 'Prix unitaire'} : <strong>${unitPrice.toFixed(2)} €</strong> ${qty > 1 ? `× ${qty}` : ''}</span>
                    ${isBicolorActive ? `<span class="pod-bicolor-pill-badge" style="font-size: 0.76rem; background: rgba(124, 58, 237, 0.1); color: var(--provence-violet); padding: 2px 10px; border-radius: 20px; font-weight: 600;">+25% Bicolore</span>` : ''}
                </div>
            `;

            if (podFormulaBreakdown) podFormulaBreakdown.innerHTML = formulaHtml;
            if (podCalcPrice) podCalcPrice.textContent = `${totalPrice.toFixed(2)} €`;

            return {
                unitPrice: Number(unitPrice.toFixed(2)),
                totalPrice: Number(totalPrice.toFixed(2)),
                weight,
                priceGram,
                qty,
                isBicolor: isBicolorActive
            };
        }
    }

    // 5. Affichage d'un média dans le carrousel
    function renderCarouselMedia(index) {
        if (!currentModel || !podMediaContainer) return;
        const mediaList = currentModel.media && currentModel.media.length > 0
            ? currentModel.media
            : [{ type: 'image', url: currentModel.image || currentModel.localImage || currentModel.imageUrl }];

        if (index < 0) index = mediaList.length - 1;
        if (index >= mediaList.length) index = 0;
        currentMediaIndex = index;

        const mediaItem = mediaList[currentMediaIndex];
        let mediaUrl = mediaItem.url || mediaItem.remoteUrl;
        if (mediaUrl.startsWith('../../../')) mediaUrl = mediaUrl.substring(9);
        else if (mediaUrl.startsWith('../../')) mediaUrl = mediaUrl.substring(6);
        else if (mediaUrl.startsWith('../')) mediaUrl = mediaUrl.substring(3);

        const fullSrc = mediaUrl.startsWith('http') ? mediaUrl : (basePath + mediaUrl);

        if (mediaItem.type === 'video') {
            podMediaContainer.innerHTML = `
                <video controls autoplay muted playsinline class="pod-active-media">
                    <source src="${fullSrc}">
                    ${isEn ? 'Your browser does not support the video tag.' : 'Votre navigateur ne supporte pas la lecture vidéo.'}
                </video>
            `;
        } else {
            podMediaContainer.innerHTML = `
                <img src="${fullSrc}" alt="${currentModel.title || 'Modèle 3D'}" class="pod-active-media" loading="lazy">
            `;
        }

        // Mise à jour des vignettes actives
        if (podThumbnails) {
            const thumbs = podThumbnails.querySelectorAll(".pod-thumb");
            thumbs.forEach((t, i) => {
                t.classList.toggle("active", i === currentMediaIndex);
            });
        }
    }

    // 6. Remplissage des vignettes du carrousel
    function setupThumbnails() {
        if (!podThumbnails || !currentModel) return;
        podThumbnails.innerHTML = "";

        const mediaList = currentModel.media && currentModel.media.length > 0
            ? currentModel.media
            : [{ type: 'image', url: currentModel.image || currentModel.localImage || currentModel.imageUrl }];

        if (mediaList.length <= 1) {
            podThumbnails.style.display = "none";
            if (podPrevBtn) podPrevBtn.style.display = "none";
            if (podNextBtn) podNextBtn.style.display = "none";
            return;
        }

        podThumbnails.style.display = "flex";
        if (podPrevBtn) podPrevBtn.style.display = "flex";
        if (podNextBtn) podNextBtn.style.display = "flex";

        mediaList.forEach((item, idx) => {
            const thumb = document.createElement("button");
            thumb.type = "button";
            thumb.className = `pod-thumb ${idx === 0 ? 'active' : ''}`;
            
            let thumbUrl = item.url || item.remoteUrl;
            if (thumbUrl.startsWith('../../../')) thumbUrl = thumbUrl.substring(9);
            else if (thumbUrl.startsWith('../../')) thumbUrl = thumbUrl.substring(6);
            else if (thumbUrl.startsWith('../')) thumbUrl = thumbUrl.substring(3);
            const fullThumb = thumbUrl.startsWith('http') ? thumbUrl : (basePath + thumbUrl);

            if (item.type === 'video') {
                thumb.innerHTML = `<i class="fa-solid fa-play"></i>`;
            } else {
                thumb.innerHTML = `<img src="${fullThumb}" alt="Thumb ${idx + 1}">`;
            }

            thumb.addEventListener("click", () => renderCarouselMedia(idx));
            podThumbnails.appendChild(thumb);
        });
    }

    // 7. Ouverture du Modal POD pour un modèle
    function openPodModal(modelId) {
        currentModel = storeModels.find(m => m.id.toString() === modelId.toString());
        if (!currentModel) {
            // Repli de secours : récupérer les métadonnées depuis la carte HTML dans le DOM
            const cardEl = document.querySelector(`.card-pod-item[data-model-id="${modelId}"]`);
            if (cardEl) {
                const title = cardEl.querySelector('h3')?.textContent?.trim() || "Modèle 3D";
                const desc = cardEl.querySelector('.client-project-desc')?.textContent?.trim() || "";
                const img = cardEl.querySelector('img')?.getAttribute('src') || "";
                const authorLink = cardEl.querySelector('.client-project-meta a');
                const author = authorLink?.textContent?.trim() || "Créateur";
                const authorUrl = authorLink?.getAttribute('href') || "#";
                currentModel = {
                    id: modelId,
                    title,
                    titre: title,
                    description: desc,
                    author,
                    auteur: author,
                    authorUrl,
                    lienAuteur: authorUrl,
                    image: img,
                    localImage: img,
                    weight: 50,
                    poids: 50,
                    printTimeMinutes: 60,
                    media: img ? [{ type: 'image', url: img }] : []
                };
            }
        }
        if (!currentModel) {
            console.error("Modèle introuvable :", modelId);
            return;
        }

        // Titre et métadonnées
        if (podModelTitle) podModelTitle.textContent = currentModel.title || currentModel.titre || "Modèle 3D";
        if (podModelAuthor) {
            const authorName = currentModel.author || currentModel.auteur || "Créateur";
            const authorUrl = currentModel.authorUrl || currentModel.lienAuteur || "#";
            podModelAuthor.innerHTML = `<i class="fa-solid fa-user-pen"></i> ${isEn ? 'By' : 'Par'} : <a href="${authorUrl}" target="_blank" rel="noopener noreferrer">${authorName}</a>`;
        }

        const weight = currentModel.weight || currentModel.poids || 50;
        const printTime = currentModel.printTimeMinutes || 60;
        if (podModelWeight) podModelWeight.innerHTML = `<i class="fa-solid fa-weight-hanging"></i> ${weight} g`;
        if (podModelTime) podModelTime.innerHTML = `<i class="fa-regular fa-clock"></i> ~${printTime} min`;

        if (podQuantity) podQuantity.value = "1";
        if (podStatusMsg) podStatusMsg.innerHTML = "";

        // Réinitialisation carrousel
        currentMediaIndex = 0;
        setupThumbnails();
        renderCarouselMedia(0);

        // Recalcul initial du prix
        calculatePrice();

        // Affichage modal
        if (podModal) {
            podModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    }

    function closePodModal() {
        if (podModal) {
            podModal.classList.remove("active");
            document.body.style.overflow = "";
        }
        currentModel = null;
    }

    // ==========================================================
    // LOGIQUE DU SÉLECTEUR VISUEL DE FILAMENTS (MODAL GALLERY)
    // ==========================================================

    // Obtenir la liste distincte des matériaux en stock
    function getAvailableMaterials() {
        const mats = new Set();
        filaments.forEach(f => {
            if (f.materiau) mats.add(f.materiau.trim());
        });
        return Array.from(mats);
    }

    // Génération dynamique des onglets de filtres dans le picker
    function renderMaterialTabs() {
        if (!filamentPickerTabs) return;
        filamentPickerTabs.innerHTML = "";

        const allBtn = document.createElement("button");
        allBtn.type = "button";
        allBtn.className = `filament-picker-tab ${activeMaterialFilter === 'all' ? 'active' : ''}`;
        allBtn.textContent = isEn ? "All Materials" : "Tous les matériaux";
        allBtn.dataset.mat = "all";
        filamentPickerTabs.appendChild(allBtn);

        const materials = getAvailableMaterials();
        const lockedMat = (activePickingSlot === 2 && selectedColor1) ? (selectedColor1.materiau || '').toLowerCase().trim() : null;

        materials.forEach(mat => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `filament-picker-tab ${activeMaterialFilter === mat ? 'active' : ''}`;
            btn.textContent = mat;
            btn.dataset.mat = mat;

            // Si on est en train de choisir la couleur 2, les autres matériaux sont désactivés
            if (lockedMat && mat.toLowerCase().trim() !== lockedMat) {
                btn.classList.add("disabled");
                btn.title = isEn ? `Locked to ${selectedColor1.materiau}` : `Verrouillé sur ${selectedColor1.materiau}`;
            }

            filamentPickerTabs.appendChild(btn);
        });
    }

    // Rendu de la grille de filaments
    function renderFilamentGrid() {
        if (!filamentPickerGrid) return;
        filamentPickerGrid.innerHTML = "";

        const lockedMat = (activePickingSlot === 2 && selectedColor1) 
            ? (selectedColor1.materiau || '').toLowerCase().trim() 
            : null;

        const currentSelectedId = activePickingSlot === 1 
            ? (selectedColor1 ? selectedColor1.id : null) 
            : (selectedColor2 ? selectedColor2.id : null);

        let filtered = filaments.filter(f => {
            // Filtre par onglet matériau (si pas Slot 2 verrouillé)
            if (activeMaterialFilter !== 'all') {
                if ((f.materiau || '').toLowerCase().trim() !== activeMaterialFilter.toLowerCase().trim()) {
                    return false;
                }
            }
            // Filtre par recherche textuelle
            if (activeSearchQuery) {
                const q = activeSearchQuery.toLowerCase();
                const matchName = (f.nom || '').toLowerCase().includes(q);
                const matchMat = (f.materiau || '').toLowerCase().includes(q);
                const matchBrand = (f.marque || '').toLowerCase().includes(q);
                const matchColor = (f.couleur || '').toLowerCase().includes(q);
                if (!matchName && !matchMat && !matchBrand && !matchColor) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            filamentPickerGrid.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--couleur-texte-secondaire);">
                    <i class="fa-solid fa-box-open" style="font-size: 2.2rem; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
                    <p style="margin: 0; font-size: 1rem;">${isEn ? 'No matching filaments found in stock.' : 'Aucun filament correspondant disponible en stock.'}</p>
                </div>
            `;
            return;
        }

        filtered.forEach(f => {
            const card = document.createElement("div");
            card.className = "filament-card-pickable";
            card.dataset.filamentId = f.id;

            const isSelected = currentSelectedId && f.id === currentSelectedId;
            if (isSelected) card.classList.add("selected");

            // Règle stricte : verrouillage du matériau pour le Slot 2
            const isMatIncompatible = lockedMat && (f.materiau || '').toLowerCase().trim() !== lockedMat;
            if (isMatIncompatible) {
                card.classList.add("disabled");
                card.title = isEn 
                    ? `Cannot mix ${f.materiau} with ${selectedColor1.materiau}` 
                    : `Incompatible : mélange impossible avec le ${selectedColor1.materiau}`;
            }

            const imgUrl = resolveFilamentImgUrl(f.image);
            const hex = f.codeHex || f.couleur || "#7C3AED";
            const hexSafe = hex.startsWith("#") ? hex : "#7C3AED";
            const priceKg = f.prixKg ? `${f.prixKg} €/kg` : `${((f.prixGramme || 0.022) * 1000).toFixed(0)} €/kg`;
            const brand = f.marque || "Objex";

            card.innerHTML = `
                <div class="filament-pick-check-indicator"><i class="fa-solid fa-check"></i></div>
                <div class="filament-pick-img-wrap">
                    <img src="${imgUrl}" alt="${f.nom}" class="filament-pick-img" loading="lazy">
                    <span class="filament-pick-badge">${f.materiau || 'PLA'}</span>
                </div>
                <div class="filament-pick-body">
                    <div class="filament-pick-color-row">
                        <span class="color-dot" style="background-color: ${hexSafe}; width: 14px; height: 14px; border: 1px solid rgba(0,0,0,0.2);"></span>
                        <h4 class="filament-pick-title" title="${f.nom}">${f.nom}</h4>
                    </div>
                    <div class="filament-pick-meta">
                        <span><i class="fa-solid fa-tag"></i> ${brand}</span>
                        <span><strong>${priceKg}</strong></span>
                    </div>
                </div>
            `;

            if (!isMatIncompatible) {
                card.addEventListener("click", () => selectFilament(f));
            }

            filamentPickerGrid.appendChild(card);
        });
    }

    // Sélection d'un filament depuis la grille
    function selectFilament(f) {
        if (activePickingSlot === 1) {
            selectedColor1 = f;
            updateColorSlotDisplay(1);
            syncHiddenSelect();

            // Si la couleur 2 est déjà sélectionnée mais avec un matériau incompatible, la réaligner
            if (selectedColor2 && (selectedColor2.materiau || '').toLowerCase().trim() !== (f.materiau || '').toLowerCase().trim()) {
                const sameMat = filaments.filter(item => (item.materiau || '').toLowerCase().trim() === (f.materiau || '').toLowerCase().trim() && item.id !== f.id);
                selectedColor2 = sameMat.length > 0 ? sameMat[0] : f;
                updateColorSlotDisplay(2);
            }
        } else {
            selectedColor2 = f;
            updateColorSlotDisplay(2);
        }

        calculatePrice();
        closeFilamentPicker();
    }

    // Ouverture de la modal sélecteur de filaments
    function openFilamentPicker(slot = 1) {
        activePickingSlot = slot;
        activeSearchQuery = "";
        if (filamentPickerSearch) filamentPickerSearch.value = "";

        if (activePickingSlot === 2 && selectedColor1) {
            // Verrouillage de l'onglet sur le matériau de la couleur 1
            activeMaterialFilter = (selectedColor1.materiau || 'all').trim();
            if (filamentPickerTitle) {
                filamentPickerTitle.textContent = isEn ? "Select Secondary Color" : "Sélectionnez la 2ème couleur";
            }
            if (filamentPickerDesc) {
                filamentPickerDesc.innerHTML = isEn 
                    ? `Only <strong>${selectedColor1.materiau}</strong> filaments are available to ensure perfect layer fusion.` 
                    : `Seuls les filaments en <strong>${selectedColor1.materiau}</strong> sont compatibles pour garantir l'adhérence thermique.`;
            }
        } else {
            activeMaterialFilter = "all";
            if (filamentPickerTitle) {
                filamentPickerTitle.textContent = isEn ? "Select Primary Color" : "Sélectionnez votre filament de précision";
            }
            if (filamentPickerDesc) {
                filamentPickerDesc.textContent = isEn 
                    ? "Choose from our high-precision spools available in the workshop." 
                    : "Choisissez parmi nos bobines haute précision disponibles à l'atelier.";
            }
        }

        renderMaterialTabs();
        renderFilamentGrid();

        if (filamentPickerModal) {
            filamentPickerModal.classList.add("active");
        }
    }

    function closeFilamentPicker() {
        if (filamentPickerModal) {
            filamentPickerModal.classList.remove("active");
        }
    }

    // Événements pour le Sélecteur de Filaments
    if (btnPickColor1) {
        btnPickColor1.addEventListener("click", () => openFilamentPicker(1));
    }
    const color1Display = document.getElementById("pod-color1-display");
    if (color1Display) {
        color1Display.addEventListener("click", (e) => {
            if (!e.target.closest("#btn-pick-color1")) openFilamentPicker(1);
        });
    }

    if (btnPickColor2) {
        btnPickColor2.addEventListener("click", () => openFilamentPicker(2));
    }
    const color2Display = document.getElementById("pod-color2-display");
    if (color2Display) {
        color2Display.addEventListener("click", (e) => {
            if (!e.target.closest("#btn-pick-color2")) openFilamentPicker(2);
        });
    }

    if (filamentPickerClose) {
        filamentPickerClose.addEventListener("click", closeFilamentPicker);
    }

    if (filamentPickerModal) {
        filamentPickerModal.addEventListener("click", (e) => {
            if (e.target === filamentPickerModal) closeFilamentPicker();
        });
    }

    // Écouteur onglets de matériaux dans le picker
    if (filamentPickerTabs) {
        filamentPickerTabs.addEventListener("click", (e) => {
            const btn = e.target.closest(".filament-picker-tab");
            if (!btn || btn.classList.contains("disabled")) return;
            activeMaterialFilter = btn.dataset.mat || "all";
            renderMaterialTabs();
            renderFilamentGrid();
        });
    }

    // Recherche instantanée dans le picker
    if (filamentPickerSearch) {
        filamentPickerSearch.addEventListener("input", (e) => {
            activeSearchQuery = e.target.value.trim();
            renderFilamentGrid();
        });
    }

    // Toggle Bicolore
    if (podBicolorCheckbox) {
        podBicolorCheckbox.addEventListener("change", (e) => {
            isBicolorActive = e.target.checked;
            if (podSlotColor2) {
                podSlotColor2.style.display = isBicolorActive ? "block" : "none";
            }
            if (isBicolorActive && (!selectedColor2 || (selectedColor1 && (selectedColor2.materiau || '').toLowerCase().trim() !== (selectedColor1.materiau || '').toLowerCase().trim()))) {
                const sameMat = filaments.filter(f => (f.materiau || '').toLowerCase().trim() === (selectedColor1.materiau || '').toLowerCase().trim() && f.id !== selectedColor1.id);
                selectedColor2 = sameMat.length > 0 ? sameMat[0] : selectedColor1;
                updateColorSlotDisplay(2);
            }
            calculatePrice();
        });
    }

    // 8. Écouteurs d'événements du Carrousel et du Calculateur
    if (podPrevBtn) {
        podPrevBtn.addEventListener("click", () => renderCarouselMedia(currentMediaIndex - 1));
    }
    if (podNextBtn) {
        podNextBtn.addEventListener("click", () => renderCarouselMedia(currentMediaIndex + 1));
    }
    if (podFilamentSelect) {
        podFilamentSelect.addEventListener("change", calculatePrice);
    }
    if (podQuantity) {
        podQuantity.addEventListener("input", calculatePrice);
    }

    const uberQtyMinus = document.getElementById("uber-qty-minus");
    const uberQtyPlus = document.getElementById("uber-qty-plus");
    if (uberQtyMinus && podQuantity) {
        uberQtyMinus.addEventListener("click", () => {
            let current = parseInt(podQuantity.value || 1, 10);
            if (current > 1) {
                podQuantity.value = current - 1;
                podQuantity.dispatchEvent(new Event("input", { bubbles: true }));
            }
        });
    }
    if (uberQtyPlus && podQuantity) {
        uberQtyPlus.addEventListener("click", () => {
            let current = parseInt(podQuantity.value || 1, 10);
            if (current < 100) {
                podQuantity.value = current + 1;
                podQuantity.dispatchEvent(new Event("input", { bubbles: true }));
            }
        });
    }

    // Clic sur l'ensemble de la carte d'option pour ouvrir le sélecteur
    const slot1Card = document.getElementById("pod-slot-color1");
    if (slot1Card) {
        slot1Card.addEventListener("click", (e) => {
            if (!e.target.closest("#btn-pick-color1")) openFilamentPicker(1);
        });
    }
    const slot2Card = document.getElementById("pod-slot-color2");
    if (slot2Card) {
        slot2Card.addEventListener("click", (e) => {
            if (!e.target.closest("#btn-pick-color2")) openFilamentPicker(2);
        });
    }

    if (podModalClose) {
        podModalClose.addEventListener("click", closePodModal);
    }
    if (podModal) {
        podModal.addEventListener("click", (e) => {
            if (e.target === podModal) closePodModal();
        });
    }

    // Touches clavier pour fermer et naviguer dans le carrousel
    document.addEventListener("keydown", (e) => {
        if (filamentPickerModal && filamentPickerModal.classList.contains("active")) {
            if (e.key === "Escape") {
                closeFilamentPicker();
                return;
            }
        }
        if (podModal && podModal.classList.contains("active")) {
            if (e.key === "Escape") closePodModal();
            else if (e.key === "ArrowLeft") renderCarouselMedia(currentMediaIndex - 1);
            else if (e.key === "ArrowRight") renderCarouselMedia(currentMediaIndex + 1);
        }
        if (customModal && customModal.classList.contains("active")) {
            if (e.key === "Escape") closeCustomModal();
        }
    });

    // Clics sur les boutons "Configurer & Commander" dans la galerie
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-open-pod-modal, .btn-configure-pod, .card-pod-item");
        if (btn) {
            const modelId = btn.dataset.modelId || btn.getAttribute("data-model-id");
            if (modelId) {
                e.preventDefault();
                openPodModal(modelId);
            }
        }
    });

    // 9. Gestion de la soumission de commande POD (n8n Webhook -> Repli mailto:)
    if (podOrderForm) {
        podOrderForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentModel) return;

            const pricing = calculatePrice();
            const prenom = (document.getElementById("pod-firstname")?.value || "").trim();
            const nom = (document.getElementById("pod-lastname")?.value || "").trim();
            const email = (document.getElementById("pod-email")?.value || "").trim();
            const notes = (document.getElementById("pod-notes")?.value || "").trim();

            const c1 = selectedColor1 || { nom: "PLA Standard", materiau: "PLA", codeHex: "#7C3AED", marque: "Objex" };
            const c2 = isBicolorActive ? (selectedColor2 || c1) : null;

            const formattedFilamentSummary = isBicolorActive
                ? `${c1.nom} [${c1.marque || 'Objex'}] + ${c2.nom} [${c2.marque || 'Objex'}] (Bicolore)`
                : `${c1.nom} [${c1.marque || 'Objex'}]`;

            const orderPayload = {
                type: "print_on_demand",
                date: new Date().toISOString(),
                client: {
                    prenom,
                    nom,
                    email
                },
                modele: {
                    id: currentModel.id,
                    titre: currentModel.title || currentModel.titre,
                    urlSource: currentModel.url || currentModel.urlSource,
                    auteur: currentModel.author || currentModel.auteur,
                    poidsGrammes: pricing.weight,
                    profil: currentModel.profileTitle || "Standard"
                },
                configuration: {
                    isBicolor: isBicolorActive,
                    filamentNom: formattedFilamentSummary,
                    filamentMateriau: c1.materiau || "PLA",
                    filamentCouleur: c1.codeHex || c1.couleur || "#7C3AED",
                    filament1: {
                        id: c1.id,
                        nom: c1.nom,
                        materiau: c1.materiau,
                        couleur: c1.couleur || c1.codeHex,
                        marque: c1.marque
                    },
                    filament2: isBicolorActive ? {
                        id: c2.id,
                        nom: c2.nom,
                        materiau: c2.materiau,
                        couleur: c2.couleur || c2.codeHex,
                        marque: c2.marque
                    } : null,
                    prixGramme: pricing.priceGram,
                    quantite: pricing.qty,
                    prixUnitaire: pricing.unitPrice,
                    prixTotal: pricing.totalPrice
                },
                instructions: notes
            };

            // État de chargement
            if (podSubmitBtn) {
                podSubmitBtn.disabled = true;
                podSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Sending...' : 'Envoi en cours...'}`;
            }

            const webhookUrl = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.N8N_WEBHOOK_URL) || "https://n8n.objex3d.com/webhook/commande-print-on-demand";
            const contactEmail = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.CONTACT_EMAIL) || "objex3d@gmail.com";
            const timeoutMs = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.WEBHOOK_TIMEOUT_MS) || 5000;

            let success = false;
            try {
                // Tentative silencieuse d'envoi vers le Webhook n8n avec timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(orderPayload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    success = true;
                    let resData = null;
                    try {
                        resData = await response.json();
                    } catch (e) {}
                    const ticketRef = resData && (resData.order_reference || resData.ticket_id);
                    const toastMsg = ticketRef
                        ? (isEn ? `Order confirmed! Reference: ${ticketRef}` : `Commande transmise à l'atelier ! Réf: ${ticketRef}`)
                        : (isEn ? "Your order has been transmitted to our workshop!" : "Votre commande a été transmise avec succès à l'atelier !");
                    showToast(toastMsg, "success");
                    setTimeout(closePodModal, 2200);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (err) {
                console.warn("⚠️ Échec d'envoi Webhook n8n (mode résilient activé):", err.message);

                // Construction URI mailto propre avec %0D%0A pour le client mail
                const subject = encodeURIComponent(`[Commande Objex3D] ${orderPayload.modele.titre} - ${prenom} ${nom}`);
                const bodyText = [
                    isEn ? "Hello Objex3D," : "Bonjour l'équipe Objex3D,",
                    "",
                    isEn ? "I would like to place an order for the following 3D print:" : "Je souhaite passer commande pour l'impression 3D suivante :",
                    "",
                    "========================================",
                    isEn ? "DÉTAILS DU MODÈLE" : "DÉTAILS DU MODÈLE",
                    "========================================",
                    `- ${isEn ? 'Model' : 'Modèle'} : ${orderPayload.modele.titre}`,
                    `- ${isEn ? 'Link' : 'Lien source'} : ${orderPayload.modele.urlSource}`,
                    `- ${isEn ? 'Weight' : 'Poids estimé'} : ${orderPayload.modele.poidsGrammes} g`,
                    `- ${isEn ? 'Filament' : 'Filament sélectionné'} : ${formattedFilamentSummary}`,
                    `- ${isEn ? 'Quantity' : 'Quantité'} : ${orderPayload.configuration.quantite}`,
                    `- ${isEn ? 'Total price' : 'Prix total calculé'} : ${orderPayload.configuration.prixTotal.toFixed(2)} € (TTC)`,
                    "",
                    "========================================",
                    isEn ? "COORDONNÉES CLIENT" : "COORDONNÉES CLIENT",
                    "========================================",
                    `- ${isEn ? 'Name' : 'Nom complet'} : ${prenom} ${nom}`,
                    `- Email : ${email}`,
                    `- ${isEn ? 'Special instructions' : 'Instructions particulières'} : ${notes || (isEn ? 'None' : 'Aucune')}`,
                    "",
                    isEn ? "Thank you for confirming production time and shipping." : "Merci de me confirmer la faisabilité et le délai de réalisation.",
                    "",
                    `${prenom} ${nom}`
                ].join("\n");

                const formattedBody = encodeURIComponent(bodyText).replace(/%0A/g, "%0D%0A");
                const mailtoUri = `mailto:${contactEmail}?subject=${subject}&body=${formattedBody}`;
                window.__LAST_MAILTO_URI = mailtoUri;

                showToast(isEn 
                    ? "Direct server unavailable: opening your email client with your prefilled order..." 
                    : "Serveur direct indisponible : ouverture de votre messagerie avec les détails pré-remplis...", 
                    "info"
                );

                setTimeout(() => {
                    window.location.href = mailtoUri;
                    closePodModal();
                }, 1200);
            } finally {
                if (podSubmitBtn) {
                    podSubmitBtn.disabled = false;
                    podSubmitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${isEn ? 'Confirm Order' : 'Confirmer la commande'}`;
                }
            }
        });
    }

    // 10. Gestion du Modal Projet Personnalisé / Modélisation CAO
    function openCustomModal() {
        if (customModal) {
            customModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    }

    function closeCustomModal() {
        if (customModal) {
            customModal.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    customOpenBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            openCustomModal();
        });
    });

    if (customModalClose) {
        customModalClose.addEventListener("click", closeCustomModal);
    }
    if (customModal) {
        customModal.addEventListener("click", (e) => {
            if (e.target === customModal) closeCustomModal();
        });
    }

    if (customOrderForm) {
        customOrderForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const prenom = (document.getElementById("custom-firstname")?.value || "").trim();
            const nom = (document.getElementById("custom-lastname")?.value || "").trim();
            const email = (document.getElementById("custom-email")?.value || "").trim();
            const projectType = (document.getElementById("custom-type")?.value || "Impression 3D sur-mesure");
            const details = (document.getElementById("custom-details")?.value || "").trim();

            const customPayload = {
                type: "custom_project_request",
                date: new Date().toISOString(),
                client: { prenom, nom, email },
                projetType: projectType,
                description: details
            };

            if (customSubmitBtn) {
                customSubmitBtn.disabled = true;
                customSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEn ? 'Sending...' : 'Envoi en cours...'}`;
            }

            const webhookUrl = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.N8N_WEBHOOK_URL) || "https://n8n.objex3d.com/webhook/commande-print-on-demand";
            const contactEmail = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.CONTACT_EMAIL) || "objex3d@gmail.com";
            const timeoutMs = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.WEBHOOK_TIMEOUT_MS) || 5000;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(customPayload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    let resData = null;
                    try {
                        resData = await response.json();
                    } catch (e) {}
                    const ticketRef = resData && (resData.order_reference || resData.ticket_id);
                    const toastMsg = ticketRef
                        ? (isEn ? `Request received! Ticket: ${ticketRef}` : `Demande sur-mesure enregistrée ! Ticket: ${ticketRef}`)
                        : (isEn ? "Your custom project request has been submitted!" : "Votre demande de projet sur-mesure a été envoyée !");
                    showToast(toastMsg, "success");
                    setTimeout(closeCustomModal, 2200);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (err) {
                console.warn("⚠️ Échec d'envoi Webhook n8n (repli mailto pour projet personnalisé):", err.message);

                const subject = encodeURIComponent(`[Projet Sur-Mesure / CAO] ${projectType} - ${prenom} ${nom}`);
                const bodyText = [
                    isEn ? "Hello Objex3D," : "Bonjour l'équipe Objex3D,",
                    "",
                    isEn ? "I would like to request a quote for a custom project / CAD modeling:" : "Je souhaite obtenir une étude / devis pour un projet 100% sur-mesure :",
                    "",
                    "========================================",
                    isEn ? "DÉTAILS DU PROJET" : "DÉTAILS DU PROJET",
                    "========================================",
                    `- ${isEn ? 'Project type' : 'Type de prestation'} : ${projectType}`,
                    `- ${isEn ? 'Description' : 'Description du besoin'} : ${details}`,
                    "",
                    "========================================",
                    isEn ? "COORDONNÉES" : "COORDONNÉES",
                    "========================================",
                    `- ${isEn ? 'Name' : 'Nom complet'} : ${prenom} ${nom}`,
                    `- Email : ${email}`,
                    "",
                    isEn ? "Please find enclosed or let me know how to send my 3D CAD files (STEP/STL)." : "N'hésitez pas à m'indiquer où vous transmettre mes fichiers 3D (STEP / STL / plans).",
                    "",
                    `${prenom} ${nom}`
                ].join("\n");

                const formattedBody = encodeURIComponent(bodyText).replace(/%0A/g, "%0D%0A");
                const mailtoUri = `mailto:${contactEmail}?subject=${subject}&body=${formattedBody}`;
                window.__LAST_MAILTO_URI = mailtoUri;

                showToast(isEn 
                    ? "Opening your email client with your prefilled custom project request..." 
                    : "Ouverture de votre messagerie avec les détails pré-remplis de votre projet...", 
                    "info"
                );

                setTimeout(() => {
                    window.location.href = mailtoUri;
                    closeCustomModal();
                }, 1200);
            } finally {
                if (customSubmitBtn) {
                    customSubmitBtn.disabled = false;
                    customSubmitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${isEn ? 'Send Request' : 'Envoyer ma demande sur-mesure'}`;
                }
            }
        });
    }

    // Lancement du chargement initial
    await loadData();
});
