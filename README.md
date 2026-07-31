# LED2

Application web moderne pour piloter des appareils WLED.

Version publique : https://kreuille.github.io/led2/

## Démarrer localement

```bash
npm install
npm run dev
```

La version actuelle permet de connecter un appareil, scanner une plage réseau, mémoriser les appareils trouvés, piloter l'alimentation et la luminosité, et sélectionner un effet WLED.

Le scan réseau depuis GitHub Pages peut être limité par le navigateur (HTTPS vers des appareils locaux en HTTP) ou par la configuration CORS de WLED. Pour un usage local complet, lancer LED2 avec `npm run dev` sur le même réseau que les appareils.

Nouvelle génération de l’interface web de contrôle WLED.

## Objectif

Créer un contrôleur WLED moderne, fiable et maintenable, utilisable sur mobile et ordinateur, sans backend obligatoire.

## Fonctionnalités prévues

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

Phase 0 — cadrage et fondations.
