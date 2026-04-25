# ASCII.GEN — Image to Text Converter

> **v2.1** — Convertisseur d'images en art ASCII, entièrement dans le navigateur, sans dépendance externe ni serveur.

---a

## Table des matières

1. [Présentation](#présentation)
2. [Démo rapide](#démo-rapide)
3. [Structure des fichiers](#structure-des-fichiers)
4. [Fonctionnalités](#fonctionnalités)
   - [Modes de rendu](#modes-de-rendu)
   - [Polices monospace](#polices-monospace)
   - [Jeux de caractères](#jeux-de-caractères)
   - [Options](#options)
   - [Export](#export)
5. [Architecture technique](#architecture-technique)
   - [Pipeline de génération](#pipeline-de-génération)
   - [Mode Edge Detection (détail)](#mode-edge-detection-détail)
   - [Mode Braille (détail)](#mode-braille-détail)
   - [Rendu couleur ANSI](#rendu-couleur-ansi)
6. [Installation & utilisation](#installation--utilisation)
7. [Interface](#interface)
   - [Desktop](#desktop)
   - [Mobile](#mobile)
8. [Personnalisation](#personnalisation)
9. [Compatibilité navigateurs](#compatibilité-navigateurs)
10. [Limitations connues](#limitations-connues)

---

## Présentation

**ASCII.GEN** est une application web statique qui transforme n'importe quelle image en art ASCII. Elle fonctionne entièrement côté client via l'API Canvas HTML5 — aucune donnée n'est envoyée à un serveur.

**Stack technique :** HTML5 · CSS3 (variables CSS, Grid, Flexbox) · JavaScript vanilla (ES6+) · Canvas API · Google Fonts (chargement externe uniquement pour les polices).

---

## Démo rapide

```
1. Ouvrir ascii-art-generator.html dans un navigateur moderne
2. Glisser-déposer une image dans la zone de dépôt (ou cliquer pour parcourir)
3. Ajuster les paramètres dans la sidebar
4. Cliquer sur « Générer → »
5. Copier ou exporter le résultat
```

---

## Structure des fichiers

```
ascii-art-generator.html   # Structure HTML, layout, UI components
style.css                  # Thème dark, design system, responsive mobile
script.js                  # Logique de conversion, générateurs ASCII, export
```

Aucune dépendance npm, aucun bundler requis. Les trois fichiers doivent se trouver dans le même répertoire.

---

## Fonctionnalités

### Modes de rendu

| Mode | Description | Caractères utilisés |
|------|-------------|---------------------|
| **Classic Lum.** | Mappe la luminance de chaque pixel sur un caractère du jeu sélectionné | Jeu de caractères configurable |
| **Edge Detect.** | Détecte les contours via un filtre de Sobel (avec flou gaussien préalable) et trace leur direction | `- \ | /` |
| **Block Shade** | Utilise les caractères de remplissage Unicode pour une graduation douce | `░ ▒ ▓ █` |
| **Braille Dots** | Encode 8 pixels par caractère braille (Unicode U+2800–U+28FF) | Blocs braille |

### Polices monospace

9 polices Google Fonts disponibles, sélectionnables depuis la sidebar :

- Space Mono *(défaut)*
- JetBrains Mono
- Fira Code
- IBM Plex Mono
- Source Code Pro
- Inconsolata
- Roboto Mono
- Courier Prime
- Share Tech Mono

Le changement de police s'applique instantanément à l'affichage et est pris en compte lors de l'export SVG/PNG.

### Jeux de caractères

Disponibles en mode **Classic** uniquement (désactivés pour les autres modes) :

| Nom | Caractères | Usage recommandé |
|-----|-----------|-----------------|
| **Standard** | ` .,:;*?%S#@` | Polyvalent |
| **Dense** | ` .:-=+*#%@$` | Images à fort contraste |
| **Simple** | ` ░▒▓█` | Rendu bloc doux |
| **Binary** | ` 1` | Effet bitmap, pixelisé |
| **Letters** | ` .=+oXHABMW` | Style typographique |

### Options

| Option | Défaut | Effet |
|--------|--------|-------|
| **Inverser** | OFF | Inverse la table luminance→caractère (image négative) |
| **Couleur (ANSI)** | OFF | Colorie chaque caractère avec la couleur RGB du pixel source (via `<span>` inline) |
| **Haut contraste** | OFF | Amplifie les zones sombres et claires : `lum < 0.5` → atténué, `lum ≥ 0.5` → amplifié |
| **Garder ratio** | ON | Calcule la hauteur de sortie en fonction du ratio d'aspect de l'image source (avec correction ×0.5 pour la proportion des caractères) |

**Résolution :**
- **Width** : 20 à 300 colonnes de caractères (défaut : 100)
- **Font px** : 4 à 16 px pour l'affichage (défaut : 6) — modifiable aussi avec les boutons `−` / `+` dans la toolbar

### Export

| Format | Détails |
|--------|---------|
| **Copier** | Copie le texte ASCII brut dans le presse-papiers (Clipboard API) |
| **.txt** | Télécharge le texte ASCII brut en UTF-8 |
| **.svg** | Génère un SVG vectoriel avec fond `#080808`, éléments `<text>` par ligne, police et taille actuelles |
| **.png** | Rasterise via un `<canvas>` hors-DOM (résolution ×2 pour la netteté), télécharge en PNG |

---

## Architecture technique

### Pipeline de génération

```
Image source (File / DataURL)
        │
        ▼
   loadImage()
   ┌─────────────────────────────┐
   │  FileReader → Image HTML    │
   │  Prévisualisation uploadZone│
   └─────────────────────────────┘
        │  clic Générer
        ▼
   generate()
   ┌─────────────────────────────────────────────┐
   │  Calcul dimensions sw × sh                  │
   │  (ratio corrigé ×0.5 pour chars non carrés) │
   │  Dessin sur <canvas id="source-canvas">     │
   │  Extraction getImageData() → Uint8ClampedArray│
   └─────────────────────────────────────────────┘
        │
        ├─── mode = classic  → generateClassicASCII()
        ├─── mode = edge     → generateEdgeASCII()
        ├─── mode = block    → generateBlockASCII()
        └─── mode = braille  → generateBrailleASCII()
                │
                ▼
         { text, colorData }
                │
                ▼
         renderOutput()
         updateInfo()
```

### Mode Edge Detection (détail)

L'algorithme opère en 5 étapes sur une grille de pixels **double hauteur** (pour compenser le ratio des glyphes) :

1. **Niveaux de gris** — luminance perceptuelle : `0.299·R + 0.587·G + 0.114·B`
2. **Flou gaussien 5×5** — noyau normalisé (somme = 159) pour réduire le bruit avant le Sobel
3. **Filtre de Sobel** — calcul des gradients Gx et Gy, magnitude `Gm` et angle `G`
4. **Seuillage de Canny simplifié** — suppression des non-maxima + hystérésis (seuils bas/haut)
5. **Quantification angulaire** — la direction de l'arête (0–179°) est mappée sur `- \ | /`

Chaque caractère de sortie couvre 1×2 pixels de la grille interne.

### Mode Braille (détail)

Un caractère braille (U+2800–U+28FF) encode une grille 2×4 pixels :

```
Bit layout:   Position dans le bloc:
  0  3          col 0, row 0  |  col 1, row 0
  1  4          col 0, row 1  |  col 1, row 1
  2  5          col 0, row 2  |  col 1, row 2
  6  7          col 0, row 3  |  col 1, row 3
```

Le codepoint résultant est `0x2800 | bitmask`. L'image est rééchantillonnée à `width×2` × `height×4` avant le calcul.

### Rendu couleur ANSI

Quand l'option "Couleur" est activée, `generateClassicASCII()` construit en parallèle un tableau `colorData[]` contenant `rgb(r,g,b)` pour chaque caractère. `renderOutput()` crée alors un `<span>` par caractère avec `style.color` correspondant (au lieu d'un simple `pre.textContent`).

> ⚠️ Cette option peut ralentir le rendu sur de grandes résolutions (>150 colonnes) car elle génère plusieurs milliers d'éléments DOM.

---

## Installation & utilisation

### Utilisation locale (sans serveur)

```bash
# Cloner ou télécharger les 3 fichiers dans un dossier
git clone <repo-url>
cd ascii-gen

# Ouvrir directement dans le navigateur
open ascii-art-generator.html
# ou
xdg-open ascii-art-generator.html  # Linux
```

> La Clipboard API (`navigator.clipboard`) requiert un contexte sécurisé (HTTPS ou `localhost`). La copie ne fonctionnera pas avec `file://` sur certains navigateurs. Les autres fonctionnalités (génération, export) fonctionnent sans serveur.

### Avec un serveur local minimal

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# Puis ouvrir http://localhost:8080/ascii-art-generator.html
```

---

## Interface

### Desktop

```
┌─────────────────────────────────────────────────────────────┐
│  ASCII.GEN          Image to Text Converter             v2.1│
├─────────────────────┬───────────────────────────────────────┤
│  SIDEBAR (300px)    │  OUTPUT AREA                          │
│                     │  ┌─ Toolbar ─────────────────────────┐│
│  ┌ Source ──────┐   │  │ ◈ Copier │ ↓.txt │ ↓.svg │ ↓.png ││
│  │ Drop zone    │   │  │ − + │ 120×60 — classic — Space Mo ││
│  └──────────────┘   │  └───────────────────────────────────┘│
│  ┌ Résolution ──┐   │                                       │
│  │ Width ████░  │   │  ██████████████████████████           │
│  │ Font px ██░  │   │  ████ ASCII ART OUTPUT ████           │
│  └──────────────┘   │  ██████████████████████████           │
│  ┌ Mode ────────┐   │                                       │
│  │Classic│Edge  │   │                                       │
│  │Block  │Brail │   │                                       │
│  └──────────────┘   │                                       │
│  ┌ Police ──────┐   │                                       │
│  │ ...          │   │                                       │
│  └──────────────┘   │                                       │
│  ┌ Charset ─────┐   │                                       │
│  │ ...          │   │                                       │
│  └──────────────┘   │                                       │
│  ┌ Options ─────┐   │                                       │
│  │ Inverser  ○  │   │                                       │
│  │ Couleur   ○  │   │                                       │
│  │ Contraste ○  │   │                                       │
│  │ Ratio     ●  │   │                                       │
│  └──────────────┘   │                                       │
│  [ Générer → ]      │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

La sidebar est sticky et scrollable indépendamment de la zone de sortie.

### Mobile (≤ 768px)

La sidebar se masque et devient un overlay plein-écran activé par le bouton **⊟ Paramètres** en bas de l'écran. Une barre fixe en bas expose aussi le bouton **Générer →**. Après génération, la sidebar se ferme automatiquement.

---

## Personnalisation

### Modifier le thème couleur

Toutes les couleurs sont des variables CSS dans `:root` dans `style.css` :

```css
:root {
  --bg: #080808;        /* Fond principal */
  --bg2: #0f0f0f;       /* Fond sidebar */
  --bg3: #161616;       /* Fond éléments UI */
  --accent: #e8ff47;    /* Jaune fluo (boutons, highlights) */
  --accent2: #47ffe8;   /* Cyan (police, charset actif) */
  --text: #f0f0e8;      /* Texte principal */
  --muted: #666;        /* Texte secondaire */
}
```

### Ajouter un jeu de caractères

Dans `script.js`, étendre l'objet `CHARSETS` :

```js
const CHARSETS = {
  // ... existants
  monCharset: ' .oO0@'  // Du plus clair au plus sombre
};
```

Puis ajouter le bouton correspondant dans le HTML (section `#charset-section`).

### Modifier la plage de résolution

Changer les attributs `min`, `max` et `value` du slider `#width-slider` dans le HTML :

```html
<input type="range" id="width-slider" min="20" max="500" value="120" step="1">
```

---

## Compatibilité navigateurs

| Navigateur | Support |
|-----------|---------|
| Chrome / Edge 90+ | ✅ Complet |
| Firefox 90+ | ✅ Complet |
| Safari 15+ | ✅ Complet |
| Chrome Android | ✅ Complet (interface mobile) |
| Safari iOS 15+ | ✅ Complet (interface mobile) |
| IE 11 | ❌ Non supporté |

Fonctionnalités requises : `Canvas API`, `FileReader`, `Clipboard API` (copie uniquement), `Unicode BMP + SMP` (braille), `CSS Custom Properties`, `CSS Grid`.

---

## Limitations connues

- **Export SVG/PNG** : les polices Google Fonts ne sont pas embarquées dans les exports. Le rendu dépend des polices installées sur la machine cible.
- **Mode couleur** : crée un nœud DOM par caractère — lent au-delà de ~150 colonnes.
- **Braille sur mobile** : l'affichage dépend du support Unicode du système (rendu parfois incorrect sous iOS < 15).
- **Mode Edge** : les performances peuvent baisser sur des images très haute résolution (>200 colonnes) en raison du filtre gaussien 5×5 et du Sobel calculés en pur JS.
- **Clipboard API** : non disponible via le protocole `file://` — utiliser un serveur local pour la fonctionnalité de copie.
