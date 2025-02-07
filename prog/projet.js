document.addEventListener('DOMContentLoaded', function () {
  const modal = document.querySelector('.modal');
  const modalBody = document.querySelector('.modal-content');
  const buttons = document.querySelectorAll('.open-modal');

  // Fonction pour attacher l'événement au bouton de fermeture
  function attachCloseEvent() {
      const closeBtn = document.querySelector('.close'); // Sélectionner la croix à l'intérieur du contenu chargé
      if (closeBtn) {
          closeBtn.addEventListener('click', function () {
              modal.style.display = 'none';
          });
      }
  }

  // Charger dynamiquement le contenu du projet
  buttons.forEach(button => {
      button.addEventListener('click', function () {
          const projectId = this.getAttribute('data-project'); // Récupérer l'ID du projet
          fetch(`projets/projet${projectId}.html`)  // Charger le fichier HTML
              .then(response => response.text())
              .then(data => {
                  modalBody.innerHTML = data;  // Insérer le contenu HTML dans la modale
                  modal.style.display = 'block';  // Afficher la modale
                  attachCloseEvent();  // Réattacher l'événement à la croix après avoir chargé le contenu
              })
              .catch(error => console.error('Erreur lors du chargement du projet:', error)); // Gestion des erreurs
      });
  });

  // Fermer la modale si on clique en dehors
  window.addEventListener('click', function (event) {
      if (event.target === modal) {
          modal.style.display = 'none';
      }
  });

  // Fonction pour ouvrir la modale et mettre à jour l'URL
  function openModal(projectId) {
      fetch(`projets/projet${projectId}.html`)  // Charger le fichier HTML
          .then(response => response.text())
          .then(data => {
              modalBody.innerHTML = data;  // Insérer le contenu HTML dans la modale
              modal.style.display = 'block';  // Afficher la modale
              attachCloseEvent();  // Réattacher l'événement de fermeture
              const newUrl = `${window.location.pathname}?project=${projectId}`;
              history.pushState({ projectId: projectId }, '', newUrl);  // Mettre à jour l'URL
          });
  }

  // Vérifier l'URL pour ouvrir automatiquement la modale si le paramètre "project" est présent
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project');

  if (projectId) {
      openModal(projectId);
  }

  // Gérer l'historique avec popstate (navigation arrière/avant)
  window.addEventListener('popstate', function (event) {
      if (event.state && event.state.projectId) {
          openModal(event.state.projectId); // Ouvrir la modale à partir de l'historique
      } else {
          modal.style.display = 'none'; // Fermer la modale si on revient en arrière
      }
  });
});
