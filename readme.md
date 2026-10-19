# Portfolio · Samy Boudaoud

Portfolio personnel en HTML, CSS et JavaScript natifs. Aucun framework, aucune étape de build, aucune dépendance à installer : les fichiers sont servis tels quels.

**En ligne :** [samy-boudaoud.com](https://samy-boudaoud.com)

---

## Ce que contient le site

**Le portfolio.** Une page unique, sombre : ouverture, manifeste, quatre projets mis en avant, index filtrable de tous les autres, parcours, compétences, labo de mini-jeux et contact. FR et EN sans rechargement.

**La scène 3D.** Un seul champ de particules Three.js, fixe derrière toute la page, qui change de forme au défilement :

| Section | Forme |
| --- | --- |
| Ouverture, manifeste, contact | Vague de signal qui ondule sous la souris |
| Sameva | Orbe |
| TicketFlow | Quatre microservices reliés à un broker |
| MythraSona | Anneaux sonores |
| TikTok Live vers Minecraft | Cube de blocs et blocs en orbite |
| Index, parcours, compétences, labo | Galaxie en spirale, atténuée |

Toutes les formes sont précalculées dans des attributs de la géométrie ; le shader passe de l'une à l'autre avec un décalage par particule et un léger tourbillon, ce qui donne des transitions fluides. La scène se met en pause quand l'onglet est caché ou qu'un jeu est ouvert.

**Les animations.** Défilement fluide (Lenis), révélation des titres mot à mot, manifeste qui s'allume au fil du défilement, compteurs, frise qui se dessine, technologies qui défilent, curseur personnalisé, boutons magnétiques, panneaux inclinés en 3D sous la souris (GSAP et ScrollTrigger).

**Les visuels.** Chaque projet a son image, dans une direction commune : un objet en verre dépoli, éclairé en cyan et violet sur fond nuit, pour répondre aux couleurs de la scène 3D.

| Dossier | Contenu | Origine |
| --- | --- | --- |
| `assets/visuals/` | Visuels des projets mis en avant, du parcours, du labo et du contact (1200 px et 720 px) | Générés avec Figma AI, fichier « Portfolio Samy Boudaoud, assets » |
| `assets/thumbs/` | Vignettes de l'index, affichées au survol (ordinateur) ou à l'ouverture d'une ligne (mobile) | Figma AI, sauf SeaRiders et TimeTravel (vraies images des projets) |
| `assets/sameva/` | Trois vrais écrans de l'application, découpés de `recherche_ui.webp` | Maquettes Sameva |

Toutes les images sont en WebP, chargées en différé (`loading="lazy"`) : environ 700 Ko au total, jamais au premier affichage.

**Une page projet dédiée à Sameva**, en [français](https://samy-boudaoud.com/sameva.html) et en [anglais](https://samy-boudaoud.com/sameva.en.html), avec sa propre feuille de style (`style.css`).

**Seize mini-jeux**, réécrits sur un moteur commun (`games/core.js`) : canvas net sur écran Retina, boucle à pas fixe de 1/120 s (même vitesse sur toutes les machines, rendu interpolé), clavier, souris et tactile, sons synthétisés en WebAudio (coupables), records par jeu, écrans de début et de fin. Chaque jeu vit dans son propre fichier `games/<id>.js` et n'est chargé qu'à son ouverture. Treize succès, une icône dessinée par jeu, aucun émoji. Tapez `s` puis `b` pour ouvrir un terminal caché.

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

---

## Choix techniques

### Pas de build

HTML, CSS et JavaScript écrits à la main. Les bibliothèques sont copiées dans `vendor/` et servies depuis le site (pas de CDN) :

| Fichier | Rôle | Poids compressé |
| --- | --- | --- |
| `vendor/three.min.js` | Three.js 0.186, réduit aux classes utilisées (esbuild) | ~134 Ko |
| `vendor/gsap.min.js`, `ScrollTrigger.min.js` | Animations | ~46 Ko |
| `vendor/lenis.min.js` | Défilement fluide | ~5 Ko |

Three.js et `scene.js` sont des modules préchargés : le texte s'affiche avant que la 3D ne soit prête, puis la scène apparaît en fondu. Les jeux (`games.js`) ne se chargent qu'au premier clic, EmailJS qu'au premier focus dans le formulaire.

> Les fichiers de `fonts/` et `vendor/` sont mis en cache un an. Pour mettre à jour une bibliothèque, changer le nom du fichier (par exemple `three.187.min.js`).

### Accessibilité et repli

Si l'utilisateur préfère réduire les animations : pas de défilement fluide, pas de curseur, textes visibles d'emblée, scène 3D figée. Sans WebGL, un dégradé remplace la scène. Contrastes AA vérifiés avec axe-core, focus visible, éléments `<details>` natifs pour l'index, piège de focus dans la fenêtre des jeux.

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
├── scene.js                Scène 3D : formes, shaders, rendu
├── vendor/                 Three.js, GSAP, ScrollTrigger, Lenis
├── fonts/                  Archivo, police variable auto-hébergée
├── games/                  Moteur commun (core.js) et un fichier par jeu, chargés à la demande
├── achievements.js / .css  Succès et notifications
├── sameva.html, Sameva.en.html, style.css   Étude de cas Sameva
├── 404.html                Page d'erreur
├── assets/                 Visuels (visuals/, thumbs/, sameva/), logos des entreprises (logos/), mascotte Sameva, image de partage
├── sw.js, manifest.webmanifest, vercel.json, sitemap.xml, robots.txt, favicon.svg
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