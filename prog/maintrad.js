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
      element.textContent = text;
    });
  }
  
  // Fonction pour obtenir le texte pour une clé spécifique et une langue donnée
  function getTextForLang(key, lang) {
    const texts = {
      'Educatif':{
        fr:'Educatif',
        en:'Educational'
      }, 
      'Professionnel':{
        fr:'Professionnel',
        en:'Professional'
      },  
      'personnel':{
        fr:'Personnel',
        en:'Personal '
      },
      
      'Mes-cours':{
        fr:'Mes cours',
        en:'My classes '
      },

      'Mes-projets':{
        fr:'Mes projets personnels',
        en:'My personal projects'
      },

      'guide-mersure':{
        fr:'Le guide de la mersure',
        en:'The mesure guide '
      },

      'Mon-CV':{
        fr:'Mon CV',
        en:'My Résumé '
      },
      
       'ou-me-trouver':{
        fr:'Oû me trouver',
        en:'Where to find me '
      },

      'about-me': {
        fr: 'Étudiant en deuxième année de BUT GEII à Salon-de-Provence, je suis passionné par la conception d\'objets techniques et la création de solutions innovantes.',
        en: 'Second-year student in BUT GEII at Salon-de-Provence, I am passionate about designing technical objects and creating innovative solutions.'
      },
      // Ajoutez plus de clés et de textes en fonction de vos besoins
    };
  
    return texts[key] ? texts[key][lang] : '';
  }
  
  // Charge la langue préférée de l'utilisateur
  function loadPreferredLang() {
    const storedLang = localStorage.getItem('lang');
    if (storedLang) {
      changeLang(storedLang);
    }
  }
  
  // Appelle la fonction pour charger la langue préférée lors du chargement de la page
  loadPreferredLang();
  