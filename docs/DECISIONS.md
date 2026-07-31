# Décisions techniques

## ADR-001 — Frontend TypeScript statique

LED2 démarre comme une application web statique en TypeScript. Cette approche conserve un déploiement simple dans WLED ou sur un hébergement statique, tout en permettant de tester le code et de le faire évoluer proprement.

## ADR-002 — Client API séparé de l'interface

Les appels à l'API WLED seront isolés dans un client dédié. L'interface ne devra pas construire directement les requêtes réseau : cela facilite les tests, la gestion des erreurs et l'évolution vers plusieurs appareils.

## ADR-003 — Modèle d'état explicite

La connexion, la synchronisation de l'appareil et les actions utilisateur seront représentées par des états explicites. L'interface devra distinguer au minimum l'initialisation, la disponibilité, l'erreur et la reconnexion.
