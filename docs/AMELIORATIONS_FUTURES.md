# Améliorations futures du plugin HTML to Figma

Ce document liste les améliorations à apporter au plugin pour de meilleures conversions.

---

## 📋 Éléments à ignorer automatiquement

Lors de l'extraction, ces éléments ne doivent **pas être importés** dans Figma car ils sont invisibles ou non pertinents :

| Élément | Pourquoi l'ignorer |
|---------|-------------------|
| Éléments cachés (`display: none`) | Contenu masqué, pas visible sur la page |
| Éléments transparents (`opacity: 0`) | Invisible à l'œil |
| Éléments invisibles (`visibility: hidden`) | Caché mais occupe de l'espace |
| SVG imbriqués (SubSVG) | Évite les doublons, on garde le SVG parent |
| Éléments trop petits (< 1px) | Éléments techniques sans contenu visuel |
| Balises `<use>` dans les SVG | À remplacer par leur contenu réel |
| Éléments du Shadow DOM | Gérer via une fonction dédiée |
| Enfants de `<picture>` (sauf le premier) | Évite les doublons d'images responsives |
| Éléments avec `overflow: hidden` et `height: 0` | Conteneurs vides masqués |

---

## 🎨 Améliorations de l'extraction (n8n)

### 1. Arrière-plans manquants

**Problème** : Certains fonds de section ne sont pas importés.

**Solution** : Capturer les styles CSS `background-image` et les gradients, pas seulement `background-color`.

---

### 2. Images non chargées

**Problème** : Les images avec chargement différé (lazy loading) n'apparaissent pas.

**Solution** : Utiliser l'attribut `data-src` ou `srcset` quand `src` est un placeholder ou vide.

---

### 3. Fonds des icônes SVG absents

**Problème** : Les icônes avec un cercle ou carré de fond perdent leur arrière-plan.

**Cause** : Le fond est un élément HTML parent du SVG, pas dans le SVG lui-même.

**Solution** : Quand on extrait un SVG, vérifier si son parent direct a un fond coloré et l'inclure.

---

### 4. Textes tronqués

**Problème** : Certains textes sont coupés dans Figma.

**Solution** : ✅ Résolu - Les textes utilisent maintenant une taille automatique.

---

### 5. Centrage des éléments

**Problème** : Les boutons et titres ne sont pas centrés correctement.

**Solution** : ✅ Résolu - L'Auto Layout ne positionne plus les enfants manuellement.

---

## 🔧 Améliorations du plugin Figma

### 1. Nommage des calques

- ✅ Fait - Les calques utilisent des noms sémantiques (Container, Button, Link, etc.)

### 2. Simplification des calques

- ✅ Fait - Les conteneurs inutiles sont fusionnés
- ✅ Fait - Les éléments d'accessibilité (sr-only) sont ignorés

### 3. Support Auto Layout

- ✅ Fait - Les conteneurs flex sont convertis en Auto Layout Figma

---

## 📝 Notes techniques

Ces notes sont pour référence lors de l'implémentation :

```
- backgroundColor: null → vérifier background-image CSS
- imageSrc vide → chercher data-src, data-lazy-src, srcset
- SVG avec fond → remonter au parent pour le fond
- Éléments <use> → injecter le contenu référencé
```

---

*Dernière mise à jour : Décembre 2024*
