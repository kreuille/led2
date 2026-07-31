# Plan de tests

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
