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

        'Accueil': { fr: 'Accueil', en: 'Home' },
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



        'bouton': { fr: 'Voir plus', en: 'See more' },

        'description1': { 
            fr: 'Le projet vise à recréer les boutons cassés d\'un micro-ondes grâce à l\'impression 3D. Un modèle précis a été conçu pour assurer compatibilité et durabilité. Cette solution est économique et adaptée aux besoins du client.', 
            en: 'The project aims to recreate the broken buttons of a microwave using 3D printing. A precise model has been designed to ensure compatibility and durability. This solution is cost-effective and tailored to the client\'s needs.' 
        },
        'description2': { 
            fr: 'le projet vise à améliorer un modèle trouvé sur internet pour mieux l\'intégrer dans mon environnement domotique', 
            en: 'The project aims to enhance a model found online to better integrate it into my home automation environment.' 
        },
        'description3': { 
            fr: 'Ce projet a pour but de mettre deux meubles à la même hauteur', 
            en: 'The aim of this project is to adjust two pieces of furniture to the same height.' 
        },
        'description4': { 
            fr: 'Ce projet avait pour but de fabriquer un robot suiveur de ligne pour ensuite le faire participer a un concours ', 
            en: 'The aim of this project is to adjust two pieces of furniture to the same height.' 
        },
        'description5': { 
            fr: 'Un client m\'a demandé de concevoir et imprimer un casier pour son camping car', 
            en: 'A client asked me to design and 3D print a storage compartment for their camper van.' 
        },
        'description6': { 
            fr: 'Je vous montre comment et pourquoi j\'ai fabriqué ma propre box domotique', 
            en: 'Let me show you how and why I built my own home automation hub.' 
        },
        
        'titre1': { fr: 'Bouton de micro-onde', en: 'Microwave button' },
        'titre2': { fr: 'Réacteur ARK', en: 'ARK reactor' },
        'titre3': { fr: 'Pied de meuble', en: 'Furniture leg' },
        'titre4': { fr: 'Robot suiveur de ligne', en: 'Line-following robot' },
        'titre5': { fr: 'Casier camping car', en: 'Motorhome casier' },
        'titre6': { fr: 'Box domotique', en: 'Home automation box' },
        

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
