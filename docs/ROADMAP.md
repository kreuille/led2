# Feuille de route

## Phase 0 — fondations

- Créer le projet TypeScript
- Définir l’architecture
- Ajouter le linting et le formatage
- Ajouter le README et la documentation
- Ajouter le pipeline de vérification

## Phase 1 — connexion et état

- Saisie et validation de l’adresse WLED
- Test de connexion
- Lecture de `/json/info` et `/json/state`
- Gestion des erreurs et du mode hors ligne

## Phase 2 — contrôles principaux

- Marche/arrêt
- Luminosité
- RGB
- Blanc et température de couleur
- Synchronisation après commande

## Phase 3 — segments, effets et presets

- Segments dynamiques
- Effets WLED
- Vitesse et intensité
- Presets et scènes

## Phase 4 — qualité produit

- Tests d’interface
- Accessibilité
- Support multi-appareils
- PWA et installation mobile
- Déploiement GitHub Pages

## Phase 5 — consolidation réalisée

- Synchronisation périodique et reprise après coupure Wi-Fi
- Ambiances indépendantes par étagère
- Sélection tactile, plage et historique annuler/rétablir
- Sauvegarde/restauration complète avec confirmation
- Normalisation et échappement des données externes
- Tests unitaires du modèle et audit des dépendances

## Phase 6 — studio visuel réalisé (V14–V15)

- Scènes multi-zones composées directement depuis le plan du meuble
- Couches RGB, blanc, extinction, intensité et effet
- Contrôle automatique de la limite de segments WLED
- Transitions natives et animations ordonnées avec durée/répétition

## Phase 7 — autonomie réalisée (V16–V17)

- Enregistrement des scènes visuelles comme presets matériels WLED
- Jusqu’à huit programmations horaires exécutées par le contrôleur
- Synchronisation NTP Europe centrale sans cloud ni Home Assistant
- Assistant de première configuration et finition iPhone/PWA
- Sauvegarde/restauration de toutes les scènes, animations et programmations
