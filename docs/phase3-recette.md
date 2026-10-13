# Recette finale Kanu Connect — phase 3

Ce document est le modèle versionné de la fiche de résultats réels. Après fusion de A et B, copier ce modèle dans `%APPDATA%\KanuConnect\phase3-recette-<commit>.md` comme indiqué dans `phase3-closure.md`, puis compléter la copie privée. Cela permet de garder le commit testé identique sur les deux PC. Les valeurs initiales « À vérifier » ne sont pas des validations.

## Identification

| Champ | Valeur à renseigner |
|---|---|
| Commit de référence testé (`main` après fusion A+B) | À vérifier |
| PR lot 3.32 A / B | À vérifier |
| CI du commit final | À vérifier |
| Date et contrôles automatiques PC Ousmane | À vérifier |
| Date et contrôles automatiques PC Amadou | À vérifier |
| Mode e-mail utilisé | À vérifier : console locale / SMTP réel |
| Google | À vérifier : activé et testé / non configuré |
| GitHub OAuth | À vérifier : activé et testé / non configuré |
| GitLab OAuth | À vérifier : activé et testé / non configuré |
| Contact de réexamen | À vérifier |
| Date de clôture de la phase 3 | À vérifier |

## Préparation de la recette

Lancer avec `scripts/run-auth-dev.ps1 -Target dev` et rester sur `http://localhost:3000`. Utiliser des comptes jetables distincts **A**, **B**, **C**, **D** (auteur du contenu à signaler par les trois autres), un administrateur prévu et, si nécessaire, un modérateur. Séparer les sessions avec des profils de navigateur ou une fenêtre privée. Les comptes des deux PC se trouvent dans des bases locales différentes : leur contenu n'est pas automatiquement synchronisé.

Ne pas supprimer ni suspendre le compte d'un vrai membre pour un essai. Les tests destructifs ci-dessous concernent uniquement les comptes jetables créés pour la recette.

## Parcours fonctionnels — Ousmane

Remplacer « À vérifier » par OK/KO, puis renseigner responsable, date et note. Une réserve « Non configuré » doit préciser quelle dépendance manque.

| Cas | Actions | Résultat attendu | Statut | Responsable / date / note |
|---|---|---|---|---|
| R01 — Installation | Lancer `npm run check:phase3` sur chaque PC | 300 tests unitaires, 29 fichiers MySQL, types/build réussis, dev/test sans migration en attente, rapports du même commit | À vérifier | À renseigner |
| R02 — Inscription | Créer A, ouvrir son lien de vérification, se connecter et terminer/passer l'accueil | Connexion impossible avant vérification ; entrée dans le fil après l'accueil ; nom légal privé | À vérifier | À renseigner |
| R03 — Profil | Modifier pseudo, bio, compétences ; ouvrir le profil public depuis B | Données sauvegardées, URL du pseudo mise à jour ; aucun nom légal public | À vérifier | À renseigner |
| R04 — Publication | A pose une question ; B partage une astuce ; filtrer espaces/types | Cartes correctes, détails et code lisibles, filtres cumulés et pagination conservés | À vérifier | À renseigner |
| R05 — Édition | A édite son contenu ; B tente d'éditer celui d'A ; vérifier la limite de quinze minutes | Modification autorisée seulement pour l'auteur dans le délai ; refus des autres ; réponses conservées après suppression | À vérifier | À renseigner |
| R06 — Réponses et solution | B répond à la question d'A, C vote ; A marque résolue puis rouvre | Vote positif, solution communautaire et statut cohérents ; bonus attribué sans doublon | À vérifier | À renseigner |
| R07 — Vote | Tester vote/retrait/revote de B ; tenter auto-vote d'A | Un vote actif par membre et contenu, retrait effectif, auto-vote refusé | À vérifier | À renseigner |
| R08 — Médias | Ajouter un fichier autorisé ; essayer format/taille refusés et quota ; consulter depuis B | Fichiers persistants, règles appliquées, gestion réservée à l'auteur ; contenu masqué non téléchargeable publiquement | À vérifier | À renseigner |
| R09 — Projet et collaboration | A présente projet/rôles ; B demande puis retire ; B redemande ; A accepte ; ouvrir discussion | Retrait et décisions cohérents ; discussion réservée à l'équipe ; ancien historique lisible | À vérifier | À renseigner |
| R10 — Opportunité | Publier une opportunité avec catégorie/date future/lien HTTPS ; suivre la catégorie avec B | Opportunité active et notification attendue ; candidature sur le site externe ; archive après échéance | À vérifier | À renseigner |
| R11 — Découverte et favoris | B suit A, des catégories, enregistre une publication/projet ; recharger et consulter depuis C | Préférences/favoris persistants et favoris privés ; Abonnements filtré ; historique public paginé | À vérifier | À renseigner |
| R12 — Notifications | A publie/mentionne B ; B répond ; lire, filtrer, actualiser, désactiver un type | Bons destinataires, sans doublon ; lecture protégée ; compteur diminué ; préférences appliquées | À vérifier | À renseigner |
| R13 — Réputation et flamme | Consulter profil/classement ; vérifier les résultats automatisés réputation/streaks | Points/badges/classement cohérents ; flamme issue des journées utiles, pas de valeur de démonstration | À vérifier | À renseigner |
| R14 — Signalements | A/B/C signalent distinctement un contenu jetable ; révision modérateur puis admin | Masquage au seuil, décision motivée, solution masquée retirée ; décision finale protégée | À vérifier | À renseigner |
| R15 — Blocages et suspensions | Bloquer A depuis B ; tester recherche/flux/projets/classement ; suspendre puis rétablir un compte jetable | Blocage réciproque et retrait des abonnements ; compte suspendu inaccessible ; droits admin contrôlés | À vérifier | À renseigner |
| R16 — Sessions et mot de passe | Demander un lien reset, changer le mot de passe, tester l'ancienne session et la déconnexion | Anciennes sessions révoquées ; nouveau mot de passe utilisable ; lien expiré/consommé refusé | À vérifier | À renseigner |
| R17 — Compte | Désactiver puis reconnecter un compte jetable ; supprimer un autre avec les confirmations requises | Réactivation prévue après reconnexion ; suppression irréversible des données privées ; réponses des autres conservées | À vérifier | À renseigner |
| R18 — Accès et erreurs | Visiteur sur pages privées ; membre sur admin ; origine incorrecte dans un essai API ; couper réseau lors d'un formulaire | Redirection/refus approprié ; origine refusée ; erreur compréhensible et possibilité de réessayer | À vérifier | À renseigner |
| R19 — OAuth configuré | Pour chaque fournisseur activé : connexion, onboarding, rattachement explicite depuis A, tentative de rattachement d'une identité déjà liée | Pas de fusion automatique ; liaison protégée ; callbacks sur localhost ; fournisseur absent renseigné sans validation fictive | À vérifier | À renseigner |
| R20 — E-mails et réexamen | Vérifier les liens console ou la réception SMTP selon le mode choisi ; ouvrir `/appeal` | Bon lien et bon destinataire ; absence de confusion entre console et SMTP ; contact de réexamen réellement utilisable | À vérifier | À renseigner |

Les durées réelles (série sur trois jours, expiration) sont aussi couvertes par les tests automatisés. Ne pas modifier l'horloge Windows ou les migrations pour accélérer un essai humain.

## Interface et deuxième PC — Amadou

| Cas | Actions | Résultat attendu | Statut | Responsable / date / note |
|---|---|---|---|---|
| U01 — Reproduction | Installer/récupérer le même `main`, utiliser les identifiants locaux et exécuter les contrôles | Même commit et mêmes compteurs, aucune copie de XML venant de l'autre PC | À vérifier | À renseigner |
| U02 — Mobile | Tester à 320/390 px et sur téléphone disponible : cinq destinations, menu supplémentaire, filtres, formulaires | Aucun débordement horizontal ; éléments accessibles, champs lisibles, actions utilisables | À vérifier | À renseigner |
| U03 — Desktop et clavier | Tester à 1440 px, Tab/Entrée, lien Aller au contenu, recherche et menu | Navigation active correcte, focus visible, parcours réalisables au clavier | À vérifier | À renseigner |
| U04 — États | Fermer/recharger bannière ; tester listes vides, contenu absent et notifications lues/non lues | Choix conservé dans le navigateur, états clairs, compteur cohérent | À vérifier | À renseigner |
| U05 — Formulaires auth | Inscription, onboarding, renvoi/reset ; simuler réseau coupé puis réessayer | Pas d'exception silencieuse ; bouton occupé ; saisie conservée ; retour à la connexion disponible | À vérifier | À renseigner |

## Anomalies et bilan

| Cas | Résultat réel / reproduction | Correction / commit | Nouveau contrôle | Statut |
|---|---|---|---|---|
| À renseigner uniquement si une anomalie existe | — | — | — | — |

**Bilan initial : recette non encore exécutée sur les deux PC.**

Lorsque les contrôles automatiques, les parcours applicables et la CI du commit final sont confirmés, appliquer les critères de [phase3-closure.md](phase3-closure.md). Toute réserve restante doit être décrite avant d'annoncer la clôture.