# Plan de tests

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
