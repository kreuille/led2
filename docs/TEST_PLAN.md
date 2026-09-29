# Plan de tests

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
