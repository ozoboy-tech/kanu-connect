# Lot 3.08 — authentification

## Choix retenus

- Inscription par e-mail et mot de passe : nom légal privé et pseudo public unique. Le pseudo est généré si le champ est vide. Un e-mail doit être vérifié avant la connexion.
- Google, GitHub et GitLab : aucune adresse e-mail n'est exigée dans l'application. Chaque identité externe crée son propre membre tant qu'un membre connecté n'a pas demandé un rattachement explicite. Le nom légal et le pseudo sont saisis sur `/onboarding` après la première connexion OAuth.
- Sessions : 7 jours maximum sans activité et 30 jours maximum depuis leur création ; la déconnexion et la réinitialisation du mot de passe révoquent les sessions correspondantes.
- Auth.js gère les échanges OAuth et le cookie JWT ; MySQL conserve les sessions révocables, identités et jetons hachés. Nodemailer envoie les e-mails SMTP.

## Configuration locale Windows

Les identifiants MySQL utilisés auparavant restent dans `%APPDATA%\KanuConnect`. `scripts/run-auth-dev.ps1` charge `app-test.xml` par défaut. Il crée et conserve aussi une clé Auth.js chiffrée pour le compte Windows. Depuis PowerShell, à la racine du dépôt :

```powershell
npm run setup:windows
.\run-db-tests.ps1
.\scripts\run-auth-dev.ps1
```

Si `run-db-tests.ps1` est conservé à un autre emplacement, exécuter son chemin habituel. Pour travailler sur la base de développement, enregistrer une seule fois son compte d'application, si ce n'est pas déjà fait :

```powershell
$path = Join-Path $env:APPDATA 'KanuConnect\app-dev.xml'
Get-Credential -UserName 'kanu_app_dev' | Export-Clixml $path
.\scripts\run-auth-dev.ps1 -Target dev
```

Le mot de passe ne doit pas figurer dans le dépôt. `run-auth-dev.ps1` démarre sur `http://127.0.0.1:3000` ; utiliser cette même origine pour les appels API et les URLs de rappel OAuth. La base cible doit avoir reçu les migrations 0006 à 0011. Le script de test existant charge les secrets de migration et lance les tests d'intégration.

Configurer le serveur SMTP via `KANU_SMTP_HOST`, `KANU_SMTP_PORT`, `KANU_SMTP_USER`, `KANU_SMTP_PASSWORD` et `KANU_SMTP_FROM` dans l'environnement du processus. Les envois utilisent TLS implicite au port 465 et STARTTLS sur les autres ports si le serveur l'annonce. Garder le mot de passe SMTP hors du dépôt. Sans SMTP, les demandes d'envoi retournent 503.

Chaque fournisseur est activé seulement lorsque ses deux variables sont présentes : `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AUTH_GITLAB_ID`/`AUTH_GITLAB_SECRET`. Enregistrer les URLs de rappel suivantes chez les fournisseurs :

| Fournisseur | URL de rappel locale |
| --- | --- |
| Google | `http://127.0.0.1:3000/api/auth/callback/google` |
| GitHub | `http://127.0.0.1:3000/api/auth/callback/github` |
| GitLab | `http://127.0.0.1:3000/api/auth/callback/gitlab` |

Sur un serveur public, utiliser HTTPS et une `AUTH_URL` correspondant à son origine. Fournir une clé `AUTH_SECRET` stable d'au moins 32 octets et les variables MySQL/SMTP dans les secrets du serveur.

## Parcours et API

Tous les `POST` applicatifs exigent un en-tête `Origin` égal à l'origine de `AUTH_URL` et du JSON (sauf `/api/auth/link/[provider]`, qui n'attend pas de corps). Depuis le navigateur, `fetch` envoie automatiquement l'origine lors des requêtes croisées ; le script de test PowerShell doit préciser `Origin` sur l'origine locale.

| Action | Point d'entrée | Corps JSON |
| --- | --- | --- |
| Inscription | `POST /api/register` | `email`, `password`, `legalName`, `handle` facultatif |
| Demander un nouvel e-mail de vérification | `POST /api/auth/email-token` | `email`, `purpose: "verify"` |
| Demander un nouveau mot de passe | `POST /api/auth/email-token` | `email`, `purpose: "reset"` |
| Vérifier l'adresse | `GET /api/auth/verify-email?token=…` | Lien reçu par e-mail |
| Enregistrer un nouveau mot de passe | `POST /api/auth/reset-password` | `token`, `password` ; page `/reset-password?token=…` |
| Connexion et déconnexion | `/api/auth/signin` et `/api/auth/signout` | Formulaires Auth.js avec protection CSRF |
| Compléter un compte OAuth | `POST /api/auth/onboard` | `legalName`, `handle` facultatif ; page `/onboarding` |
| Rattacher un fournisseur | `POST /api/auth/link/google` (ou `github`, `gitlab`) | Depuis une session complète ; ouvrir ensuite le `signInUrl` renvoyé dans le même navigateur sous 10 minutes |

L'inscription e-mail répond 201 après l'envoi ; la connexion reste impossible tant que le lien n'a pas été consommé. La demande de vérification ou de réinitialisation donne toujours la même réponse pour ne pas révéler l'existence d'un compte. Un nouveau mot de passe invalide toutes ses sessions. Une identité OAuth ayant déjà un propriétaire ne peut pas être rattachée à un autre membre.

## Vérifications

```powershell
npm test
npm run typecheck
npm run build
.\run-db-tests.ps1
```

Le test d'intégration `member-auth.test.ts` crée des comptes aléatoires dans `kanuconnecttest`, puis les supprime. Il vérifie la validation de l'e-mail, l'isolation OAuth, le rattachement explicite, l'expiration des sessions, le changement de mot de passe et la révocation. Le parcours SMTP et les consentements Google/GitHub/GitLab nécessitent un serveur SMTP et des identifiants de fournisseur réels pour une vérification manuelle.
