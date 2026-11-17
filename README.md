# Portail Enseignant — Gestionnaire de Classe & Groupes

Application web locale pour gérer des classes, des notes par matière et générer des **groupes équilibrés**, sans serveur ni base de données.

Les données restent uniquement dans le navigateur (`localStorage`).

## Fonctionnalités

### Répertoire des élèves (`pages/eleves.html`)
- Créer / supprimer des classes
- Ajouter des matières avec seuils **fort** / **faible** (utilisés pour l’équilibrage)
- Saisir les élèves et leurs notes par matière
- Exporter / restaurer une **sauvegarde complète** (fichier JSON)

### Générateur de groupes (`pages/generateur.html`)
- Choisir une classe et une matière
- Définir des **séparations** (élèves qui ne doivent pas être ensemble)
- Générer un nombre de groupes configurable, équilibrés selon les notes
- Réajuster manuellement par **glisser-déposer**
- Exporter en Word / OpenOffice ou en JSON, et recharger des groupes sauvegardés

## Structure du projet

```
Gaelle/
├── index.html              # Accueil / portail
├── style.css               # Styles communs
├── package.json            # Métadonnées (app desktop éventuelle)
├── pages/
│   ├── eleves.html         # Répertoire classes / matières / élèves
│   └── generateur.html     # Générateur de groupes
└── script/
    ├── eleves.js
    └── generateur.js
```

## Démarrage

Aucune installation ni dépendance n’est requise.

1. Ouvrir `index.html` dans un navigateur moderne (Chrome, Edge, Firefox…).
2. Commencer par le **Répertoire des élèves**, puis passer au **Générateur**.

Alternative : servir le dossier en local, par exemple :

```bash
npx serve .
```

Puis ouvrir l’URL indiquée dans le terminal.

## Utilisation rapide

1. **Répertoire** — créer la classe, les matières, puis les élèves et leurs notes  
2. **Générateur** — choisir classe & matière, ajouter les séparations, générer  
3. **Ajuster** — glisser un élève d’un groupe à l’autre si besoin  
4. **Exporter** — sauvegarde complète et/ou export Word / groupes  

## Données & confidentialité

| Point | Détail |
|--------|--------|
| Stockage | Navigateur uniquement (`localStorage`) |
| Serveur | Aucun — rien n’est envoyé en ligne |
| Sauvegarde | Export JSON recommandé avant nettoyage du navigateur |

Les données peuvent disparaître si vous effacez le stockage du site, utilisez la navigation privée puis fermez la fenêtre, ou changez d’ordinateur / de navigateur sans restaurer une sauvegarde.

## Technologies

- HTML / CSS / JavaScript (vanilla)
- Stockage local navigateur
- Aucune dépendance npm pour le fonctionnement courant
