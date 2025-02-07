document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.projects');
    const cards = Array.from(container.children);
    
    // Mélanger les cartes aléatoirement
    cards.sort(() => Math.random() - 0.5);
    
    // Réorganiser les cartes dans le container
    cards.forEach(card => container.appendChild(card));
});
