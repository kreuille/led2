# Architecture technique

## Choix initial

Application web front-end statique, TypeScript, composants modulaires et couche API dédiée à WLED.

## Structure cible

```text
led2/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── connection/
│   │   ├── lighting/
│   │   ├── segments/
│   │   └── presets/
│   ├── lib/
│   │   ├── wled-api.ts
│   │   ├── validation.ts
│   │   └── storage.ts
│   └── styles/
├── tests/
├── docs/
└── README.md
```

## Flux de données

```text
Interface → état local → WLED API → réponse WLED → état local → interface
```

Les commandes doivent être centralisées dans `wled-api.ts`. Les composants ne doivent pas construire directement les URLs réseau.

## Compatibilité réseau

- Support HTTP local au départ.
- Timeout court et explicite.
- Gestion de CORS et des erreurs de connexion.
- Support futur de mDNS et de plusieurs appareils.

## Sécurité

- Aucun token ou mot de passe dans le code.
- Validation stricte des adresses saisies.
- Dépendances versionnées.
- Pas de `innerHTML` avec des données provenant du réseau.
