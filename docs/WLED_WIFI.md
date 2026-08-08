# LED2 directement sur le Wi-Fi WLED

La commande `npm run build` crée `dist/led2.htm`, une version autonome qui contient le JavaScript et les styles dans un seul fichier.

## Installation

1. Ouvrir `http://adresse-du-wled/edit` depuis un appareil connecté au même Wi-Fi.
2. Téléverser `dist/led2.htm` à la racine du système de fichiers WLED sous le nom `/led2.htm`.
3. Sur l'iPhone, ouvrir `http://adresse-du-wled/led2.htm` dans Safari.
4. Utiliser **Partager → Sur l'écran d'accueil** pour créer l'icône LED2.

Dans ce mode, LED2 utilise automatiquement le WLED qui héberge la page. Aucun scan, cloud ou Home Assistant n'est nécessaire.
