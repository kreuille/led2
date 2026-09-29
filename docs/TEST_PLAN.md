# Plan de tests

## Validation V17

- Assistant en quatre étapes, persistance de fin et relance manuelle
- Messages différents pour Safari iPhone, mode autonome et navigateur standard
- Affichage hors ligne sans bloquer l’accès aux scènes enregistrées
- Manifeste PWA enrichi, cache `led2-v17`, zones sûres iPhone et zéro débordement à 390 px

## Validation V16

- Création et validation d’horaires 24 h, jours, preset 1–250 et activation
- Conversion des jours en masque WLED et limite à huit minuteries
- Synchronisation prévue avec NTP, fuseau Europe centrale et heure Unix actuelle
- Aucune programmation de test laissée sur le contrôleur réel

## Validation V15

- Création d’une animation à partir de scènes existantes
- Durée 1–3600 secondes, répétition finie ou boucle et arrêt manuel
- Nettoyage automatique des étapes lorsqu’une scène est supprimée
- Transitions converties en dixièmes de seconde pour l’API WLED

## Validation V14

- Normalisation des couches, couleurs, températures, intensités, effets et zones
- Priorité à la dernière couche en cas de chevauchement
- Génération entrelacée des segments RGB pairs et blancs impairs
- Refus explicite d’une composition dépassant la capacité de segments WLED
- Persistance et sauvegarde/restauration des scènes visuelles

## Validation V13

- Cinq raccourcis physiques vérifiés : bas gauche/droite, petite étagère et haut gauche/droite
- Correspondance contrôlée avec le câblage : bas droite LED 1–21 et haut gauche LED 77–97
- Création, rappel et suppression d’un favori de 21 LED sur une largeur de 390 px
- Normalisation des index restaurés : conversion numérique, dédoublonnage, tri et rejet des valeurs hors limites
- Favoris de zones et niveau de zoom inclus dans la sauvegarde complète et restaurés dans le stockage local
- Aucun débordement horizontal et aucune erreur navigateur sur mobile

## Validation V12

- Ordre visuel de onze sections contrôlé sur une largeur de 390 px
- Six raccourcis de navigation et suivi automatique de la section visible
- Zoom 100–300 % limité par le modèle et mémorisé dans le navigateur
- Largeur interne du plan doublée à 200 % sans débordement de la page
- Mode plein écran fixe, verrouillage du fond et fermeture avec Échap
- Conservation des 97 marqueurs et des gestes de sélection dans le plan zoomé

## Validation V11

- Diagnostic vérifié contre le contrôleur réel : WLED 0.15.3, ESP32, 194 LED et signal Wi‑Fi
- Heure de dernière synchronisation rafraîchie sans reconstruire l’interface
- Vingt événements rapides du curseur produisent une seule requête POST
- Affichage mobile du diagnostic sans débordement horizontal
- Tests unitaires des seuils Wi‑Fi, du temps de fonctionnement et des limites 0–255

## Validation V10

- Tests unitaires de l’échappement HTML des données WLED
- Refus des protocoles d’adresse non HTTP(S) et des URL contenant des identifiants
- Reconstruction testée des zones éteintes, entrelacées et Matrix
- Validation stricte de la signature d’une sauvegarde LED2
- Restauration en deux étapes : contrôle du fichier puis confirmation explicite
- Audit npm sans vulnérabilité connue

## Validation V9 réalisée

- Build TypeScript, bundle Vite et génération de `dist/led2.htm`
- Affichage de 97 marqueurs et de 3 étagères sans débordement à 390 px
- Sélection d’une plage 10–20 et historique d’annulation
- Connexion au contrôleur `192.168.68.106`
- Synchronisation d’une extinction externe puis d’un rallumage en moins de 3 secondes
- Application du preset TV en 6 segments aux limites 1–42, 43–55 et 56–97
- Export WLED + LED2 et réimportation hors connexion du fichier produit
- Restauration finale du contrôleur en blanc neutre

## Client API

- Adresse valide et invalide
- Appareil inaccessible
- Timeout
- Réponse JSON invalide
- Lecture de l’état
- Modification de la luminosité
- Modification de la couleur
- Mise à jour d’un segment

## Interface

- Premier chargement
- Connexion réussie
- Connexion échouée
- Reconnexion
- Contrôles désactivés pendant une commande
- Affichage mobile et bureau
- Navigation clavier
- Contraste et libellés accessibles

## Régression

- L’état visualisé correspond à WLED après actualisation.
- Une erreur ne bloque pas les commandes suivantes.
- Les valeurs extrêmes 0 et 255 sont correctement transmises.
