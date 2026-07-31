# Guide de développement

## Règles

- Une fonctionnalité = une branche ou un commit identifiable.
- Ne pas mélanger refactorisation et changement fonctionnel important.
- Toute commande réseau doit avoir un timeout et une gestion d’erreur.
- Toute nouvelle fonctionnalité doit être documentée.
- Ne jamais introduire de clé ou donnée sensible.

## Première itération recommandée

1. Initialiser le projet front-end TypeScript.
2. Créer le client WLED avec `getInfo()`, `getState()` et `updateState()`.
3. Ajouter un écran de connexion minimal.
4. Afficher l’état courant de l’appareil.
5. Ajouter les tests du client API.

## Definition of Done

- Fonctionnalité utilisable sur mobile.
- État de chargement visible.
- Erreur réseau compréhensible.
- Tests ajoutés ou justification documentée.
- Aucun avertissement de lint.
- Documentation mise à jour.
