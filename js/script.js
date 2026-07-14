document.addEventListener("DOMContentLoaded", () => {
    // 1. Gestion de la Navbar (Changement de style au scroll)
    const navbar = document.querySelector('.navbar');
    
    const handleScroll = () => {
        if (window.scrollY > 50) {
            navbar.classList.add('is-scrolled');
            document.body.classList.add('is-scrolled');
        } else {
            navbar.classList.remove('is-scrolled');
            document.body.classList.remove('is-scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    // 2. Animations au défilement (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optionnel : observer.unobserve(entry.target) si on ne veut animer qu'une fois
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach(el => observer.observe(el));

    // 3. Gestion du Menu Mobile (Burger)
    const menuToggle = document.getElementById('mobile-menu');
    const menuDroite = document.querySelector('.menu-droite');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            menuDroite.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (menuDroite.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Fermer le menu si on clique sur un lien
    const menuLinks = document.querySelectorAll('.menu-droite a');
    menuLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (menuDroite.classList.contains('active')) {
                menuDroite.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });

    // 4. Gestion du Thème (Clair/Sombre)
    const themeToggleBtn = document.getElementById('theme-toggle');
    const iconTheme = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.dataset.theme = 'dark';
        if (iconTheme) {
            iconTheme.classList.remove('fa-moon');
            iconTheme.classList.add('fa-sun');
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = document.documentElement.dataset.theme;
            if (currentTheme === 'dark') {
                delete document.documentElement.dataset.theme;
                localStorage.setItem('theme', 'light');
                iconTheme.classList.remove('fa-sun');
                iconTheme.classList.add('fa-moon');
            } else {
                document.documentElement.dataset.theme = 'dark';
                localStorage.setItem('theme', 'dark');
                iconTheme.classList.remove('fa-moon');
                iconTheme.classList.add('fa-sun');
            }
        });
    }

    // 5. Système de Filtrage Dynamique (Portfolio)
    const filterBtns = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.card-podcast');

    if (filterBtns.length > 0 && projectCards.length > 0) {
        function applyFilter(btn) {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterValue = btn.dataset.filter;

            projectCards.forEach(card => {
                const category = card.dataset.category;
                if (filterValue === 'tous' || filterValue === category) {
                    card.style.display = 'flex';
                    card.classList.remove('is-visible');
                    setTimeout(() => {
                        card.classList.add('is-visible');
                    }, 50);
                } else {
                    card.style.display = 'none';
                }
            });
        }

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => applyFilter(btn));
        });
    }
});
