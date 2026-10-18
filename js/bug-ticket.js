/**
 * Objex3D - Module de signalement de bug & tickets support
 * Permet aux visiteurs de remonter un problème technique sur le site
 */
(function() {
    if (window.__objexBugTicketLoaded) return;
    window.__objexBugTicketLoaded = true;

    const isEn = document.documentElement.lang === 'en' || window.location.pathname.includes('/en/');

    const i18n = {
        fr: {
            title: "Signaler un problème ou un bug",
            subtitle: "Un problème d'affichage, un bouton inopérant ou une erreur ? Aidez-nous à améliorer le site en nous décrivant l'anomalie.",
            nameLabel: "Votre nom (optionnel)",
            namePlaceholder: "Robin Dupont",
            emailLabel: "Votre adresse email *",
            emailPlaceholder: "votre.email@exemple.com",
            categoryLabel: "Type d'anomalie *",
            categories: [
                "Problème d'affichage / Responsive mobile",
                "Formulaire ou processus de commande",
                "Bouton, lien ou modal bloqué",
                "Erreur de contenu ou image manquante",
                "Autre problème ou suggestion"
            ],
            pageLabel: "Page concernée",
            descLabel: "Description du problème rencontré *",
            descPlaceholder: "Expliquez ce qui s'est passé, les étapes pour reproduire le bug ou ce qui ne s'affiche pas correctement...",
            legalNotice: "Données transmises directement à l'atelier pour la correction technique du site.",
            submitBtn: "Envoyer le ticket de bug",
            submitting: "Envoi du ticket en cours...",
            successMsg: "Merci ! Votre signalement a bien été transmis. Nous allons intervenir au plus vite.",
            errorMsg: "Impossible de joindre le serveur. Ouverture de votre messagerie pour transmettre le rapport...",
            floatingTitle: "Signaler un bug",
            closeAria: "Fermer le formulaire de signalement"
        },
        en: {
            title: "Report an Issue or Bug",
            subtitle: "Encountered a display glitch, a broken button, or an error? Help us fix it by sharing what happened.",
            nameLabel: "Your Name (optional)",
            namePlaceholder: "John Doe",
            emailLabel: "Your Email Address *",
            emailPlaceholder: "your.email@example.com",
            categoryLabel: "Issue Category *",
            categories: [
                "Mobile / Responsive Display Issue",
                "Order or Form Problem",
                "Broken Button, Link, or Modal",
                "Missing Content or Broken Image",
                "Other Issue or Suggestion"
            ],
            pageLabel: "Affected Page",
            descLabel: "Detailed Description *",
            descPlaceholder: "Describe what happened, steps to reproduce the bug, or what was not displayed properly...",
            legalNotice: "Information sent directly to the webmaster for technical site fixes.",
            submitBtn: "Submit Bug Ticket",
            submitting: "Sending ticket...",
            successMsg: "Thank you! Your bug report has been submitted. We will investigate promptly.",
            errorMsg: "Server unreachable. Opening your email client to send the bug report...",
            floatingTitle: "Report a bug",
            closeAria: "Close bug report modal"
        }
    };

    const t = isEn ? i18n.en : i18n.fr;

    function injectBugTicketUI() {
        if (document.getElementById('bug-ticket-modal')) return;

        // 1. Modal Overlay & Dialog
        const modalHtml = `
        <div id="bug-ticket-modal" class="pod-modal-overlay" style="z-index: 10000;">
            <div class="pod-modal-dialog bug-ticket-dialog" style="max-width: 580px;">
                <button type="button" id="bug-modal-close" class="pod-modal-close" aria-label="${t.closeAria}"><i class="fa-solid fa-xmark"></i></button>
                <div class="custom-modal-content" style="padding: 30px;">
                    <div class="pod-header-info" style="margin-bottom: 20px;">
                        <span class="pod-badge-tag" style="background: #ef4444; color: #fff;"><i class="fa-solid fa-bug"></i> Support Technique</span>
                        <h2 class="pod-dialog-title" style="font-size: 1.5rem; margin-top: 8px;">${t.title}</h2>
                        <p style="color: var(--couleur-texte-secondaire); font-size: 0.9rem; margin-top: 6px;">${t.subtitle}</p>
                    </div>

                    <form id="bug-ticket-form" class="pod-form">
                        <div class="uber-form-row">
                            <div class="uber-field">
                                <label for="bug-user-name">${t.nameLabel}</label>
                                <input type="text" id="bug-user-name" class="uber-input" placeholder="${t.namePlaceholder}">
                            </div>
                            <div class="uber-field">
                                <label for="bug-user-email">${t.emailLabel}</label>
                                <input type="email" id="bug-user-email" class="uber-input" placeholder="${t.emailPlaceholder}" required>
                            </div>
                        </div>

                        <div class="uber-field" style="margin-top: 12px;">
                            <label for="bug-category">${t.categoryLabel}</label>
                            <select id="bug-category" class="uber-input" style="cursor: pointer;" required>
                                ${t.categories.map((cat, idx) => `<option value="${cat}" ${idx === 0 ? 'selected' : ''}>${cat}</option>`).join('')}
                            </select>
                        </div>

                        <div class="uber-field" style="margin-top: 12px;">
                            <label for="bug-page">${t.pageLabel}</label>
                            <input type="text" id="bug-page" class="uber-input" readonly value="${window.location.pathname}">
                        </div>

                        <div class="uber-field" style="margin-top: 12px;">
                            <label for="bug-description">${t.descLabel}</label>
                            <textarea id="bug-description" class="uber-input uber-textarea" rows="4" placeholder="${t.descPlaceholder}" required></textarea>
                        </div>

                        <p class="form-legal-notice" style="margin: 14px 0 16px 0;">
                            <i class="fa-solid fa-shield-halved"></i> ${t.legalNotice}
                        </p>

                        <div id="bug-ticket-status" class="pod-status-msg" style="margin-bottom: 12px;"></div>

                        <button type="submit" id="bug-submit-btn" class="btn-brutal" style="width: 100%; background: #ef4444; border-color: #dc2626; color: #fff; padding: 14px; font-size: 1.05rem;">
                            <i class="fa-solid fa-paper-plane" style="margin-right: 8px;"></i>${t.submitBtn}
                        </button>
                    </form>
                </div>
            </div>
        </div>`;

        // 2. Floating bug button in bottom-left
        const floatingBtnHtml = `
        <button type="button" class="floating-bug-btn" id="floating-bug-btn" title="${t.floatingTitle}" aria-label="${t.floatingTitle}">
            <i class="fa-solid fa-bug"></i>
            <span class="floating-bug-text">${t.floatingTitle}</span>
        </button>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.insertAdjacentHTML('beforeend', floatingBtnHtml);

        setupBugTicketListeners();
    }

    function setupBugTicketListeners() {
        const modal = document.getElementById('bug-ticket-modal');
        const closeBtn = document.getElementById('bug-modal-close');
        const form = document.getElementById('bug-ticket-form');
        const statusMsg = document.getElementById('bug-ticket-status');
        const submitBtn = document.getElementById('bug-submit-btn');
        const floatingBtn = document.getElementById('floating-bug-btn');

        function openModal() {
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                const pageInput = document.getElementById('bug-page');
                if (pageInput) {
                    pageInput.value = window.location.href;
                }
            }
        }

        function closeModal() {
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                closeModal();
            }
        });

        if (floatingBtn) {
            floatingBtn.addEventListener('click', openModal);
        }

        // Connect any existing or dynamic buttons with .btn-open-bug-ticket
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-open-bug-ticket');
            if (btn) {
                e.preventDefault();
                openModal();
            }
        });

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const name = document.getElementById('bug-user-name').value.trim();
                const email = document.getElementById('bug-user-email').value.trim();
                const category = document.getElementById('bug-category').value;
                const page = document.getElementById('bug-page').value;
                const description = document.getElementById('bug-description').value.trim();

                if (!email || !description) {
                    statusMsg.className = 'pod-status-msg status-error';
                    statusMsg.textContent = isEn ? "Please fill in all required fields." : "Veuillez renseigner les champs obligatoires.";
                    return;
                }

                submitBtn.disabled = true;
                const originalBtnHtml = submitBtn.innerHTML;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>${t.submitting}`;
                statusMsg.className = 'pod-status-msg';
                statusMsg.textContent = '';

                const ticketPayload = {
                    type: "bug_ticket",
                    client_nom: name || "Anonyme",
                    client_email: email,
                    categorie: category,
                    page_concernee: page,
                    description: description,
                    navigateur: navigator.userAgent,
                    resolution: `${window.innerWidth}x${window.innerHeight} (dpr: ${window.devicePixelRatio || 1})`,
                    langue: navigator.language || 'fr',
                    theme: document.documentElement.dataset.theme || 'light',
                    date_creation: new Date().toISOString()
                };

                const webhookUrl = (window.OBJEX_CONFIG && window.OBJEX_CONFIG.N8N_BUG_TICKET_WEBHOOK_URL)
                    ? window.OBJEX_CONFIG.N8N_BUG_TICKET_WEBHOOK_URL
                    : "https://yelp-bakeshop-repaying.ngrok-free.dev/webhook/ticket-bug";

                let success = false;

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000);

                    const response = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(ticketPayload),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        success = true;
                    }
                } catch (err) {
                    console.warn('[Objex3D Support] Échec webhook, passage en fallback mailto:', err);
                }

                if (success) {
                    statusMsg.className = 'pod-status-msg status-success';
                    statusMsg.textContent = t.successMsg;
                    form.reset();
                    submitBtn.innerHTML = originalBtnHtml;
                    submitBtn.disabled = false;
                    setTimeout(() => {
                        closeModal();
                        statusMsg.textContent = '';
                    }, 2200);
                } else {
                    // Fallback mailto fiable
                    statusMsg.className = 'pod-status-msg status-info';
                    statusMsg.textContent = t.errorMsg;

                    const subject = encodeURIComponent(`[Bug Report] ${category} - ${page}`);
                    const body = encodeURIComponent(
                        `Signalement de bug :\n` +
                        `-------------------\n` +
                        `Nom : ${name}\n` +
                        `Email : ${email}\n` +
                        `Catégorie : ${category}\n` +
                        `Page : ${page}\n` +
                        `Résolution : ${window.innerWidth}x${window.innerHeight}\n` +
                        `Navigateur : ${navigator.userAgent}\n\n` +
                        `Description du problème :\n${description}\n`
                    );

                    window.location.href = `mailto:objex3d@gmail.com?subject=${subject}&body=${body}`;

                    setTimeout(() => {
                        submitBtn.innerHTML = originalBtnHtml;
                        submitBtn.disabled = false;
                        closeModal();
                    }, 2500);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectBugTicketUI);
    } else {
        injectBugTicketUI();
    }
})();
