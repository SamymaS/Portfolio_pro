# Sameva — Pack assets : Dessins (Nano Banana) + SFX (ElevenLabs)

> Objectif : remplacer mes placeholders SVG par de **vrais dessins** et de **vrais SFX**, tout en gardant la DA street-art ancrée sur **Paco**.
> Tu génères toi-même avec tes outils (Nano Banana Pro 2 + ElevenLabs) ; moi je fournis les prompts, les specs et l'intégration.

---

## A. Le logo Sameva — action requise

L'extraction auto depuis Figma est bloquée par ton **siège « View »** (rate limit MCP).
Le plus simple : dans Figma, sélectionne la composition du logo → **Export** → **SVG** (idéal) ou **PNG ×3 fond transparent**, et **dépose le fichier dans le chat**.

Avec ça je peux : (1) l'intégrer tel quel dans le mockup, (2) en extraire la palette exacte pour caler les tokens, (3) le décliner (version icône, version monochrome pour la nav, splash screen).

---

## B. Dessins — pack de prompts **Nano Banana Pro 2**

### B.0 — La règle d'or : générer **à partir d'une référence**
Paco est ton **vrai chat**. Pour que toutes les illustrations soient cohérentes (même tête, mêmes marques tuxedo), ne pars pas de zéro à chaque fois :

1. **Image de référence n°1** : une **photo nette de Paco** (face + profil si possible).
2. **Image de référence n°2** : le **logo Sameva** (pour caler le style de trait et l'univers).
3. Génère d'abord une **character sheet** (planche modèle). Ensuite, réutilise *cette planche* comme référence pour toutes les poses/expressions → consistance garantie.

### B.1 — Bible de style *(à coller en préfixe de CHAQUE prompt)*

```
Style: bold urban street-art illustration, graffiti/stencil aesthetic, thick confident
linework, spray-paint texture with subtle grain, vibrant colors on dark, flat cel-shading
with hard highlights, sticker-art energy. NOT chibi, NOT kawaii-cute, NOT pastel.
Mobile game asset, centered subject, clean transparent background (PNG), even studio lighting.
```

### B.2 — Bible de personnage *(à coller juste après la bible de style)*

```
Character: "Paco", a tuxedo cat — glossy black fur on head, back and ears; crisp white
muzzle, chin, chest bib and paws; large round vivid emerald-green eyes; small pink
triangular nose; streetwise confident attitude. Paco is the app mascot.
Palette: deep charcoal background, signature emerald green (#2BF58A), graffiti pink (#FF3E81),
electric violet (#8169FF), gold (#FFC93C), bone-white (#F2EEE2).
```

### B.3 — Les prompts, asset par asset

| # | Asset | Prompt (à ajouter après les deux bibles) |
|---|-------|------------------------------------------|
| 1 | **Character sheet Paco** | `Character turnaround sheet of Paco: front, 3/4 and side view, plus a neutral standing full-body pose. Consistent proportions, model-reference style, neutral pose, no background.` |
| 2 | **Paco — héros / splash** | `Paco in a dynamic confident pose, standing, looking at camera, slight low-angle hero shot, wearing a backwards snapback cap, faint spray-paint splash behind him.` |
| 3 | **Paco — avatar idle** | `Paco bust portrait, friendly neutral expression, framed for a circular/rounded app avatar, shoulders visible.` |
| 4 | **Paco — célébration** | `Paco cheering with both paws up, big happy grin, sparkles and confetti around, celebratory energy.` |
| 5 | **MougiBot (l'IA)** | `Paco reimagined as a friendly AI assistant "MougiBot": same tuxedo cat but with a sleek translucent green tech visor over the eyes, a small floating holographic interface element, calm analytical expression.` |
| 6 | **Mougis — variantes rareté** | Génère 4 fois : `...recolored as a {rare} variant.` avec `{rare}` = `common grey tabby` / `rare emerald-green` / `epic electric-violet` / `legendary golden with subtle glow`. Garde la silhouette de Paco. |
| 7 | **Loot streetwear — casquette** | `A single streetwear snapback cap, graffiti print, floating item icon, slight 3/4 angle, glossy, game-loot style.` |
| 8 | **Loot streetwear — hoodie** | `A single oversized streetwear hoodie, bold graphic print, floating item icon, game-loot style.` |
| 9 | **Loot streetwear — sneakers** | `A pair of chunky streetwear sneakers, vibrant colorway, floating item icon, game-loot style.` |
| 10 | **Loot streetwear — chaîne** | `A thick gold chain necklace with a small cat-head pendant, floating item icon, game-loot style.` |
| 11 | **Icônes catégories** (×5) | `A bold sticker-style icon for "{thème}", single object, flat, thick outline, vibrant.` avec `{thème}` = études / sport / maison / objectif / bien-être. |
| 12 | **Empty state / 404** | `Paco sitting confused and scratching his head, with a small "?" spray-tag above him, sad-but-cute, for an empty-state screen.` |

### B.4 — Specs techniques (à respecter à l'export)
- **Format** : PNG **fond transparent** (sauf splash/héros qui peut avoir un fond).
- **Cadrage** : carré, sujet centré, marge de sécurité ~10 % autour.
- **Résolution** : génère grand (≥ 2048 px), tu downscaleras pour le `@2x/@3x`.
- **Cohérence** : même éclairage, même épaisseur de trait sur toute la série → toujours repasser la character sheet en référence.
- **Nommage** : `paco_hero.png`, `paco_avatar.png`, `mougibot.png`, `mougi_legendary.png`, `loot_cap_01.png`, `icon_cat_sport.png`…

---

## C. SFX — cartographie sonore + prompts **ElevenLabs**

ElevenLabs **Sound Effects** génère un son à partir d'un prompt texte + une durée. Voici quoi générer pour chaque interaction de Sameva.

### C.1 — La table de correspondance

| Interaction dans l'app | Fichier | Prompt ElevenLabs |
|------------------------|---------|-------------------|
| Tap UI / navigation | `sfx_ui_tap` | `short crisp UI button tap, soft click, clean and snappy` |
| Cocher / valider une quête simple | `sfx_quest_check` | `satisfying short positive confirmation tick, bright, game UI` |
| Gain d'XP | `sfx_xp_gain` | `quick ascending digital blip, light and rewarding` |
| Gain d'or | `sfx_gold` | `bright metallic coin pickup jingle, arcade, short` |
| **Montée de niveau** | `sfx_level_up` | `triumphant short fanfare with a magical sparkle rise, celebratory` |
| MougiBot analyse la photo | `sfx_ai_scan` | `soft sci-fi scanning hum with a gentle sweep, processing, loopable` |
| **Validation réussie (≥70)** | `sfx_validate_ok` | `uplifting success sting with a warm sparkle, rewarding` |
| Validation < 70 / manuelle | `sfx_validate_soft` | `gentle neutral confirm tone, soft, non-negative, encouraging` |
| Révélation récompense / loot | `sfx_loot_reveal` | `magical item reveal shimmer, a whoosh into a sparkle` |
| Invocation — capsule | `sfx_gacha_roll` | `plastic gachapon capsule rattling then popping open, toy machine` |
| Invocation — réveal **légendaire** | `sfx_reveal_legendary` | `epic golden reveal with a choir-like swell and a sparkle burst` |
| Streak / flamme | `sfx_streak` | `quick warm whoosh flame igniting, short` |
| Équiper un item | `sfx_equip` | `fabric swish with a soft snap, clothing equip, short` |
| Erreur douce (ex. MougiBot 529) | `sfx_error_soft` | `gentle low soft error tone, non-punitive, brief` |

### C.2 — Bonnes pratiques SFX mobile
- Durées **courtes** (0,2–1,5 s), sauf `sfx_ai_scan` (loopable pendant l'analyse).
- Normalise le volume entre tous les fichiers (loudness cohérente).
- Exporte en **`.mp3` ou `.ogg`** (léger, OK Android/iOS), garde les sources `.wav`.

### C.3 — Fallback gratuit (si tu veux du tout-fait CC0)
- **Kenney.nl** → packs *UI Audio*, *Interface Sounds*, *Casino Audio* (pièces), *RPG Audio* — tout en **CC0**, parfait pour ce style.
- **Freesound.com** (filtre licence **CC0**) et **Mixkit / Pixabay** (libres).

---

## D. Intégration Flutter — prompt prêt pour `@sameva-dev`

> Je ne touche pas au Dart directement (on garde ton workflow sub-agents). Voici le prompt à coller dans Claude Code quand tu auras les fichiers SFX.

```
@sameva-dev

Contexte : on ajoute les SFX du jeu. Les fichiers sont dans assets/sfx/ (mp3),
nommés selon la convention sfx_<event>.mp3 (cf. table fournie).

Tâche :
1. Ajouter le package audioplayers et déclarer assets/sfx/ dans pubspec.yaml.
2. Créer un SfxService (singleton, injecté via Provider) avec :
   - un enum Sfx pour chaque événement (uiTap, questCheck, xpGain, gold, levelUp,
     aiScan, validateOk, validateSoft, lootReveal, gachaRoll, revealLegendary,
     streak, equip, errorSoft) mappé sur son fichier ;
   - préchargement / pool bas-latence pour les sons fréquents (tap, xp) ;
   - une méthode play(Sfx) qui NE BLOQUE JAMAIS l'UI (fire-and-forget, try/catch silencieux) ;
   - respect d'un toggle "Sons" persisté dans la box Hive settings (off => play() no-op).
3. Brancher les appels aux bons endroits (validation, récompense, level-up, gacha…)
   SANS modifier la logique métier existante.
4. Tests : un test unitaire vérifiant que play() est no-op quand le toggle est off.

NE COMMIT PAS sans mon instruction explicite. Donne-moi d'abord le diff.
```

---

## E. Ce qu'il me faut de toi pour rebrancher le mockup
1. **Le logo** (SVG/PNG) déposé ici.
2. **4 PNG clés** générés via les prompts B : `paco_hero`, `paco_avatar`, `mougibot`, `mougi_legendary` (+ 1 loot si tu veux).

→ Avec ça je reconstruis le mockup avec les **vrais visuels** posés dans les écrans, et je te montre le rendu final.
