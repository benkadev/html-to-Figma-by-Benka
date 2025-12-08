# 📊 Améliorations du Plugin HTML-to-Figma v2.0

## Sources d'Inspiration

Les améliorations ont été inspirées par l'analyse de 4 projets similaires:

1. **html-figma-master** (Builder.io) - Le plus complet, avec gestion des arbres DOM et contraintes
2. **figma-html-master** (Builder.io) - Extension Chrome pour sites authentifiés
3. **html-to-figma-2** (Magic Patterns) - Excellent support des formulaires et Auto Layout
4. **html-to-figma-master** - Architecture modulaire et tests

---

## 🚀 Nouvelles Fonctionnalités

### 1. **Support des Éléments de Formulaire** (Magic Patterns)
- **INPUT**: Extraction de `value` et `placeholder` avec style approprié
- **TEXTAREA**: Support complet avec contenu de texte
- **SELECT**: Affichage de l'option sélectionnée
- Placeholder en gris clair (`rgba(0.6, 0.6, 0.6, 1)`)
- Conservation des types d'input (`text`, `password`, `email`, etc.)

### 2. **Support des SVG `<use>` Elements** (Builder.io)
- Pré-traitement des éléments `<use>` qui référencent des `<symbol>`
- Remplacement automatique par le contenu du symbole
- Permet l'import de systèmes d'icônes modernes

### 3. **Support du Shadow DOM** (Builder.io)
- Traversée récursive des Shadow Roots
- Support des Web Components (custom elements)
- Compatible avec les sites utilisant Lit, Stencil, etc.

### 4. **Gestion des Gradients CSS**
- Détection des `linear-gradient` et `radial-gradient`
- Stockage du type et de la valeur CSS pour référence
- Préparation pour une future conversion en Figma GradientPaint

### 5. **TextTransform Appliqué** (Builder.io)
- `uppercase` → texte converti en majuscules
- `lowercase` → texte converti en minuscules
- `capitalize` → première lettre de chaque mot en majuscule
- Le texte Figma reflète exactement l'affichage web

### 6. **Contraintes Automatiques** (Builder.io)
- Détection basée sur `position: absolute/fixed`
- Analyse des propriétés `top/right/bottom/left`
- Support du positionnement Flexbox (`justify-content`, `align-items`)
- Gestion des `margin: auto` pour le centrage
- Application des contraintes Figma (`MIN`, `CENTER`, `MAX`, `SCALE`)

### 7. **Support des Video Posters** (Builder.io)
- Éléments `<video>` avec `poster` importés comme images
- Aperçu visuel des vidéos dans Figma

### 8. **Support des éléments `<picture>`** (Builder.io)
- Extraction intelligente depuis `<source srcset>`
- Fallback vers `<img>` si `source` non disponible

### 9. **Object-Fit pour Images** (Builder.io)
- `object-fit: contain` → `scaleMode: 'FIT'`
- `object-fit: cover` → `scaleMode: 'FILL'`
- `object-fit: none` → `scaleMode: 'CROP'`
- Border-radius appliqué aux images

### 10. **Nommage Sémantique des Layers** (Magic Patterns)
- Utilisation de `role` et `aria-label` si disponibles
- Noms basés sur les balises HTML sémantiques:
  - `HEADER` → "Header"
  - `NAV` → "Navigation"
  - `BUTTON` → "Button"
  - `H1`-`H6` → "Heading 1"-"Heading 6"
  - etc.

### 11. **Éléments Ignorés Supplémentaires**
- `DEFS`, `CLIPPATH`, `MASK` (éléments SVG internes)
- Gestion améliorée de `visibility: hidden` avec overflow

### 12. **CurrentColor Replacement** (html-to-figma-master)
- Remplacement de `currentColor` dans les SVG par la couleur CSS calculée
- Icônes SVG avec les bonnes couleurs

---

## 📁 Fichiers Modifiés

### `extraction_script.js`
- **+250 lignes** de nouvelles fonctionnalités
- Nouvelle version: **v2.0**
- Compatibilité n8n/Puppeteer maintenue

### `src/code.ts`
- Nouvelles interfaces: `ElementConstraints`, `Gradient`
- Interface `NodeData` enrichie avec de nouvelles propriétés
- Support object-fit dans `fetchImage()`
- Application des contraintes Figma

---

## 🔄 Compatibilité

- ✅ Compatible avec votre workflow n8n existant
- ✅ Pas de breaking changes sur l'API
- ✅ Build successful (`npm run build`)
- ✅ Syntaxe ES5 pour Puppeteer (pas de `const`/`let` dans `$page.evaluate`)

---

## 📋 Prochaines Améliorations Possibles

1. **Auto Layout Intelligent**: Détecter les layouts flex pour activer l'Auto Layout Figma
2. **Support Complet des Gradients**: Conversion des gradients CSS en GradientPaint
3. **Import de Fonts**: Téléchargement et application des polices web
4. **Composants Figma**: Détection de patterns réutilisables
5. **Variables CSS**: Support des custom properties pour les Design Tokens
