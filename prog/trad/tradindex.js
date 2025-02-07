function changeLang(lang) {
    // Change la langue du site
    document.documentElement.lang = lang;

    // Stocke la langue sélectionnée dans le localStorage
    localStorage.setItem('lang', lang);

    // Met à jour les textes pour la nouvelle langue
    updateTexts(lang);
}

// Fonction pour mettre à jour les textes en fonction de la langue sélectionnée
function updateTexts(lang) {
    // Parcourez tous les éléments avec l'attribut 'data-i18n'
    const translatableElements = document.querySelectorAll('[data-i18n]');

    translatableElements.forEach((element) => {
        const key = element.getAttribute('data-i18n');
        const text = getTextForLang(key, lang);
        if (text) {
            element.textContent = text;
        }
    });
}

// Fonction pour obtenir le texte pour une clé spécifique et une langue donnée
function getTextForLang(key, lang) {
    const texts = {

        'Educatif': { fr: 'Éducatif', en: 'Educational' },
        'Professionnel': { fr: 'Professionnel', en: 'Professional' },
        'personnel': { fr: 'Personnel', en: 'Personal' },
        'Mes-cours': { fr: 'Mes cours', en: 'My classes' },
        'Mes-projets': { fr: 'Mes projets personnels', en: 'Personal projects' },
        'guide-mersure': { fr: 'Le guide de la mesure', en: 'Measurement guide' },
        'Mon-CV': { fr: 'Mon CV', en: 'My CV' },
        'ou-me-trouver': { fr: 'Où me trouver', en: 'Where to find me' },
        'about-me': {
            fr: 'Étudiant en deuxième année de BUT GEII à Salon-de-Provence, je suis passionné par la conception d\'objets techniques et la création de solutions innovantes.',
            en: 'Second-year student in BUT GEII at Salon-de-Provence, I am passionate about designing technical objects and creating innovative solutions.'
        },



        'titre': { fr: 'MON PORTFOLIO', en: 'MY PORTFOLIO' },
        'Bienvenue': { fr: 'Je suis ravi de vous accueillir. Découvrez mes services et mes compétences.', en: 'I’m delighted to welcome you. Discover my services and skills.' },
        'Hors-Cours': { fr: 'Hors-Cours', en: 'Outside the classroom' },
        'Cours': { fr: 'Cours', en: 'In the classroom' },

    };

    return texts[key] ? texts[key][lang] || texts[key]['fr'] : key; // Retourne la clé si elle n'existe pas
}

// Charge la langue préférée de l'utilisateur
function loadPreferredLang() {
    const storedLang = localStorage.getItem('lang') || 'fr'; // Défaut en français si aucune langue n'est stockée
    document.documentElement.lang = storedLang;
    updateTexts(storedLang); // Met à jour les textes immédiatement
}

// Appelle la fonction pour charger la langue préférée lors du chargement de la page
document.addEventListener('DOMContentLoaded', loadPreferredLang);
