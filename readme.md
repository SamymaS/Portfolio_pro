# Portfolio · Samy Boudaoud

Portfolio personnel en HTML, CSS et JavaScript natifs. Aucun framework, aucune étape de build, aucune dépendance à installer : les fichiers sont servis tels quels.

**En ligne :** [samy-boudaoud.com](https://samy-boudaoud.com)

---

## Ce que contient le site

**Le portfolio.** Une page unique : ouverture, fiche joueur (carte, statistiques à onglets, attributs, journal de quêtes), quatre projets mis en avant, archives filtrables, parcours, inventaire de compétences, arcade de mini-jeux et contact. FR et EN sans rechargement.

**La direction artistique « MougiCraft ».** Elle reprend la bannière et le skin Minecraft de Samy :

| Élément | Choix |
| --- | --- |
| Fond | Plan quadrillé `#0D1117` (cases de 40 px, lignes majeures de 160 px) |
| Titres | Tiny5, police pixel, majuscules, ombre bleue décalée `#1F6FEB` |
| Interface | JetBrains Mono : navigation en `./chemin`, commentaires `//`, fenêtres de code |
| Texte courant | Geist |
| Accents | Cyan `#38BDF8`, coloration syntaxique façon éditeur (mots-clés `#FF7B72`, types `#FFA657`, chaînes `#A5D6FF`, fonctions `#D2A8FF`) |
| Touches de jeu | Barre d'XP pour la lecture, niveau de section dans l'en-tête, compétences en cases d'inventaire, arcade, succès |

**L'avatar 3D.** `avatar.js` construit le personnage en voxels avec Three.js à partir du skin (`assets/mougi/skin.png`, format 64×64 classique) : base et surcouche légèrement gonflée (lunettes, veste, pantalon), texture sans lissage. Il respire, suit la souris du regard, fait coucou à l'arrivée et au clic, et tourne quand on le fait glisser. Les cotes « h = 1.8 » suivent la silhouette projetée, comme sur la bannière. Il se met en pause hors de l'écran et pendant un jeu.

**Les animations.** Défilement fluide (Lenis), nom qui apparaît par paliers, code qui s'écrit ligne par ligne, titres révélés mot à mot, README qui s'allume au fil du défilement, compteurs, frise qui se dessine (GSAP et ScrollTrigger).

**Les visuels.** Les projets mis en avant s'affichent dans des fenêtres d'application.

| Dossier | Contenu | Origine |
| --- | --- | --- |
| `assets/visuals/` | Visuels des projets mis en avant et du parcours (1200 px et 720 px) | Générés avec Figma AI, fichier « Portfolio Samy Boudaoud, assets » |
| `assets/mougi/` | Skin 64×64 et icônes de la tête (favicon, PWA) | Fournis par Samy |
| `assets/thumbs/` | Vignettes de l'index, affichées au survol (ordinateur) ou à l'ouverture d'une ligne (mobile) | Figma AI, sauf SeaRiders et TimeTravel (vraies images des projets) |
| `assets/sameva/` | Trois vrais écrans de l'application, découpés de `recherche_ui.webp` | Maquettes Sameva |

Toutes les images sont en WebP, chargées en différé (`loading="lazy"`) : environ 700 Ko au total, jamais au premier affichage.

**Deux études de cas**, Sameva et TicketFlow (`ticketflow.html`, `ticketflow.en.html`), chacune en français et en anglais. **La page Sameva**, en [français](https://samy-boudaoud.com/sameva.html) et en [anglais](https://samy-boudaoud.com/sameva.en.html), dans la même DA : elle charge `site.css` puis `sameva.css` pour ses blocs propres.

**Vingt mini-jeux**, réécrits sur un moteur commun (`games/core.js`) : canvas net sur écran Retina, boucle à pas fixe de 1/120 s (même vitesse sur toutes les machines, rendu interpolé), clavier, souris et tactile, sons synthétisés en WebAudio (coupables), records par jeu, écrans de début et de fin. Chaque jeu vit dans son propre fichier `games/<id>.js` et n'est chargé qu'à son ouverture. Vingt-cinq succès (dix-sept liés aux jeux, huit à l'exploration du site : archives, onglets, langue, terminal, avatar, études de cas, page 404), une icône dessinée pour chacun, aucun émoji. Tapez `s` puis `b` pour ouvrir un terminal caché.

| Jeu | Fichier | Particularité |
| --- | --- | --- |
| Puissance 4 | `connect4.js` | IA minimax alpha-bêta (profondeur 5), chute des jetons avec rebond |
| Morpion | `tictactoe.js` | IA minimax qui peut se tromper dans l'ouverture, traits animés |
| Blocs | `tetris.js` | Rotations avec rattrapage au mur, pièce fantôme, réserve, répétition des touches gérée par le jeu |
| Snake | `snake.js` | Serpent interpolé entre les cases, file de commandes |
| 2048 | `2048.js` | Tuiles qui glissent, fusion animée, coup mis en file |
| Démineur | `minesweeper.js` | Premier clic sûr, révélation en onde, drapeau à l'appui long |
| Casse-briques | `breakout.js` | Collisions continues (la balle ne traverse jamais une brique), niveaux |
| Pong | `pong.js` | Effet selon la vitesse de la raquette, IA battable |
| Envol | `flappy.js` | Avion de papier, physique au pas fixe, décor en parallaxe |
| Memory | `memory.js` | Retournement 3D, huit symboles dessinés |
| Séquence | `simon.js` | Une note par touche, tempo croissant |
| Taquin | `taquin.js` | Mélanges toujours solubles, lignes entières déplaçables |
| Tape-taupe | `whack.js` | Signaux qui s'élèvent et s'éteignent, rythme croissant |
| Pierre-feuille-ciseaux | `rps.js` | L'ordinateur prédit vos coups à partir des deux précédents |
| Réflexes | `reflex.js` | Mesure au pointerdown, cinq essais, graphique |
| Quiz tech | `quiz.js` | 31 questions bilingues sur la stack (TETRA, Qt, MQTT, Kubernetes…) |
| Fruits | `fruits.js` | Fusion façon Suika : onze fruits de la cerise à la pastèque, physique de Verlet à pas fixe, sprites pré-rendus |
| Course | `runner.js` | Course sans fin en pixel art, saut à hauteur variable, tolérance au sol et mémoire du saut |
| Astéroïdes | `asteroids.js` | Vaisseau à inertie, rochers qui se fragmentent, vagues, contrôle au doigt |
| Pile | `stack.js` | Blocs isométriques, découpe de ce qui dépasse, bonus des poses parfaites |

---

## Choix techniques

### Pas de build

HTML, CSS et JavaScript écrits à la main. Les bibliothèques sont copiées dans `vendor/` et servies depuis le site (pas de CDN) :

| Fichier | Rôle | Poids compressé |
| --- | --- | --- |
| `vendor/three-r186b.min.js` | Three.js 0.186, réduit aux classes utilisées par l'avatar (esbuild) | ~136 Ko |
| `vendor/gsap.min.js`, `ScrollTrigger.min.js` | Animations | ~46 Ko |
| `vendor/lenis.min.js` | Défilement fluide | ~5 Ko |

Three.js et `avatar.js` sont des modules préchargés : le texte s'affiche avant que la 3D ne soit prête. Les jeux (`games/`) ne se chargent qu'au premier clic, EmailJS qu'au premier focus dans le formulaire.

> Les fichiers de `fonts/` et `vendor/` sont mis en cache un an. Pour mettre à jour une bibliothèque, changer le nom du fichier (par exemple `three.187.min.js`).

### Accessibilité et repli

Si l'utilisateur préfère réduire les animations : pas de défilement fluide, textes visibles d'emblée, avatar figé de face (il tourne encore au glisser). Sans WebGL, l'icône de la tête remplace l'avatar. Contrastes AA vérifiés avec axe-core, focus visible, éléments `<details>` natifs pour l'index, piège de focus dans la fenêtre des jeux.

### Langue

Chaque texte existe en français et en anglais dans le HTML, marqué `data-l="fr"` ou `data-l="en"`. Une règle CSS masque la langue inactive selon l'attribut `lang` de `<html>`, posé avant le premier rendu (préférence sous `sb-lang`).

### Application web progressive

`manifest.webmanifest` et `sw.js` rendent le site installable et consultable hors ligne.

> **À ne pas oublier :** après toute modification d'un fichier `.css` ou `.js`, incrémenter `VERSION` dans `sw.js`.

### Sécurité et en-têtes

Définis dans `vercel.json` (CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). Toute nouvelle ressource externe doit être ajoutée à la CSP.

---

## Organisation des fichiers

```
├── index.html              Page principale (FR et EN)
├── site.css                Styles de la page principale et du 404
├── site.js                 Défilement, animations, filtres, jeux, formulaire, terminal
├── avatar.js               Avatar 3D en voxels, construit depuis le skin
├── vendor/                 Three.js, GSAP, ScrollTrigger, Lenis
├── fonts/                  Tiny5, JetBrains Mono et Geist, auto-hébergées
├── games/                  Moteur commun (core.js) et un fichier par jeu, chargés à la demande
├── achievements.js / .css  Succès et notifications
├── sameva.html, sameva.en.html, sameva.css   Étude de cas Sameva
├── 404.html                Page d'erreur
├── assets/                 Skin et icônes (mougi/), visuels (visuals/, thumbs/, sameva/), logos (logos/), image de partage
├── sw.js, manifest.webmanifest, vercel.json, sitemap.xml, robots.txt
└── CV_Samy_Boudaoud.pdf    Curriculum vitae
```

---

## Travailler sur le projet

Ouvrir `index.html` dans un navigateur suffit pour la plupart des modifications. Pour que le service worker et le manifeste se comportent normalement, mieux vaut passer par un serveur local :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

```bash
npx serve .
```

Pendant le développement, penser à cocher « Update on reload » dans l'onglet Application des outils de développement, sinon le service worker sert des versions en cache.

---

## Déploiement

Hébergé sur Vercel, déployé automatiquement à chaque poussée sur `main`, avec le nom de domaine `samy-boudaoud.com`.

---

## Licence

Le code de ce portfolio peut servir de référence. En revanche, le contenu personnel, le curriculum vitae, les illustrations et les visuels du projet Sameva ne sont pas réutilisables.