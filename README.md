# 🚁 SOS HELI — Inventaire Unique (PWA)

App web installable (PWA, GitHub Pages, sans serveur, sans dépendance) pour gérer
l'**inventaire unique du matériel SOS HÉLIPORTE**, construite le 2026-10-11 à partir
de la feuille « INVENTAIRE UNIQUE » du fichier `Inventaire.xlsx` (115 références :
DOCUMENTATION 2 · TRANSMISSION 13 · INCENDIE 100).

**https://jeffbuzz060684.github.io/sos-heli-inventaire/**

Même modèle que les autres apps (Patrimoine, Tâches & Relances, Contrôles Matériel) :
un seul `index.html`, harnais de tests Node, CI GitHub Actions, service worker.

## ✨ Fonctionnalités

1. **Écarts recalculés en direct = formules exactes de l'Excel** :
   TOTAL RÉEL = `SUM(E:N)` (somme des 10 lieux), ÉCART = `O−D`
   (réel − chargé). Récapitulation en tête : NB RÉFÉRENCES · Σ TOTAL RÉEL ·
   ÉCART GLOBAL · NON VÉRIFIÉ · MAJ origine (24/08/2026).
   Au chargement du seed : **1227 réel · +504 global · 10 non vérifiées**
   (identique aux valeurs en cache E5/K5/O5 de l'Excel, vérifié openpyxl).
2. **Statuts** : ⚪ non vérifié (pas de date de contrôle) ; sinon écart < 0 →
   🔴 manque, écart > 0 → 🔵 excès, écart nul → 🟢 conforme.
   Seed : 80 conformes · 17 excès · 8 manques · 10 non vérifiées.
3. **✅ Vérification en 1 geste** : bouton ✔ = date de contrôle aujourd'hui ;
   ou vérification datée + note depuis la fiche ; historique par référence ;
   Annuler 5 s partout.
4. **Fiche référence** : section (datalist), réf NNO/MAT, libellé, total chargé,
   grille des 10 lieux (CMDIH, VRCG, VHR, VL 75, CM IBN LVN, CM IBN GIMAE,
   GRANDE SOUTE, SOUTE HELI, SOUTE GIMAE, BUREAU), date de contrôle,
   observation ; aperçu live RÉEL/ÉCART/statut pendant la saisie.
5. **Navigation** : 4 compteurs cliquables (manques/excès/conformes/non
   vérifiés = filtres), recherche plein texte (libellé + NNO + observation +
   section), select section, sections repliables avec compteurs.
6. **🔔 Alertes** : bandeau « manques d'abord, puis non vérifiées, puis excès »
   (8 lignes max, bouton ✔ direct) + badge sur l'icône de l'app installée.
7. **🕘 Journal** des modifications horodaté (vérification, édition champ par
   champ sans diff fantôme, ajout, suppression, annulation, import), plafond
   500, export CSV (BOM UTF-8, `;`) à répercuter dans l'Excel d'origine.
8. **Ajout / suppression** de références avec tombstones (propagation Drive).
9. **☁️ Sauvegarde Google Drive** : refresh token `drive.file`, dossier
   configurable (défaut `taffbmpm`), fichier `sos-heli-inventaire.json`,
   pull-before-push + fusion par `u` (updatedAt) + tombstones 180 j,
   auto 30 s après modif, restauration + secours local, export JSON,
   export CSV complet (colonnes identiques à l'Excel).
10. **PWA** : manifest, service worker (cache `sos-heli-inventaire-v1`),
    icônes générées au build (`tools/gen-icons.js`), bannière d'erreur
    visible (`window.onerror`), export avec secours « Partage Android ».

## 🧪 Tests

- `node v1-test-harness.js index.html sw.js` — **97 tests, 0 échec**
  (seed vs Excel, formules, filtres, vérif+undo, diffs champ par champ,
  journal, exports, import round-trip, Drive pull/push/fusion/tombstones,
  verrous de version).
- `node strict-dom-test.js index.html` — boot réel avec DOM strict
  (getElementById → null si id inconnu) : aucun crash, aucun id manquant.
- CI GitHub Actions (`tests.yml`) joue les deux à chaque push.

## ⚙️ Configuration Google Drive (une seule fois)

Même config que les autres apps (voir README de sos-heli-controles) :
Client ID + Refresh Token OAuth `drive.file` (OAuth Playground), dossier
`taffbmpm`. Options → ⚙️ dans la carte Sauvegarde.

## 📁 Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | App complète v1 (seed 115 références inclus) |
| `index.template.html` | Template sans seed (marqueur `/*__SEED__*/`) |
| `sw.js` | Service worker (cache `sos-heli-inventaire-v1`) |
| `manifest.webmanifest` | Manifeste PWA |
| `v1-test-harness.js` | Harnais Node 97 tests |
| `strict-dom-test.js` | Boot DOM strict |
| `tools/gen-icons.js` | Icônes PNG pur Node (joué par le workflow) |
| `.github/workflows/` | `tests.yml` (CI) + `pages.yml` (déploiement) |

## 📊 Extraction (2026-10-11, openpyxl)

- Feuille « INVENTAIRE UNIQUE », lignes 8-123 (117 vide, pas de ligne 777),
  colonnes A-R ; formules O/P/S/T ignorées (recalculées par l'app),
  Q (date contrôle) et R (observation) conservées.
- Colonnes : SECTION, RÉF NNO/MAT, LIBELLÉ, TOTAL CHARGÉ, 10 lieux,
  TOTAL RÉEL, ÉCART, DATE CONTRÔLE, OBSERVATION (+ Cle tri / Rang, non reprises).
