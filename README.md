# Kanu Connect

**Créer. Connecter. Avancer.** Une plateforme pour les développeurs africains : poser des questions, partager des connaissances, présenter des projets et collaborer.

Le dépôt contient le socle fonctionnel local de la phase 3, l'interface issue du prototype validé et les outils de recette du lot 3.32. La clôture effective dépend des contrôles et parcours renseignés dans [la recette](docs/phase3-recette.md).

## Stack et exécution

- Next.js App Router et TypeScript ; React pour les interfaces.
- Auth.js v5 : e-mail/mot de passe, Google, GitHub et GitLab lorsqu'ils sont configurés.
- MySQL Wamp 9.1.x en local ; connexions serveur via mysql2 ; Drizzle présent dans la stack.
- Migrations SQL versionnées, journal d'empreintes et comptes distincts application/migration.
- Vitest : tests unitaires et intégration MySQL ; CI Windows pour tests, types et build.

L'application Next.js utilise le port 3000. Wamp fournit MySQL sur `127.0.0.1:3306`.

## Démarrage sur un PC déjà configuré

Depuis `C:\wamp64\www\kanu-connect`, avec Node 24.15+ dans la série 24 et npm 12.2.0 :

```powershell
npm.cmd run setup:windows
if ($LASTEXITCODE -ne 0) { throw "Installation echouee." }
.\scripts\migrate-local.ps1 -Target dev
.\scripts\run-auth-dev.ps1 -Target dev
```

Ouvrir **http://localhost:3000**. Le lanceur charge les secrets existants dans `%APPDATA%\KanuConnect`. En mode développement local, les liens de vérification/réinitialisation peuvent être lus dans le terminal sans SMTP.

Pour installer le deuxième PC ou créer les identifiants locaux absents : [installation Windows](docs/windows-local.md). Les XML chiffrés appartiennent au compte Windows qui les a créés et ne doivent pas être transférés entre PC.

## Fonctions disponibles

- Questions, partages, tutoriels, annonces, opportunités et fiches de projets.
- Recherche de publications/membres/projets, tris, pagination, catégories, fil Pour vous/Abonnements.
- Profils publics, nom légal privé, compétences, historique et favoris privés.
- Réponses, votes positifs, solution communautaire, réputation, badges et flamme.
- Collaboration projet, rôles recherchés, retrait/décision des demandes et discussion d'équipe.
- Pièces jointes persistantes avec limites, contrôle des formats et de l'accès.
- Notifications et préférences ; modération, signalements, blocages et administration des comptes.
- Navigation mobile/desktop, bannière fermable et formulaires avec retours d'état.

## Contrôles et recette

Arrêter Next.js avec Ctrl+C et laisser MySQL Wamp actif avant le contrôle complet.

```powershell
npm.cmd run check:phase3
if ($LASTEXITCODE -ne 0) { throw "Controles de phase 3 echoues." }
```

Le script réutilise les quatre credentials locaux, exécute les tests, TypeScript et le build, puis vérifie les bases. Les tests écrivent leurs données jetables dans **kanuconnecttest** ; le contrôle de **kanuconnectdev** est en lecture seule.

Attendu après le lot 3.32 : **300 tests unitaires dans 39 fichiers**, **29 fichiers d'intégration MySQL**, **46 migrations appliquées**, dernière `0046_account_admin_audit.sql`. Les rapports sont conservés dans `%APPDATA%\KanuConnect`, avec date et commit.

Les commandes individuelles restent disponibles :

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

La CI « Tests, types et build » ne lance pas MySQL. Elle complète les contrôles locaux sur les deux PC et les [parcours de recette](docs/phase3-recette.md).

## Documentation

- [Installation et secrets locaux Windows](docs/windows-local.md)
- [Authentification et fournisseurs](docs/lot-3.08-auth.md)
- [Reprise des migrations](docs/migration-recovery.md)
- [Conditions de clôture de la phase 3](docs/phase3-closure.md)
- [Recette et résultats à renseigner](docs/phase3-recette.md)

## Limites de validation

Les modes e-mail console, SMTP et OAuth doivent être distingués dans le bilan : un lien affiché dans le terminal ne prouve pas une livraison SMTP, et un fournisseur non configuré n'est pas une connexion testée. Les exigences non satisfaites restent des réserves explicites.

Les secrets MySQL, SMTP, OAuth et Auth.js restent hors du dépôt. Les fichiers SQL déjà appliqués sont immuables. Le passage à la phase 4 utilise le commit et les preuves de clôture identifiés par l'équipe.
