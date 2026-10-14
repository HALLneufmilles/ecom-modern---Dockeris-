# AGENTS.md

**Version : v3**
**Date de publication : 14/10/2026**

## Table des matières

- [AGENTS.md](#agentsmd)
  - [Table des matières](#table-des-matières)
  - [Suivi des modifications](#suivi-des-modifications)
  - [Mission du projet](#mission-du-projet)
  - [Décisions d'architecture déjà validées](#décisions-darchitecture-déjà-validées)
  - [Sources de vérité et relecture des documents](#sources-de-vérité-et-relecture-des-documents)
    - [Relecture des documents](#relecture-des-documents)
  - [Avant toute modification](#avant-toute-modification)
  - [Décisions mineures et décisions structurantes](#décisions-mineures-et-décisions-structurantes)
  - [Préservation de l'existant](#préservation-de-lexistant)
  - [Méthode de modification](#méthode-de-modification)
    - [Rechargement des services](#rechargement-des-services)
    - [Frontière fonctionnelle](#frontière-fonctionnelle)
  - [Tests et non-régression](#tests-et-non-régression)
    - [Règle permanente](#règle-permanente)
    - [Cohérence des tests](#cohérence-des-tests)
    - [Analyse d'impact des tests](#analyse-dimpact-des-tests)
    - [Exécution des tests et économie de quota](#exécution-des-tests-et-économie-de-quota)
    - [Rapport de non-régression](#rapport-de-non-régression)
  - [Playwright et sandbox](#playwright-et-sandbox)
    - [Blocage sandbox](#blocage-sandbox)
    - [Baseline Playwright](#baseline-playwright)
    - [Cas particuliers](#cas-particuliers)
  - [Docker Compose](#docker-compose)
  - [Sécurité](#sécurité)
  - [Documentation](#documentation)
  - [Rapport final de Codex](#rapport-final-de-codex)

---

## Suivi des modifications

| Version | Date de publication | Modification                                                                                                                                                                                                                                                         | Chapitre / paragraphe concerné                                                 |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| v3      | 14/10/2026          | Mise à jour de la source de vérité du socle : `docs/SOCLE_ECOMMERCE_MVDW_v3.md` remplace la référence à la v2 avant le commit majeur.                                                                                                                                | `Sources de vérité et relecture des documents`                                 |
| v3      | 13/10/2026          | Épuration de `AGENTS.md` : suppression des répétitions, regroupement des règles Git, tests, sandbox et rapports finaux, sans modification des décisions de fond.                                                                                                     | Ensemble du document                                                           |
| v3      | 13/10/2026          | Consolidation des règles de non-régression : toute nouvelle fonctionnalité, modification métier ou correction de bug doit faire l'objet d'une évaluation explicite de sa couverture.                                                                                 | `Tests et non-régression`                                                      |
| v3      | 13/10/2026          | Ajout d'une analyse d'impact ciblée des tests après toute modification de code : identifier aussi les tests existants non modifiés mais susceptibles d'être affectés, puis indiquer dans le rapport ceux que l'utilisateur doit relancer avec les commandes exactes. | `Méthode de modification`, `Tests et non-régression`, `Rapport final de Codex` |
| v3      | 13/10/2026          | Optimisation de l'usage de Codex : séparation stricte entre écriture/adaptation des tests et exécution ; les suites longues sont exécutées par l'utilisateur dans VS Code par défaut.                                                                                | `Méthode de modification`, `Tests et non-régression`                           |
| v3      | 13/10/2026          | Suppression de la détection systématique des changements documentaires par Git. Les documents de référence, y compris `AGENTS.md`, ne sont relus que lorsque le prompt le demande explicitement.                                                                     | `Sources de vérité et relecture des documents`, `Avant toute modification`     |
| v3      | 13/10/2026          | Consolidation de la gestion des blocages Playwright/sandbox afin d'éviter les relances inutiles et la consommation de quota.                                                                                                                                         | `Playwright et sandbox`                                                        |
| v2      | 09/10/2026          | Mise à jour de la baseline Playwright alors connue et des références documentaires.                                                                                                                                                                                  | `Sources de vérité`, `Tests`                                                   |
| v1      | 06/10/2026          | Ajout du suivi documentaire et clarification du statut de la cartographie fonctionnelle initiale.                                                                                                                                                                    | `Sources de vérité`                                                            |

---

## Mission du projet

Faire évoluer progressivement la boutique e-commerce existante vers une architecture basée sur Medusa et PostgreSQL, sans casser le storefront actuel ni les fonctionnalités déjà validées.

La migration doit rester progressive, compréhensible et vérifiable.

## Décisions d'architecture déjà validées

Ne pas remettre en cause ces décisions sans demande explicite de l'utilisateur :

- storefront actuel conservé ; ne pas le réécrire en React ;
- Medusa devient le moteur e-commerce ;
- PostgreSQL devient le stockage durable des données e-commerce ;
- Redis pourra être ajouté plus tard si un besoin réel l'impose ;
- Medusa Admin administre le catalogue ;
- `Product` / `ProductVariant` natifs Medusa sont conservés ;
- tailles et couleurs sont gérées par les variantes ;
- Stripe reste le provider de paiement de démonstration ;
- les fichiers doivent passer par Medusa File Module avec Cloudflare R2 comme cible ;
- Firestore et l'accès direct AWS S3 doivent disparaître progressivement ;
- le legacy `seller` ne doit pas servir de base au futur multi-vendeur ;
- le premier socle reste mono-marchand, sans empêcher une évolution future limitée à quelques vendeurs ;
- le futur multi-vendeur devra reposer sur de vrais concepts `Vendor` / `VendorAdmin`, pas sur un détournement de `Customer`, `SalesChannel`, `StockLocation` ou de metadata ;
- Strapi reste prévu plus tard pour l'éditorial.

Ne pas moderniser inutilement une partie legacy destinée à disparaître, sauf nécessité pour poursuivre ou sécuriser la migration.

## Sources de vérité et relecture des documents

Sources principales :

1. `AGENTS.md` pour les règles de travail ;
2. `docs/CARTOGRAPHIE_FONCTIONNELLE.md` pour l'état fonctionnel initial ;
3. `README.md` pour les commandes et le fonctionnement courant ;
4. `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md` pour l'infrastructure et les décisions associées ;
5. `docs/SOCLE_ECOMMERCE_MVDW_v3.md` pour l'architecture cible et les décisions du socle ;
6. le code et la configuration réellement présents dans la branche de travail.

`docs/CARTOGRAPHIE_FONCTIONNELLE.md` est figé pendant F-01 à F-19. Ne pas le modifier pour documenter l'état courant ; une nouvelle cartographie finale sera créée à la fin du projet.

### Relecture des documents

Ne pas relire systématiquement les documents de référence à chaque tâche, y compris `AGENTS.md`.

La règle est simple :

- si le prompt demande de relire un document, le relire ;
- si le prompt ne le demande pas, continuer à partir du contexte disponible ;
- ne pas utiliser `git status`, `git diff`, l'historique ou les commits uniquement pour détecter si un document a changé ;
- lorsqu'un document a été mis à jour et doit être repris en compte, le prompt indique explicitement lequel relire ;
- ne relire que les documents réellement nécessaires.

L'objectif est de limiter les relectures, le contexte inutile et la consommation de quota.

`docs/CODEX_PROJECT_BOOTSTRAP_v1.1.md` est une référence méthodologique générique, non une instruction à exécuter automatiquement. `AGENTS.md` reste la référence opérationnelle.

Si code, documentation et instructions se contredisent, signaler le conflit au lieu de choisir silencieusement.

## Avant toute modification

Inspecter uniquement les fichiers et éléments directement nécessaires à la tâche.

Ne pas exécuter systématiquement `git status`, `git diff`, l'historique Git ou une vérification de commit en début de tâche.

Les commandes Git en lecture restent autorisées lorsqu'elles sont réellement utiles pour :

- protéger des modifications locales ;
- comprendre un diff ;
- préparer une opération Git demandée ;
- établir un rapport final fiable.

Ne jamais écraser ou annuler une modification locale préexistante sans autorisation explicite.

Avant de corriger un dysfonctionnement :

1. établir le diagnostic à partir des faits disponibles ;
2. identifier le comportement attendu ;
3. modifier seulement après avoir suffisamment confirmé la cause.

Ne pas corriger sur simple hypothèse lorsqu'une vérification raisonnable est possible.

## Décisions mineures et décisions structurantes

Codex peut prendre seul une décision locale, réversible et sans impact architectural important.

STOP et demander validation avant toute décision structurante, notamment :

- changement d'architecture générale ;
- rôle de Medusa, PostgreSQL, Stripe, R2, Redis ou Strapi ;
- ajout/suppression d'un service d'infrastructure ;
- changement important de `compose.yaml`, volumes, réseau ou persistance ;
- modification du modèle de données ou stratégie de migration ;
- changement touchant authentification, paiement, commandes, stocks ou Customers ;
- changement d'une décision fonctionnelle F-01 à F-19 ;
- ajout/remplacement important d'une dépendance ;
- mise à jour majeure d'une dépendance ;
- suppression importante de code ou de données ;
- opération Git ou base destructive ;
- changement de stratégie concernant secrets ou variables d'environnement ;
- modification d'un test uniquement pour obtenir un résultat vert alors que le comportement attendu n'a pas été validé.

Dans ce cas :

1. expliquer le choix ;
2. proposer les options utiles ;
3. donner la recommandation de Codex ;
4. attendre la décision utilisateur.

## Préservation de l'existant

Le design et l'UX existants sont la référence par défaut.

Ne pas modifier de manière significative :

- mise en page ;
- style ;
- couleurs ;
- typographie ;
- hiérarchie visuelle ;
- interactions ;

sauf demande explicite.

Si une correction fonctionnelle semble nécessiter un changement visuel significatif, STOP et demander l'accord.

Éviter les refactorings non demandés.

Ne pas contourner un problème en créant inutilement des copies ou fichiers parallèles (`-new`, `-old`, `-v2`, etc.). Réutiliser les fichiers existants lorsque cela reste raisonnable.

## Méthode de modification

Pour chaque tâche :

1. comprendre le besoin ;
2. inspecter uniquement les fichiers concernés ;
3. diagnostiquer avant de corriger ;
4. effectuer le changement minimal nécessaire ;
5. éviter les refactorings hors périmètre ;
6. écrire ou adapter les tests nécessaires ;
7. après toute modification de code, effectuer une analyse d'impact ciblée des tests existants afin d'identifier aussi ceux qui n'ont pas été modifiés mais qui exercent directement ou indirectement les fichiers, fonctions ou comportements changés ;
8. fournir par défaut à l'utilisateur les commandes exactes à lancer dans VS Code pour les tests pertinents identifiés ;
9. analyser les résultats transmis avant toute nouvelle correction ;
10. si une correction locale est nécessaire, la faire puis préparer la validation suivante ;
11. éviter les boucles répétitives modification → test → logs → modification sans nouveau diagnostic ;
12. après deux corrections infructueuses sur le même problème, STOP, résumer et demander comment poursuivre ;
13. si une nouvelle décision structurante apparaît, STOP ;
14. terminer par un rapport synthétique.

### Rechargement des services

Après modification de `server.js` ou du serveur Express :

- redémarrer `server-dev` avant toute validation fonctionnelle ;
- ne pas supposer que nodemon a forcément chargé la bonne version.

Après modification du backend Medusa qui doit être chargé dans l'image du service :

- reconstruire/recréer le service concerné ;
- attendre son redémarrage ;
- vérifier `/health` avant validation fonctionnelle.

Ne jamais conclure qu'une correction serveur est inefficace tant que le service concerné n'a pas été explicitement rechargé.

### Frontière fonctionnelle

La fiche F-xx initiale n'est pas toujours une frontière absolue.

Adapter les dépendances directement nécessaires si cela :

- évite deux sources de vérité ;
- empêche une régression causée directement par la migration ;
- maintient un parcours utilisateur cohérent.

Ne pas étendre automatiquement la tâche à toute la chaîne de dépendances.

## Tests et non-régression

### Règle permanente

Pour toute :

- nouvelle fonctionnalité ;
- modification métier ;
- correction de bug ;

évaluer systématiquement la couverture de non-régression.

Si un test existant couvre déjà complètement le comportement, le signaler et ne pas créer de doublon inutile.

Sinon, ajouter ou proposer un test automatisé lorsque le comportement est automatisable de façon fiable.

Si plusieurs comportements sont introduits, couvrir les cas importants sans multiplier inutilement les micro-tests.

Privilégier :

- parcours utilisateur complets lorsqu'ils protègent mieux le comportement ;
- assertions DOM/API/état Medusa ou PostgreSQL ;
- tests durables plutôt que captures d'écran fragiles.

Les mocks sont autorisés lorsqu'ils sont réellement utiles, notamment pour provoquer une erreur difficile à reproduire. Toujours indiquer clairement ce qu'ils simulent.

Si un bug a été découvert grâce à un test existant, conserver ou compléter ce test afin d'empêcher son retour.

Si un comportement n'est pas raisonnablement automatisable, expliquer pourquoi et proposer la vérification manuelle minimale.

### Cohérence des tests

Avant d'adapter un test, vérifier :

- scénario ;
- résultat attendu ;
- assertions ;
- mocks ;
- données de test ;
- routes ;
- synchronisations asynchrones.

Ne jamais assouplir une assertion ou modifier un mock uniquement pour rendre le test vert.

Distinguer clairement :

- test mocké ;
- test d'intégration avec services locaux ;
- test end-to-end réel.

Ne jamais présenter comme « validé en conditions réelles » un comportement seulement inspecté, mocké ou bloqué avant exécution.

### Analyse d'impact des tests

Après toute modification de code, effectuer une analyse d'impact ciblée avant le rapport final.

À partir des fichiers, fonctions, routes, états UI et comportements modifiés :

- identifier les tests ajoutés ou adaptés par la tâche ;
- rechercher les tests existants qui exercent directement ou indirectement le code modifié, même s'ils n'ont pas besoin d'être modifiés ;
- ne pas se limiter au fichier de test explicitement cité dans le prompt ;
- sélectionner uniquement les tests réellement pertinents ; ne pas proposer une suite complète par réflexe ;
- distinguer les tests à relancer pour confirmer l'absence de régression des tests seulement voisins mais non concernés.

Cette analyse ne signifie pas que Codex doit exécuter les tests identifiés. Les règles d'exécution ci-dessous restent applicables : par défaut, l'utilisateur les lance dans VS Code.

Dans le rapport final, indiquer explicitement :

- les tests ajoutés ou adaptés ;
- les tests existants non modifiés mais à relancer en raison de l'analyse d'impact ;
- la raison de chaque sélection ;
- les commandes exactes à exécuter ;
- les éventuelles vérifications manuelles restantes.

Si aucun autre test existant n'est raisonnablement impacté, l'indiquer explicitement.

### Exécution des tests et économie de quota

Séparer strictement **écrire ou adapter** les tests et **les exécuter**.

Par défaut :

1. Codex écrit ou adapte les tests ;
2. Codex effectue uniquement les contrôles légers utiles, par exemple syntaxe ciblée ou `git diff --check` ;
3. Codex fournit les commandes exactes ;
4. l'utilisateur lance dans VS Code les fichiers Playwright complets, tests réels, suites de non-régression et validations longues ;
5. Codex reprend uniquement si le résultat révèle un bug ou nécessite un diagnostic.

Codex ne doit pas lancer de sa propre initiative :

- un fichier Playwright complet ;
- une suite longue ;
- une campagne de tests réels ;
- une validation répétitive déjà exécutable simplement par l'utilisateur.

Codex peut exécuter lui-même un test seulement si :

- l'utilisateur le demande explicitement ; ou
- le test est très ciblé, court et indispensable immédiatement au diagnostic.

Dans ce cas :

- lancer le plus petit scénario possible ;
- ne pas enchaîner automatiquement avec le fichier complet ;
- dès que l'information diagnostique utile est obtenue, arrêter l'exécution ;
- remettre à l'utilisateur les commandes de validation plus larges.

Un test réel sans mock peut être écrit par Codex, mais son exécution complète reste à la charge de l'utilisateur par défaut.

Le quota Codex doit être réservé à l'analyse, au raisonnement, au code et au diagnostic ; les exécutions mécaniques sont déléguées à l'utilisateur lorsqu'elles n'apportent pas de valeur supplémentaire.

### Rapport de non-régression

À la fin d'une mission qui modifie un comportement, indiquer brièvement :

- tests existants couvrant déjà le changement ;
- nouveaux tests ajoutés ou tests existants adaptés ;
- tests existants non modifiés mais identifiés par l'analyse d'impact comme devant être relancés ;
- raison de la sélection de ces tests ;
- commandes exactes à lancer par l'utilisateur lorsqu'ils ne sont pas exécutés par Codex ;
- comportements protégés ;
- éventuelles vérifications manuelles restantes.

Si aucun autre test existant n'est impacté au-delà de ceux déjà adaptés, le dire explicitement.

## Playwright et sandbox

Utiliser en priorité Playwright headless pour les parcours automatisés.

Le navigateur visible/interactif reste exceptionnel. Avant de l'utiliser, expliquer son intérêt et demander l'autorisation explicite de l'utilisateur.

Playwright ne démarre pas lui-même la boutique :

`http://127.0.0.1:5000`

Sous Windows, utiliser le CLI Playwright local du projet via le runtime Node disponible ; ne pas supposer que `npx` est disponible.

### Blocage sandbox

Si un test ciblé exceptionnellement lancé par Codex rencontre :

`ERR_NETWORK_ACCESS_DENIED`

alors :

- considérer d'abord le problème comme environnemental ;
- ne pas modifier l'application ou la configuration Playwright pour le contourner ;
- ne pas répéter plusieurs fois la même tentative ;
- fournir à l'utilisateur la commande exacte à lancer dans VS Code ;
- ne relancer hors sandbox depuis Codex que si l'utilisateur l'autorise explicitement et si cette exécution est réellement nécessaire au diagnostic.

Ne jamais désactiver globalement le sandbox ni élargir durablement les permissions pour économiser du quota.

### Baseline Playwright

La baseline de 35 scénarios documentée en v2 est historique. La suite a évolué depuis.

Ne pas utiliser ce nombre comme total courant : s'appuyer sur les tests réellement présents et sur les résultats transmis lors de la validation.

### Cas particuliers

Le test legacy `tests/f01-f02-f03-account.spec.js` utilise encore Firebase Admin / Firestore pour son nettoyage et peut nécessiter un accès réseau externe. Cet accès reste soumis à autorisation ponctuelle.

Un test bloqué par l'environnement, l'authentification ou une autre session d'automatisation est **non validé**, pas réussi.

Pour les tests manipulant des formulaires, utiliser des données fictives. Ne pas déclencher volontairement un paiement Stripe, une commande persistante ou la création/modification d'un compte sauf si le scénario l'autorise explicitement.

## Docker Compose

Employer les termes précis :

- Docker Engine : construit les images et exécute les conteneurs ;
- Docker CLI : commandes `docker ...` ;
- Docker Compose : orchestre les services définis dans `compose.yaml`.

Pour une simple validation Docker Compose :

`docker compose config --quiet`

Éviter d'afficher la configuration développée lorsqu'elle peut exposer des secrets.

## Sécurité

Ne jamais :

- afficher le contenu complet d'un `.env` ;
- recopier des secrets dans un rapport ;
- exposer volontairement des clés Firebase, AWS, Stripe ou Medusa ;
- exécuter automatiquement `npm audit fix` ;
- supprimer volume ou données persistantes sans autorisation ;
- exécuter `git reset --hard`, `git clean -fd`, force push ou commande Git destructive sans autorisation explicite ;
- supprimer ou recréer une base PostgreSQL sans autorisation explicite.

Ne jamais chercher à faire autoriser globalement :

- PowerShell ;
- `docker compose exec` ;
- `psql` ;
- Node ;
- Playwright ;
- toute commande pouvant exécuter du code arbitraire ou modifier des données.

Ne pas faire de commit ni de push sauf demande explicite.

## Documentation

La documentation doit rester minimale, claire et utile.

Tout document permanent doit comporter :

1. une table des matières placée au début ;
2. un tableau de suivi des modifications.

Mettre à jour la documentation lorsqu'une modification change réellement :

- une commande ;
- le fonctionnement du projet ;
- une décision d'architecture ;
- un parcours fonctionnel important.

Ne pas créer plusieurs documents décrivant la même chose.

Éviter de recopier des détails facilement déductibles du code s'ils risquent de devenir rapidement obsolètes.

## Rapport final de Codex

Rester synthétique.

Lorsque cela est nécessaire pour établir une liste fiable des fichiers modifiés ou vérifier le diff, faire un seul contrôle Git final plutôt que des vérifications répétées pendant la tâche.

Indiquer :

- ce qui a été analysé ;
- fichiers modifiés ;
- changement effectué ;
- tests ajoutés ou adaptés ;
- résultat de l'analyse d'impact des tests ;
- tests existants non modifiés mais à relancer, avec la raison de leur sélection ;
- validations exécutées par Codex ;
- validations laissées à exécuter par l'utilisateur avec leurs commandes exactes ;
- éventuelles vérifications manuelles restantes ;
- résultats connus ;
- blocages ou décisions restantes.

Si aucun autre test existant n'est impacté, l'indiquer explicitement au lieu d'omettre l'analyse.

Employer explicitement :

- `réussi` ;
- `échoué` ;
- `bloqué` ;
- `non validé`.

Ne pas dire « vérifié » pour un comportement seulement inspecté dans le code.

Si aucune modification n'était nécessaire, le dire explicitement.
