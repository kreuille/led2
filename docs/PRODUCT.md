# Spécification produit

## Vision

LED2 doit rendre le contrôle de WLED simple pour une personne non technique, tout en restant assez précis pour un usage avancé.

## Principes

- L’état affiché doit refléter l’état réel du contrôleur.
- Une commande doit être compréhensible et réversible.
- L’interface doit fonctionner d’abord sur mobile.
- La configuration doit être progressive : connexion rapide, réglages avancés ensuite.
- Aucun secret ne doit être stocké dans le dépôt.

## MVP

- Une page de connexion à un appareil WLED
- Validation de l’adresse et test de connectivité
- État de connexion visible
- Marche/arrêt
- Luminosité
- Sélecteur RGB
- Température de blanc
- Liste dynamique des segments
- Effet et paramètres principaux
- Presets récupérés depuis WLED
- Messages d’erreur exploitables

## Hors périmètre initial

- Authentification multi-utilisateur
- Synchronisation cloud
- Éditeur d’animations avancé
- Automatisations temporelles
- Application native iOS/Android
