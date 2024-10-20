document.addEventListener('DOMContentLoaded', function () {
  // Sélectionner la fenêtre modale et son contenu
  const modal = document.getElementById('projectModal');
  const modalBody = document.getElementById('modalBody');
  const closeBtn = document.querySelector('.close');
  const buttons = document.querySelectorAll('.open-modal');

  // Informations des projets
  const projectDetails = {
    1: `
    <body>
      
            <h1>Bouton de Micro-onde</h1>
            <p>Projet de réparation de boutons cassés pour un micro-ondes</p>
            <p>Date : 3 octobre 2024</p>
        
    
        <section class="context">
            <h2>Contexte</h2>
            <p>Une cliente a rencontré un problème avec les boutons de son micro-ondes, qui se sont cassés. J'ai proposé de concevoir et de réparer ces boutons.</p>
            <div class="photo-context">
            <img src="../../photo/projet perso/bouton micro onde/bouton cassée vue dessous.png" alt="Projet 1" class="project-image">
            <img src="../../photo/projet perso/bouton micro onde/bouton cassée vue dessus.png" alt="Projet 1" class="project-image">
        </div>
        </section>
    
        <section class="solution">
            <h2>Solution Proposée</h2>
            <p>La solution que j'ai proposée à la cliente consistait à récupérer les boutons endommagés afin de les reproduire fidèlement. J'ai ensuite utilisé une impression 3D avec un profil optimisé pour garantir une solidité maximale tout en maintenant des coûts de production réduits.</p>
            <div class="container-solution">
          <div class="card1">
            <p>Matériau utilisé : PLA</p>
        <p>Imprimante : Bambu Lab A1</p>
          </div>
          <div class="card2">
            <img src="../../photo/projet perso/bouton micro onde/Bambu Lab A1.png">
          </div>  
        </div>
        </section>
    
        <section class="process">
            <h2>Processus de Conception</h2>
            <p>Afin de garantir que les dimensions du futur bouton soient précises, j'ai commencé par reproduire la tige du micro-ondes, qui s'insérera dans le bouton. Cette étape était cruciale pour assurer une parfaite compatibilité entre les deux éléments.</p>
            <div class="photo-process">
            <img src="../../photo/projet perso/bouton micro onde/tige micro onde 3D.png" >
            <img src="../../photo/projet perso/bouton micro onde/tige micro impressions.png" >
            <img src="../../photo/projet perso/bouton micro onde/bouton cassée avec tige.png" >
        </div>
            <p>L'étape suivante consistait à modéliser le bouton en 3D, puis à procéder à l'impression en 3D en utilisant un profil adapté pour garantir robustesse et précision.</p>
        </section>
    <div class="photo-process">
            <img src="../../photo/projet perso/bouton micro onde/bouton 3D.png" >
            <img src="../../photo/projet perso/bouton micro onde/bouton impression.png" >
            <img src="../../photo/projet perso/bouton micro onde/timelaps_bouton.gif" >
    
        </div>
        <div class="model_fab"> <iframe title="bouton micro onde v10 v1" frameborder="0" allowfullscreen
                mozallowfullscreen="true" webkitallowfullscreen="true" allow="autoplay; fullscreen; xr-spatial-tracking"
                xr-spatial-tracking execution-while-out-of-viewport execution-while-not-rendered web-share
                src="https://sketchfab.com/models/ee2e4d1649214133bf6a6eafb3219827/embed"> </iframe>
        </div>
        <section class="conclusion">
            <h2>Conclusion</h2>
            <p>La pièce sera vendue pour un total de 5€ TTC, comprenant :</p>
            <ul>
                <li>Main d'œuvre : 1 H - 3.95€</li>
                <li>Pièces : 50 g de matériau PLA - 1.15€</li>
            </ul>
            <p>Montant total TTC : 5€</p>
        </section>
    
        
    </body>
    </html>
    
      `,
    2: `
        <body>

    <h1>Réacteur ARC - Ironman</h1>
    <p>Projet de fabrication d'une réplique du réacteur ARC d'Ironman</p>
    <p>Date : 14 août 2024</p>

    <section class="context">
        <h2>Contexte</h2>
        <p>J'ai découvert sur MakerWorld un projet fascinant de fabrication d'une réplique du réacteur ARC d'Ironman, ce qui m'a inspiré à réaliser ma propre version.</p>
        <p>Source du projet : <a href="https://makerworld.com/fr/models/467861#profileId-386697">ARC Reactor MK1 LED Lamp Kit</a></p>
        <div class="photo-context">
            <!-- Ajouter des images du projet ici -->
            <img src="../../photo/projet perso/reacteur ARK/image coeur de base sans modif.jpg" alt="Projet Ironman" class="project-image">
        </div>
    </section>

    <section class="solution">
        <h2>Solution Proposée</h2>
        <p>Passionné par la domotique et les objets connectés, j'ai décidé de rendre mon réacteur interactif. Pour cela, j'ai prévu de remplacer l’éclairage central en intégrant un module ESP8266 et des LED WS2812B pour moderniser et connecter l'appareil.</p>
        <img src="../../photo/projet perso/reacteur ARK/LEDLampRéacteur.webp" alt="Projet Ironman" class="project-image">
        <div class="container-solution">
            <div class="card1">
                <p>Matériau utilisé : PLA</p>
                <p>Imprimante : Bambu Lab A1</p>
            </div>
            <div class="card2">
                <img src="../../photo/projet perso/reacteur ARK/image.png" alt="Projet Ironman" class="project-image">
            </div>  
        </div>
    </section>

    <section class="process">
        <h2>Processus de Conception</h2>
        <p>J'ai commencé par prendre les mesures de l'ancien réacteur, puis j'ai modélisé et imprimé les nouvelles pièces en PLA avec l'imprimante 3D.</p>
        <div class="photo-process">
            <img src="../../photo/projet perso/reacteur ARK/lumiere arck v1.png" alt="Projet Ironman" class="project-image">
            <img src="../../photo/projet perso/reacteur ARK/lumiere arck v2.png" alt="Projet Ironman" class="project-image">
            <img src="../../photo/projet perso/reacteur ARK/lumiere arck tout.png" alt="Projet Ironman" class="project-image">
            <img src="">
            <img src="../../photo/projet perso/reacteur ARK/lumiere arck assamblage.png" alt="Projet Ironman" class="project-image">       
        </div>
        <p>Une fois la lampe imprimée, j'ai décidé de simplifier le contrôle des LED en flashant l'ESP avec WLED. Cela me permet de le connecter facilement au réseau et de l'intégrer à mon instance Home Assistant (HA).</p>
        <p>il ne reste plus qu'à imprimer et monter cette nouvelle version du réacteur ARK</p>
        <img src="../../photo/projet perso/reacteur ARK/vue_éxplosé.png" alt="Projet Ironman" class="project-image"> 
        <p>les parties imprimées censées représenter du cuivre seront remplacées par de vrais fils de cuivre enroulés autour de l'impression</p>
              <img src="../../photo/projet perso/reacteur ARK/plateau_composant.png" alt="Projet Ironman" class="project-image"> 
          <img src="../../photo/projet perso/reacteur ARK/starkheart2enbien.jpg" alt="Projet Ironman" class="project-image"> 
</section>
<div class="model_fab"> <iframe title="LED Lamp" frameborder="0" allowfullscreen mozallowfullscreen="true" webkitallowfullscreen="true" allow="autoplay; fullscreen; xr-spatial-tracking" xr-spatial-tracking execution-while-out-of-viewport execution-while-not-rendered web-share src="https://sketchfab.com/models/09e00ff52c8849268b1b06e56e7cc920/embed"> </iframe>
        </div>
    <section class="conclusion">
        <h2>Conclusion</h2>
        <p>l'objet coutera un total d'environ 6€ à produire au lieux de 16€ en utlisant la lampe officiel</p>
        <ul>
            <li>Filament : 90g - 2.50€</li>
            <li>Composant ESP8266 + 15 LED : 3.50€</li>
        </ul>
        <p>Montant total TTC : 6€</p>
    </section>

</body>
</html>
      `
      ,
      3: `
        <body>

    <h1>Pied de meuble</h1>
    <p>je suis desolé mais cette parie du site est encore en traveaux. le contenu correspondant arrive bientôt</p>
</body>
</html>
      `,
      4: `
        <body>

    <h1>Robot suiveur de ligne</h1>
    <p>je suis desolé mais cette parie du site est encore en traveaux. le contenu correspondant arrive bientôt</p>
</body>
</html>
      `,
      5: `
        <body>

    <h1>Casier camping car</h1>
    <p>je suis desolé mais cette parie du site est encore en traveaux. le contenu correspondant arrive bientôt</p>
</body>
</html>
      `,
      6: `
        <body>

    <h1>Box domotique</h1>
    <p>je suis desolé mais cette parie du site est encore en traveaux. le contenu correspondant arrive bientôt</p>
</body>
</html>
      `
  };

  // Fonction pour ouvrir la modale et mettre à jour l'URL
  function openModal(projectId) {
    modalBody.innerHTML = projectDetails[projectId];
    modal.style.display = 'block';

    // Mettre à jour l'URL avec le paramètre "project"
    const newUrl = `${window.location.pathname}?project=${projectId}`;
    history.pushState({ projectId: projectId }, '', newUrl);
  }

  // Fonction pour fermer la modale et remettre l'URL initiale
  function closeModal() {
    modal.style.display = 'none';

    // Remettre l'URL à son état d'origine (sans le paramètre "project")
    history.pushState({}, '', window.location.pathname);
  }

  // Associer chaque bouton à l'ouverture de la modale
  buttons.forEach(button => {
    button.addEventListener('click', function () {
      const projectId = this.closest('.project-card').getAttribute('data-project');
      openModal(projectId);
    });
  });

  // Fermer la modale avec le bouton de fermeture
  closeBtn.addEventListener('click', closeModal);

  // Fermer la modale si on clique en dehors
  window.addEventListener('click', function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  // Vérifier l'URL pour ouvrir automatiquement la modale si le paramètre "project" est présent
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project');

  if (projectId && projectDetails[projectId]) {
    openModal(projectId);
  }

  // Gérer l'historique avec popstate (navigation arrière/avant)
  window.addEventListener('popstate', function (event) {
    if (event.state && event.state.projectId) {
      openModal(event.state.projectId);
    } else {
      closeModal();
    }
  });
});
