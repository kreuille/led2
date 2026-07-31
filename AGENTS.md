# Instructions de développement LED2

## Avant toute modification

1. Lire `README.md`.
2. Lire les documents pertinents dans `docs/`.
3. Vérifier que la modification respecte le périmètre produit de `docs/PRODUCT.md`.

## Principes

- Préserver la compatibilité avec les versions courantes de WLED.
- Ne jamais enregistrer de secrets, tokens ou adresses privées dans le dépôt.
- Préférer des changements petits, testables et réversibles.
- Garder l'interface utilisable sur mobile et desktop.
- Toute fonctionnalité réseau doit gérer les erreurs, les délais d'attente et l'absence de réponse.

## Validation minimale

- Vérifier le rendu dans un navigateur.
- Tester les états de chargement, erreur et succès.
- Mettre à jour la documentation si le comportement ou l'architecture change.
- Consulter `docs/TEST_PLAN.md` avant de déclarer une fonctionnalité terminée.

## Priorité actuelle

La première itération doit établir le socle TypeScript, le client API WLED et le modèle d'état décrit dans `docs/ARCHITECTURE.md`.
