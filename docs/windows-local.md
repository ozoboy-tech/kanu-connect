# Installation et lancement local sur Windows

Cette procédure s'applique aux PC d'Ousmane et d'Amadou. Chaque PC utilise ses propres bases, comptes MySQL et fichiers privés. Les fichiers XML existants sont réutilisés ; il ne faut pas transférer les XML chiffrés d'un compte Windows vers un autre PC.

## Versions et chemins

| Élément | Configuration du projet |
|---|---|
| Dépôt | `C:\wamp64\www\kanu-connect` |
| Node.js | Série 24, au moins 24.15.0 ; version CI 24.21.0 |
| npm | 12.2.0 |
| MySQL Wamp | 9.1.0, famille 9.1.x ; `127.0.0.1:3306` |
| Application | `http://localhost:3000` |
| Bases utilisées | `kanuconnectdev`, `kanuconnecttest` |
| Base shadow existante | `kanuconnectshadow`, conservée ; ces scripts ne l'utilisent pas |
| Secrets locaux | `%APPDATA%\KanuConnect` |

Wamp fournit MySQL. Next.js démarre séparément sur le port 3000.

## 1. Récupérer le code et les dépendances

Pour un dépôt déjà présent et sans modifications locales :

```powershell
Set-Location -LiteralPath "C:\wamp64\www\kanu-connect" -ErrorAction Stop
git status --short
git switch main
if ($LASTEXITCODE -ne 0) { throw "Changement de branche echoue." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Mise a jour echouee." }
node --version
npm.cmd --version
```

Si le dépôt n'est pas encore présent, le cloner depuis GitHub :

```powershell
Set-Location -LiteralPath "C:\wamp64\www" -ErrorAction Stop
git clone https://github.com/ozoboy-tech/kanu-connect.git
if ($LASTEXITCODE -ne 0) { throw "Clone echoue." }
Set-Location -LiteralPath "C:\wamp64\www\kanu-connect" -ErrorAction Stop
```

Si npm n'est pas déjà en version 12.2.0 :

```powershell
npm.cmd install --global npm@12.2.0 --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw "Installation npm echouee." }
```

Installer les dépendances verrouillées et les binaires Windows prévus :

```powershell
npm.cmd run setup:windows
if ($LASTEXITCODE -ne 0) { throw "Installation des dependances echouee." }
```

## 2. Vérifier MySQL et les comptes locaux

Dans le client MySQL local de Wamp, vérifier :

```sql
SELECT VERSION() AS version, @@port AS port;
```

Attendu : MySQL 9.1.x et port 3306. Ne pas sélectionner MariaDB à la place du serveur utilisé par ce projet.

| Compte | Base | Hôte MySQL | Droits |
|---|---|---|---|
| `kanu_app_dev` | `kanuconnectdev` | `127.0.0.1` | SELECT, INSERT, UPDATE, DELETE |
| `kanu_migrate_dev` | `kanuconnectdev` | `127.0.0.1` | Les quatre précédents + CREATE, ALTER, INDEX, REFERENCES, DROP |
| `kanu_app_test` | `kanuconnecttest` | `127.0.0.1` | SELECT, INSERT, UPDATE, DELETE |
| `kanu_migrate_test` | `kanuconnecttest` | `127.0.0.1` | Les quatre précédents + CREATE, ALTER, INDEX, REFERENCES, DROP |

Sur un PC déjà installé, conserver ces comptes et leurs mots de passe. Sur un nouveau PC, créer les comptes absents dans la gestion des utilisateurs de Wamp/phpMyAdmin avec l'hôte **127.0.0.1**, choisir les mots de passe localement, puis attribuer les droits ci-dessus. Les mots de passe ne doivent pas être copiés dans un fichier du dépôt.

Créer uniquement les bases absentes, depuis le compte MySQL administrateur local :

```sql
CREATE DATABASE IF NOT EXISTS `kanuconnectdev`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS `kanuconnecttest`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

Si les comptes existent mais que leurs droits n'ont pas encore été attribués sur ce PC :

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON `kanuconnectdev`.* TO 'kanu_app_dev'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON `kanuconnectdev`.* TO 'kanu_migrate_dev'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `kanuconnecttest`.* TO 'kanu_app_test'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON `kanuconnecttest`.* TO 'kanu_migrate_test'@'127.0.0.1';
```

Ces commandes n'appliquent pas les migrations et ne réinitialisent aucun mot de passe.

## 3. Fichiers privés, une fois par compte Windows

| Fichier | Contenu |
|---|---|
| `app-dev.xml` | PSCredential de `kanu_app_dev` |
| `migrate-dev.xml` | PSCredential de `kanu_migrate_dev` |
| `app-test.xml` | PSCredential de `kanu_app_test` |
| `migrate-test.xml` | PSCredential de `kanu_migrate_test` |
| `auth-secret.xml` | SecureString Auth.js, créée automatiquement au premier lancement |
| `admin-id.txt` | ID public du compte administrateur local, si configuré |
| `moderator-id.txt` | ID public d'un modérateur local, si configuré |
| `appeal-email.txt` | Adresse publique de réexamen des suspensions, si configurée |

Sur un PC déjà configuré, aucune saisie de mot de passe n'est nécessaire. Le bloc suivant demande uniquement les identifiants dont le fichier est absent :

```powershell
$localDirectory = Join-Path $env:APPDATA 'KanuConnect'
New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
foreach ($target in @('dev', 'test')) {
    foreach ($kind in @('app', 'migrate')) {
        $credentialPath = Join-Path $localDirectory "$kind-$target.xml"
        if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) {
            Get-Credential -UserName "kanu_${kind}_$target" |
                Export-Clixml -LiteralPath $credentialPath
        }
    }
}
```

Un XML illisible ou associé à un autre compte MySQL provoque un arrêt explicite. Ne pas le remplacer par un fichier provenant de l'autre PC.

## 4. Appliquer les migrations

```powershell
.\scripts\migrate-local.ps1 -Target dev
.\scripts\migrate-local.ps1 -Target test
```

Les scripts chargent les credentials existants, appliquent les migrations via `scripts/migrate.mjs` et restaurent ensuite l'environnement du processus. Sur une installation à jour, zéro migration est appliquée.

L'état attendu est **46 migrations appliquées**, dernière `0046_account_admin_audit.sql`. Les fichiers SQL déjà appliqués ne doivent pas être modifiés. Pour une erreur de journal/empreinte, suivre [migration-recovery.md](migration-recovery.md), sans suppression de base.

## 5. Exécuter tous les contrôles

Arrêter le serveur Next.js avec Ctrl+C dans son terminal avant ces contrôles ; laisser MySQL Wamp actif. Relancer l'application après le build pour la recette navigateur.

```powershell
npm.cmd run check:phase3
if ($LASTEXITCODE -ne 0) { throw "Recette automatique en echec : transmettre le message affiche." }
```

Cette commande exécute les tests unitaires, TypeScript, le build, les tests MySQL puis les contrôles de préparation des deux bases. Les tests d'intégration utilisent exclusivement `kanuconnecttest`. Le contrôle de `kanuconnectdev` est en lecture seule.

Attendu : **300 tests unitaires / 39 fichiers**, **29 tests et fichiers d'intégration MySQL**, et aucune migration en attente sur les deux bases.

Les rapports restent dans `%APPDATA%\KanuConnect` :

- `phase3-unit-results.json` et `phase3-database-results.json` : résultats détaillés des tests ;
- `phase3-auto-results.json` : synthèse, date UTC, ordinateur, branche, commit et état des bases.

Le dernier rapport doit indiquer `status: automated-passed`. Avant commit, `workingTreeClean: false` et `sourceReference: working-tree` signalent que les contrôles portent sur les modifications locales. Pour la clôture, refaire les contrôles sur `main` propre : `workingTreeClean: true`, `sourceReference: commit`, même SHA sur les deux PC.

Le rapport conserve `manualRecipePending: true` : la commande ne valide pas à votre place les parcours humains ou la CI. Un échec écrit un nouveau rapport `failed` ; il faut vérifier le commit et la date, pas réutiliser un ancien résultat.

## 6. Lancer l'application avec les bons secrets

```powershell
.\scripts\run-auth-dev.ps1 -Target dev
```

Le défaut du lanceur est maintenant **dev**. Ouvrir **http://localhost:3000** et utiliser cette même origine pour les formulaires, e-mails et rappels OAuth. Les comptes MySQL continuent de se connecter à `127.0.0.1:3306`.

En développement sur `kanuconnectdev`, les liens de vérification/réinitialisation apparaissent dans ce terminal lorsque le mode console est activé par le lanceur. Ils permettent la recette locale sans SMTP. Ne pas publier ces liens ou les rapports détaillés contenant les données de recette.

Les variables de configuration déjà présentes dans le terminal, notamment celles des fournisseurs OAuth/SMTP, restent disponibles. Les fichiers optionnels admin/modérateur/réexamen sont chargés lorsqu'ils existent. Les variables modifiées par le lanceur sont restaurées après son arrêt.

Pour tester un SMTP réellement configuré, lancer avec `-MailMode smtp` ; le mode console est alors désactivé pour ce processus. Voir [lot-3.08-auth.md](lot-3.08-auth.md).

## 7. Administrateur local et réexamen

Après création et connexion du compte administrateur prévu, obtenir **uniquement son ID public** dans la console du navigateur sur localhost :

```js
fetch('/api/me/profile')
  .then((response) => response.json())
  .then((profile) => console.info(profile.publicId));
```

Dans PowerShell, enregistrer cet ID public si `admin-id.txt` n'existe pas encore :

```powershell
$adminFile = Join-Path $env:APPDATA 'KanuConnect\admin-id.txt'
if (-not (Test-Path -LiteralPath $adminFile -PathType Leaf)) {
    Read-Host 'ID public du compte administrateur local' |
        Set-Content -LiteralPath $adminFile -Encoding UTF8
}
```

Le même principe s'applique à `moderator-id.txt`. L'écran `/admin` peut ensuite gérer les rôles persistants prévus par le projet. Pour `appeal-email.txt`, enregistrer l'adresse de réexamen réellement choisie par l'équipe ; les suspensions doivent disposer d'un contact utilisable. Redémarrer le lanceur après un changement de ces fichiers.

## 8. Deuxième PC et clôture

Amadou exécute la même procédure avec ses comptes et fichiers locaux, sur le **même commit `main`** qu'Ousmane. Après fusion du lot, les deux PC doivent produire un rapport récent sur ce commit et réaliser les parcours du modèle [phase3-recette.md](phase3-recette.md), dans une copie privée liée au commit comme indiqué dans [phase3-closure.md](phase3-closure.md).

Les e-mails console valident le parcours local, pas l'envoi SMTP réel. Pour les fournisseurs OAuth activés, les consentements et rappels doivent être vérifiés avec leur vraie configuration ; un fournisseur absent ne doit pas être marqué comme testé.
