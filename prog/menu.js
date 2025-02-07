const hamburger = document.getElementById('hamburger');
const menu = document.getElementById('menu');

hamburger.addEventListener('click', () => {
    menu.classList.toggle('active');  // Ajoute ou enlève la classe active sur le menu
});

// Ferme le menu si on clique en dehors de celui-ci
document.addEventListener('click', (event) => {
    const isClickInsideMenu = menu.contains(event.target);
    const isClickOnHamburger = hamburger.contains(event.target);

    if (!isClickInsideMenu && !isClickOnHamburger) {
        menu.classList.remove('active'); // Ferme le menu
    }
});
