const hamburger = document.getElementById('hamburger'); // Icône du menu
const fullscreenMenu = document.getElementById('fullscreen-menu'); // Fenêtre plein écran
const closeBtn = document.getElementById('close-btn'); // Bouton de fermeture

// Ouvrir le menu plein écran lorsqu'on clique sur le hamburger
hamburger.addEventListener('click', () => {
    fullscreenMenu.classList.add('active');
});

// Fermer le menu plein écran lorsqu'on clique sur le bouton de fermeture
closeBtn.addEventListener('click', () => {
    fullscreenMenu.classList.remove('active');
});

// (Optionnel) Fermer le menu si l'utilisateur clique en dehors du menu
document.addEventListener('click', (event) => {
    if (event.target === fullscreenMenu) {
        fullscreenMenu.classList.remove('active');
    }
});
