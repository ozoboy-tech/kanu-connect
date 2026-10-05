# Reprise contrôlée des migrations MySQL

Les fichiers dans `db/migrations` sont immuables après application. En particulier,
`0001_members.sql` est déjà appliqué dans les bases de développement et de test.

L'exécution normale (`node scripts/migrate.mjs test` ou `dev`) arrête le traitement
si `members` existe sans ligne correspondante dans `_kanu_migrations`. Cela peut
survenir après une interruption entre le `CREATE TABLE` et l'insertion du journal :
MySQL ne garantit pas une transaction unique pour ces deux opérations.

Dans ce seul cas, inspecter la base et lancer explicitement
`node scripts/migrate.mjs reconcile test` (ou `dev`) avec la variable de mot de
passe de migration du compte cible. La commande contrôle la structure de la table
`members` et ne journalise `0001_members.sql` que si elle est conforme. Si la
structure diffère ou si la table est absente, elle échoue sans inscription.
Quand le journal contient déjà `0001`, la commande ne change rien.

Après une reprise réussie, relancer la commande de migration normale. Elle doit
indiquer zéro migration appliquée si aucune nouvelle migration n'est présente.
Ne jamais éditer une migration déjà appliquée pour tenter de réparer le journal.
