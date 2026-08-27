# Portfolio · Samy Boudaoud

Portfolio personnel en HTML, CSS et JavaScript natifs. Aucun framework, aucune étape de build, aucune dépendance à installer : les fichiers sont servis tels quels.

**En ligne :** [samy-boudaoud.com](https://samy-boudaoud.com)

---

## Ce que contient le site

**Le portfolio.** Profil, compétences, expériences, projets, formations et un formulaire de contact. Le CV est téléchargeable directement depuis la barre de navigation.

**Une page projet dédiée à Sameva.** Étude de cas complète de mon application Flutter de quêtes gamifiées : concept, architecture, chiffres du projet et feuille de route. Disponible en [français](https://samy-boudaoud.com/sameva.html) et en [anglais](https://samy-boudaoud.com/sameva.en.html).

**Seize mini-jeux jouables dans le navigateur.** Puissance 4 et Morpion avec IA, Snake, Casse-briques, 2048, Tetris, Démineur, Taquin, Pong, Flappy, Simon, Memory, Tape-taupe, Pierre-feuille-ciseaux, un test de réflexes et un quiz technique. Treize succès déblocables sont associés, persistés en local.

---

## Choix techniques

### Pas de build

Le site est du HTML, du CSS et du JavaScript écrits à la main. Pas de bundler, pas de transpilation, pas de `node_modules`. Cloner le dépôt et ouvrir `index.html` suffit pour travailler dessus.

Trois ressources seulement viennent de l'extérieur : les polices Google (Syne et Space Mono), Three.js pour l'animation d'en-tête, et EmailJS pour le formulaire de contact.

### Thème et langue

Le thème sombre ou clair repose sur des variables CSS commutées par l'attribut `data-theme` sur `<html>`. Le choix est mémorisé sous la clé `sb-theme`.

L'internationalisation français / anglais est maison : un dictionnaire dans `i18n.js`, des attributs `data-i18n` sur les éléments concernés, et la préférence stockée sous `sb-lang`. La page Sameva fonctionne différemment, avec deux fichiers HTML distincts et des liens `hreflang`, ce qui donne à chaque langue sa propre URL indexable.

### Application web progressive

`manifest.webmanifest` et `sw.js` rendent le site installable et consultable hors ligne.

La stratégie de cache est volontairement dissymétrique : **network-first pour le HTML**, pour qu'une page mise à jour soit toujours servie fraîche, et **cache-first avec rafraîchissement en arrière-plan pour les ressources statiques**, pour la performance.

> **À ne pas oublier :** après toute modification de `style.css` ou d'un fichier `.js`, incrémenter la constante `VERSION` dans `sw.js`. Sans ça, les visiteurs récurrents verront l'ancienne version pendant une visite.

### Sécurité et en-têtes

Les en-têtes HTTP sont définis dans `vercel.json` :

| En-tête | Rôle |
| --- | --- |
| `Content-Security-Policy` | Restreint les origines de scripts, styles, polices, images et requêtes |
| `Strict-Transport-Security` | Force HTTPS, avec `preload` |
| `X-Frame-Options: DENY` | Bloque l'inclusion du site dans une iframe |
| `X-Content-Type-Options: nosniff` | Empêche la réinterprétation du type MIME |
| `Referrer-Policy` | Limite les informations transmises aux sites tiers |
| `Permissions-Policy` | Désactive caméra, micro et géolocalisation |

Toute nouvelle ressource externe doit être déclarée dans la directive CSP correspondante, sinon le navigateur la bloquera silencieusement.

### Accessibilité

Lien d'évitement vers le contenu, navigation au clavier, piège de focus dans les fenêtres modales des jeux, attributs ARIA sur les composants interactifs et textes alternatifs sur les images.

---

## Organisation des fichiers

```
├── index.html              Page principale, toutes les sections
├── sameva.html             Étude de cas Sameva (français)
├── sameva.en.html          Étude de cas Sameva (anglais)
├── 404.html                Page d'erreur
├── style.css               Feuille de styles, variables et thèmes
├── achievements.css        Styles des succès et notifications
├── main.js                 Navigation, thème, animations, formulaire
├── i18n.js                 Dictionnaire et bascule de langue
├── games.js                Les seize mini-jeux
├── achievements.js         Succès et persistance locale
├── sw.js                   Service worker
├── manifest.webmanifest    Manifeste de l'application web
├── vercel.json             En-têtes HTTP et configuration de déploiement
├── sitemap.xml             Plan du site avec alternances de langue
├── robots.txt              Directives d'indexation
├── favicon.svg             Icône du site
├── CV_Samy_Boudaoud.pdf    Curriculum vitae
└── assets/                 Images, illustrations et visuels de partage
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