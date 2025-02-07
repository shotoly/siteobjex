
document.addEventListener("DOMContentLoaded", () => {
    const switchThemeBtn = document.querySelector('.changeThemeindex');

    // Récupérer le thème enregistré, ou mettre "dark" par défaut
    let currentTheme = localStorage.getItem("theme") || "dark";

    function applyTheme(theme) {
        if (theme === "dark") {
            document.documentElement.style.setProperty('--ecriture', '#FFFFFF');
            document.documentElement.style.setProperty('--background', '#0A0C10');
            document.documentElement.style.setProperty('--card', '#1D1D1D');
            document.documentElement.style.setProperty('--footer', '#26272B');
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.style.setProperty('--ecriture', '#202020');
            document.documentElement.style.setProperty('--background', '#FFFFFF');
            document.documentElement.style.setProperty('--card', '#F5F5F5');
            document.documentElement.style.setProperty('--footer', '#E0E0E0');
            localStorage.setItem("theme", "light");
        }
    }

    // Appliquer le thème (dark par défaut)
    applyTheme(currentTheme);

    // Ajouter l'écouteur d'événement pour changer le thème
    switchThemeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(currentTheme);
    });
});
