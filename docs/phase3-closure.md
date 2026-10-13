# Conditions de clôture de la phase 3

Le lot 3.32 termine la recette du socle local Kanu Connect. Une fusion ou une CI verte seule ne vaut pas clôture.

## Preuves à réunir

| Vérification | Attendu | Preuve |
|---|---|---|
| Contributions | A et B du lot 3.32 fusionnées | PR et commit `main` |
| CI | Job « Tests, types et build » réussi sur le commit fusionné | Lien du run GitHub |
| Ousmane | Contrôles automatiques locaux réussis sur `main` propre | Rapport privé récent, `workingTreeClean: true`, `sourceReference: commit` |
| Amadou | Même contrôle sur le deuxième PC | Rapport privé récent, même commit et arbre propre |
| Tests | 300 unitaires, 29 fichiers MySQL ; aucun test ignoré/échoué | Synthèses du script |
| Bases | Dev et test à jour, 46 migrations, dernière 0046 | Contrôle local en lecture seule |
| Parcours | Copie privée du modèle `phase3-recette.md` renseignée | Statut, responsable, date et note par cas |
| Configuration extérieure | SMTP/OAuth/contact de réexamen décrits avec leur état réel | Configuration activée ou absence explicitement renseignée |
| Défauts | Aucun blocage de recette non corrigé | Liste des anomalies et nouveaux contrôles après correction |

Les rapports privés peuvent contenir des données de test et le nom du PC. Ne pas les committer. Reporter dans le bilan seulement les compteurs, le commit, la date et les résultats nécessaires.

## Répartition

Ousmane porte l'outillage, les corrections serveur, la conformité des bases et la validation fonctionnelle principale. Amadou porte les corrections d'interface, les essais mobile/desktop et la reproduction de l'installation sur son PC. La charge reste proche de 80 % / 20 %, sans prétendre que le nombre de fichiers mesure à lui seul le travail.

## Exécution finale après fusion

Sur chacun des deux PC, depuis un arbre Git propre :

```powershell
git switch main
if ($LASTEXITCODE -ne 0) { throw "Changement de branche echoue." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Mise a jour echouee." }
git rev-parse HEAD
npm.cmd run check:phase3
if ($LASTEXITCODE -ne 0) { throw "Controles de phase 3 echoues." }
.\scripts\run-auth-dev.ps1 -Target dev
```

Comparer le commit et les synthèses des deux PC. Exécuter les parcours réels du document de recette dans le navigateur ; les simulations utilisées pendant la préparation ne les remplacent pas.

Avant de remplir les résultats, créer la copie privée liée au commit testé, sans écraser une fiche déjà renseignée :

```powershell
$testedCommit = (& git rev-parse HEAD)
if ($LASTEXITCODE -ne 0) { throw "Lecture du commit echouee." }
$recipePath = Join-Path $env:APPDATA "KanuConnect\phase3-recette-$testedCommit.md"
if (-not (Test-Path -LiteralPath $recipePath -PathType Leaf)) {
    Copy-Item -LiteralPath ".\docs\phase3-recette.md" -Destination $recipePath
}
Write-Host "Fiche de recette : $recipePath"
```

Compléter cette copie, avec la même référence de commit sur les deux PC. Les rapports générés et cette fiche restent hors Git ; le modèle versionné conserve ses cases initiales.

## États du bilan

- **À vérifier** : aucune preuve d'exécution réelle n'est disponible.
- **OK** : le résultat attendu a été observé sur le commit renseigné.
- **KO** : anomalie reproductible ; noter le cas, le résultat réel et la correction nécessaire.
- **Non configuré** : dépendance extérieure absente. Ce statut ne signifie jamais « testé ».

Un fournisseur OAuth ou un transport SMTP absent ne doit pas être déclaré opérationnel. Les modes réellement proposés pendant la démonstration locale doivent être testés ; toute exigence retenue mais non satisfaite reste une réserve explicite dans le bilan.

Lorsque les preuves sont réunies et qu'aucun blocage du périmètre local ne subsiste, renseigner la date de clôture et le commit testé dans la fiche privée. La phase 4 peut alors commencer sur cette base identifiée. Ne pas annoncer une mise en production à partir de ces seuls contrôles locaux.