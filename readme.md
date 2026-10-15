# Portfolio · Samy Boudaoud

Portfolio personnel en HTML, CSS et JavaScript natifs. Aucun framework, aucune étape de build, aucune dépendance à installer : les fichiers sont servis tels quels.

**En ligne :** [samy-boudaoud.com](https://samy-boudaoud.com)

---

## Ce que contient le site

**Le portfolio.** Une page unique : ouverture, projets (quatre détaillés puis un index filtrable de tous les autres), parcours, formation, compétences, labo de mini-jeux et contact. Le CV est téléchargeable depuis l'en-tête.

**L'oscilloscope d'ouverture.** Une trame TDMA à quatre intervalles, comme sur un réseau radio TETRA. Chaque intervalle porte un domaine (logiciel critique, mobile, IoT, web et cloud) et sert de filtre pour les projets. Dessiné en Canvas 2D, ralenti à 30 images par seconde, suspendu hors écran et figé si l'utilisateur préfère réduire les animations.

**Une page projet dédiée à Sameva.** Étude de cas en [français](https://samy-boudaoud.com/sameva.html) et en [anglais](https://samy-boudaoud.com/sameva.en.html). Elle garde sa propre feuille de style (`style.css`).

**Seize mini-jeux** et treize succès persistés en local. Tapez `s` puis `b` pour ouvrir un terminal caché.

---

## Choix techniques

### Pas de build, peu de requêtes

HTML, CSS et JavaScript écrits à la main. Au chargement, la page principale ne demande que cinq fichiers : la police, `site.css`, `achievements.css`, `achievements.js` et `site.js`. Les jeux (`games.js`) ne se chargent qu'au premier clic sur un jeu, et EmailJS qu'au premier focus dans le formulaire. Aucune bibliothèque tierce au démarrage.

### Typographie

Une seule famille, Archivo, auto-hébergée dans `fonts/` en police variable (graisse et largeur). Les titres utilisent l'axe de largeur pour leur caractère, le texte courant reste en largeur normale.

### Thème et langue

Le thème suit le système par défaut, et le choix manuel est mémorisé sous `sb-theme`. Les couleurs sont des variables CSS redéfinies pour le mode sombre.

Chaque texte existe en français et en anglais dans le HTML, marqué `data-l="fr"` ou `data-l="en"`. Une règle CSS masque la langue inactive selon l'attribut `lang` de `<html>`, posé avant le premier rendu (préférence sous `sb-lang`). Pour ajouter un texte, il suffit d'écrire les deux versions côte à côte.

### Application web progressive

`manifest.webmanifest` et `sw.js` rendent le site installable et consultable hors ligne : network-first pour le HTML, cache-first avec rafraîchissement en arrière-plan pour les ressources.

> **À ne pas oublier :** après toute modification d'un fichier `.css` ou `.js`, incrémenter `VERSION` dans `sw.js`.

### Sécurité et en-têtes

Définis dans `vercel.json` : `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, et un cache long pour la police. Toute nouvelle ressource externe doit être ajoutée à la CSP.

### Accessibilité

Lien d'évitement, focus visible, contrastes AA dans les deux thèmes (audit axe-core sans violation), index des projets en éléments `<details>` natifs, intervalles de l'oscilloscope en vrais boutons, piège de focus dans la fenêtre des jeux, mouvement réduit respecté.

---

## Organisation des fichiers

```
├── index.html              Page principale (FR et EN)
├── site.css                Styles de la page principale et du 404
├── site.js                 Thème, langue, oscilloscope, filtres, jeux, formulaire, terminal
├── games.js                Les seize mini-jeux (chargés à la demande)
├── achievements.js / .css  Succès et notifications
├── sameva.html             Étude de cas Sameva (français)
├── Sameva.en.html          Étude de cas Sameva (anglais)
├── style.css               Feuille de styles des pages Sameva
├── 404.html                Page d'erreur
├── fonts/                  Archivo, police variable auto-hébergée
├── assets/                 Visuels Sameva et image de partage (og_portfolio.png)
├── sw.js                   Service worker
├── manifest.webmanifest    Manifeste de l'application web
├── vercel.json             En-têtes HTTP
├── sitemap.xml, robots.txt Indexation
├── favicon.svg             Icône
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