# LED2

Application web moderne pour piloter des appareils WLED.

Version publique : https://kreuille.github.io/led2/

## Démarrer localement

```bash
npm install
npm run dev
```

La version actuelle permet de connecter un appareil, scanner une plage réseau, mémoriser les appareils trouvés, piloter l'alimentation et la luminosité, et sélectionner un effet WLED.

Les scènes enregistrées peuvent aussi être envoyées en parallèle à tous les appareils mémorisés.

La version PWA reprend maintenant le moteur WLED V34 Matrix fourni : 97 zones/194 LED, modes Segments et Matrix HD, canaux RGB et blanc indépendants, fusion, presets matériels, liste dynamique des effets et réglages vitesse/intensité.

La vue « Plan du meuble » utilise une vue frontale plane du meuble. Les 97 zones sont représentées directement sur les bandeaux à leurs proportions réelles : 42 sur l’étagère basse, 13 sur la petite et 42 sur la haute. Chaque point peut être sélectionné sur l’image ; les raccourcis par étagère et la grille numérotée restent disponibles.

Le mode « Application directe » envoie automatiquement la sélection à WLED après chaque toucher, avec une courte temporisation pour regrouper les gestes successifs. Il peut être désactivé pour préparer une sélection avant de l’appliquer manuellement. La photo accepte aussi le glisser tactile, la sélection d’une plage entre deux LED et l’annulation/rétablissement.

LED2 synchronise l’état réel de WLED toutes les 2,5 secondes et tolère les coupures réseau brèves. Les trois étagères ont chacune leur mode, couleur ou température et intensité. Les ambiances TV, Soirée, Veilleuse, Blanc total et Couleurs peuvent être appliquées en un geste.

La sauvegarde complète regroupe dans un fichier JSON la configuration WLED, ses presets, son état et les préférences LED2. Ce fichier peut ensuite restaurer l’application seule hors connexion, ou l’ensemble lorsqu’un contrôleur WLED est connecté.

Depuis la V10, le fichier est d’abord contrôlé puis présenté pour confirmation : choisir un fichier ne modifie plus immédiatement WLED. Les adresses, noms, scènes et effets provenant du réseau ou d’une sauvegarde sont normalisés et échappés avant affichage. Des tests unitaires couvrent ces protections et la reconstruction des zones.

Pour un fonctionnement iPhone uniquement sur le Wi-Fi, sans Home Assistant ni cloud, LED2 peut être hébergée directement par WLED. Voir [`docs/WLED_WIFI.md`](docs/WLED_WIFI.md).

Par sécurité, aucun token Home Assistant n'est intégré au JavaScript public. Toute future connexion Home Assistant devra passer par une configuration locale ou un proxy authentifié.

Les détails de la découverte réseau sont décrits dans [`docs/NETWORK.md`](docs/NETWORK.md).

Le scan réseau depuis GitHub Pages peut être limité par le navigateur (HTTPS vers des appareils locaux en HTTP) ou par la configuration CORS de WLED. Pour un usage local complet, lancer LED2 avec `npm run dev` sur le même réseau que les appareils.

Nouvelle génération de l’interface web de contrôle WLED.

## Objectif

Créer un contrôleur WLED moderne, fiable et maintenable, utilisable sur mobile et ordinateur, sans backend obligatoire.

## Fonctionnalités disponibles

- Connexion à un ou plusieurs contrôleurs WLED
- Découverte et configuration des appareils
- Contrôle marche/arrêt et luminosité
- Couleurs RGB et blanc réglable
- Effets, vitesse et intensité
- Segments et zones dynamiques
- Presets et scènes
- Synchronisation de l’état réel de l’appareil
- Gestion claire des erreurs réseau
- Interface responsive et accessible

## Démarrage dans Codex

Lire les documents dans cet ordre :

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ROADMAP.md`
4. `docs/DEVELOPMENT.md`
5. `docs/TEST_PLAN.md`

## Statut

Version 10 — contrôle Wi-Fi complet, plan interactif 97 zones, synchronisation et reprise réseau, ambiances par étagère, gestes tactiles, presets, restauration confirmée et tests de sécurité.
