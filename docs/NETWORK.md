# Réseau et découverte WLED

## Détection du préfixe

LED2 propose d'abord les préfixes déduits des appareils déjà mémorisés et de l'adresse actuellement saisie, puis tente de compléter la liste via WebRTC. Les navigateurs récents peuvent remplacer l'adresse locale par un nom mDNS ou masquer complètement cette information.

Dans ce cas, saisir manuellement le préfixe de trois octets du réseau, par exemple `192.168.0`, `192.168.1` ou `10.0.0`, puis lancer le scan. LED2 vérifie les adresses `1` à `254` et appelle `/json/info` pour reconnaître WLED.

## Conditions de fonctionnement

- l'appareil et le navigateur doivent être sur le même réseau local ;
- dans Chrome, accepter la demande « Rechercher des appareils sur votre réseau local » lors du premier scan ;
- l'API WLED doit accepter les requêtes depuis l'origine de LED2 (CORS) ;
- LED2 marque explicitement ses requêtes comme destinées au réseau local afin que les navigateurs compatibles puissent demander cette autorisation ;
- certains navigateurs peuvent encore bloquer les requêtes depuis GitHub Pages en HTTPS vers un WLED en HTTP ;
- pour un scan complet et fiable, utiliser LED2 en local ou ajouter un petit service compagnon sur le réseau local.

## Mémorisation

Les appareils sélectionnés sont conservés dans le `localStorage` du navigateur, avec leur adresse et leur nom. Aucun secret ni token n'est envoyé au dépôt ou à un serveur distant.
