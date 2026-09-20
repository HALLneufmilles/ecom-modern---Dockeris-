# AGENTS.md

## Table des matières

- [Mission du projet](#mission-du-projet)
- [Décisions d'architecture déjà validées](#décisions-darchitecture-déjà-validées)
- [Sources de vérité du projet](#sources-de-vérité-du-projet)
- [Avant toute modification](#avant-toute-modification)
- [Actions autorisées sans décision préalable](#actions-autorisées-sans-décision-préalable)
- [Décisions mineures et décisions structurantes](#décisions-mineures-et-décisions-structurantes)
- [Préservation de l'existant](#préservation-de-lexistant)
- [Méthode de modification](#méthode-de-modification)
- [Tests](#tests)
- [Docker Compose](#docker-compose)
- [Sécurité](#sécurité)
- [Documentation](#documentation)
- [Rapport final de Codex](#rapport-final-de-codex)

---


## Mission du projet

Faire évoluer progressivement la boutique e-commerce existante vers une
architecture basée sur Medusa et PostgreSQL, sans casser le storefront
actuel ni les fonctionnalités déjà validées.

La migration doit être progressive et vérifiable par les tests.

## Décisions d'architecture déjà validées

Ces décisions ne doivent pas être remises en cause sans demande
explicite de l'utilisateur :

- la première version opérationnelle reste mono-marchand, mais l’architecture ne doit pas rendre impossible une future option multi-vendeur limitée à 2 ou 3 vendeurs ; ne pas implémenter cette option sans tâche explicite ;
- le storefront actuel est conservé ;
- Medusa devient le moteur e-commerce ;
- le futur socle MVDW doit rester configurable : distinguer autant que nécessaire un Core obligatoire, des modules/options et des providers remplaçables, sans créer prématurément des abstractions ou packages inutiles ;
- PostgreSQL devient le stockage durable des données e-commerce ;
- Medusa Admin sert à administrer les produits ;
- les variantes produit doivent gérer notamment les tailles et
  couleurs ;
- la wishlist est conservée et devra devenir persistante côté client ;
- Stripe est conservé en environnement de test pour le projet de
  démonstration ;
- les images doivent être gérées par Medusa File Module avec
  Cloudflare R2 comme stockage cible ;
- Firestore et la manipulation directe d'AWS S3 sont destinés à
  disparaître progressivement ;
- l’ancien rôle ou parcours `seller` artisanal n’est pas une base à conserver pour le futur multi-vendeur ; une éventuelle capacité Vendor devra être conçue proprement lorsqu’elle sera explicitement demandée ;
- Redis viendra plus tard si nécessaire ;
- Strapi est également prévu plus tard pour le contenu éditorial.

Ne pas moderniser inutilement une partie legacy Firebase, Firestore ou
AWS destinée à disparaître, sauf si cela est nécessaire pour sécuriser
ou poursuivre la migration.

## Sources de vérité du projet

Avant une modification importante, consulter selon le besoin :

1.  `AGENTS.md` pour les règles de travail ;
2.  `docs/CARTOGRAPHIE_FONCTIONNELLE.md` pour le fonctionnement et les
    décisions fonctionnelles ;
3.  `README.md` pour les commandes et le fonctionnement documenté du
    projet ;
4.  `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v5.md` pour les décisions
    d'infrastructure, le socle modulaire, les contraintes d'évolution
    multi-vendeur, Docker/Compose, Stripe, les providers et la production ;
5.  le code et la configuration réellement présents dans la branche de
    travail.

`docs/CODEX_PROJECT_BOOTSTRAP_v1.0.md` est un document méthodologique
générique et évolutif. Il peut être consulté comme référence, mais ses
instructions ne doivent pas être exécutées automatiquement lors des
tâches courantes de ce projet. `AGENTS.md` reste la source des
instructions opérationnelles actives de ce dépôt. Si Codex identifie une
amélioration pertinente à apporter au Bootstrap, il doit la signaler
avant toute modification de ce fichier, sauf si la tâche demande
explicitement de le modifier.

Si le code, la documentation et les instructions semblent se contredire,
ne pas choisir silencieusement une interprétation : signaler le conflit.

## Avant toute modification

Toujours commencer par vérifier l'état réel du dépôt :

- branche Git active ;
- `git status` ;
- modifications locales déjà présentes ;
- fichiers concernés par la tâche.

Ne jamais écraser ou annuler une modification locale préexistante sans
autorisation explicite.

Examiner le code existant avant de proposer ou d'écrire une nouvelle
implémentation.

Avant toute correction d'un dysfonctionnement, établir d'abord un
diagnostic à partir des faits disponibles : message d'erreur, logs
pertinents, comportement observé, état du code et tests concernés. Ne
pas modifier le code sur la base d'hypothèses non vérifiées lorsqu'une
vérification raisonnable est possible.

## Actions autorisées sans décision préalable

Codex peut effectuer sans demander une décision préalable, dans le
périmètre de la tâche en cours :

- lire et rechercher dans les fichiers du dépôt ;
- exécuter `git status`, `git diff`, `git branch` et les autres
  commandes Git strictement en lecture ;
- exécuter `docker compose ps` ;
- exécuter `docker compose config --quiet` ;
- consulter une quantité raisonnable de logs avec
  `docker compose logs`, en évitant d'exposer les secrets ;
- effectuer des vérifications locales de ports ou de processus en
  lecture seule ;
- effectuer des requêtes HTTP locales en lecture seule vers les
  services du projet, par exemple `/health` ou l'interface locale ;
- lancer un test ciblé uniquement lorsque les conditions définies dans
  la section `Tests` justifient son exécution directe par Codex ;
- relancer un test après une correction autorisée uniquement lorsque ces
  mêmes conditions sont remplies ;
- construire une image déjà définie dans le projet lorsque la tâche le
  demande ;
- démarrer, arrêter ou redémarrer un service déjà défini dans
  `compose.yaml` lorsque la tâche le demande explicitement et que cela
  n'implique aucune suppression de volume ou de données ;
- analyser les erreurs et logs nécessaires à la tâche ;
- effectuer, lorsque le diagnostic l'exige, des lectures ciblées et
  strictement non destructives de PostgreSQL afin d'observer l'état
  réel des données du projet ; regrouper autant que possible ces
  lectures en une seule vérification cohérente plutôt que de demander
  plusieurs lectures successives ;
- créer ou modifier les fichiers explicitement concernés par la tâche
  lorsqu'aucune décision structurante n'est nécessaire.

Les commandes bénéficiant d'une autorisation permanente ciblée doivent
être exécutées séparément. Ne pas les regrouper inutilement avec
d'autres commandes dans un script PowerShell composé, afin de préserver
la correspondance avec la règle d'autorisation ciblée.

Regrouper autant que raisonnablement possible les vérifications non
destructives qui nécessitent réellement une approbation, afin d'éviter
plusieurs interruptions successives, sans contourner les approbations
nécessaires. Avant de demander une autorisation technique pour une
lecture de base de données, déterminer les informations nécessaires au
diagnostic et privilégier une requête de lecture suffisamment complète
pour éviter une succession de demandes portant sur le même problème.

Ne pas demander une décision utilisateur simplement parce qu'une action
figure dans cette liste.

### Regroupement des questions et approbations

Avant de commencer une tâche non triviale, analyser autant que possible le
contexte, le code, les documents et les dépendances afin d'identifier les
informations manquantes et les décisions réellement bloquantes.

Si plusieurs questions utilisateur, décisions ou approbations sont
raisonnablement prévisibles, les regrouper dans une seule demande structurée
au début de la tâche plutôt que d'interrompre le travail plusieurs fois
successivement.

Ne pas poser préventivement une longue liste de questions « au cas où » :
inspecter d'abord ce qui peut être résolu à partir du dépôt et ne demander que
les informations réellement nécessaires.

Ne poser une nouvelle question en cours de tâche que si :

- elle ne pouvait raisonnablement pas être anticipée au début ;
- elle dépend d'un résultat découvert pendant l'investigation ;
- elle concerne une nouvelle décision structurante ;
- ou une approbation technique réellement nécessaire apparaît en cours
  d'exécution.

Éviter les interruptions pour des choix locaux que Codex peut prendre lui-même
conformément à `AGENTS.md` et aux décisions déjà validées du projet.

Rester strictement dans le périmètre de la tâche demandée.

Si l'application Codex elle-même exige une autorisation technique ou
sandbox, cette autorisation peut malgré tout apparaître : ce n'est pas
une décision d'architecture du projet.

Une action qui devient destructive, irréversible ou structurante reste
soumise aux règles d'arrêt déjà présentes dans `AGENTS.md`.

## Décisions mineures et décisions structurantes

Une décision locale, réversible et sans effet sur l'architecture peut
être prise directement par Codex si elle est nécessaire à la tâche.

En revanche, avant toute décision structurante, STOP et demander à
l'utilisateur.

Sont notamment considérées comme structurantes :

- modification de l'architecture générale ;
- changement du rôle de Medusa, PostgreSQL, Stripe, R2, Redis ou
  Strapi ;
- ajout ou suppression d'un service d'infrastructure ;
- changement important de `compose.yaml`, des volumes, du réseau ou de
  la persistance ;
- modification du modèle de données ou création d'une stratégie de
  migration ;
- changement concernant l'authentification, les paiements, les
  commandes, les stocks ou les clients ;
- changement d'une décision fonctionnelle F-01 à F-19 ;
- ajout, suppression ou remplacement important d'une dépendance ;
- mise à jour majeure d'une dépendance ;
- suppression importante de code ou de données ;
- modification destructive de Git ou d'une base de données ;
- changement de stratégie concernant les secrets ou les variables
  d'environnement ;
- modification d'un test uniquement pour faire disparaître un échec
  alors que le comportement attendu n'a pas été validé.

Dans ce cas :

1.  expliquer brièvement le choix à faire ;
2.  proposer les options utiles ;
3.  indiquer la recommandation de Codex ;
4.  attendre la décision de l'utilisateur avant de modifier le projet.

## Préservation de l'existant

Lorsqu'une interface ou un design existe déjà, il constitue la référence
par défaut.

Ne pas modifier de manière significative la mise en page, le style
visuel, les couleurs, la typographie, la hiérarchie visuelle, les
composants d'interface ou les interactions visuelles existantes, sauf si
la tâche le demande explicitement.

Si une modification fonctionnelle impose ou semble imposer un changement
de design ou d'expérience utilisateur, STOP et demander l'accord de
l'utilisateur avant toute modification visuelle significative.

Une migration technique, une correction fonctionnelle ou un changement
d'architecture ne constitue pas, à lui seul, une autorisation de
modifier le design existant.

En cas de doute, privilégier la conservation de l'existant.


La préservation de l'existant ne signifie pas conserver une implémentation legacy destinée à disparaître. En particulier, ne pas conserver artificiellement l'ancien système `seller`, Firestore ou AWS S3 direct uniquement pour anticiper une fonction future. Préserver plutôt des frontières d'architecture propres permettant l'évolution ultérieure.

Ne pas contourner un problème en créant inutilement des fichiers
parallèles, copies, sauvegardes ou variantes (`-new`, `-old`, `-v2`,
etc.). Réutiliser et adapter les fichiers existants lorsque c'est
raisonnablement possible. Si une duplication paraît réellement
nécessaire, l'expliquer et demander l'accord de l'utilisateur avant de
la créer.

## Méthode de modification

Pour chaque tâche :

1.  comprendre le besoin ;
2.  inspecter les fichiers concernés ;
3.  diagnostiquer les erreurs ou dysfonctionnements avant de modifier le
    code ;
4.  effectuer le changement minimal nécessaire ;
5.  éviter les refactorings sans rapport avec la tâche ;
6.  préparer les validations pertinentes et, conformément à la section
    `Tests`, soit exécuter directement un test ciblé lorsque cela est
    justifié, soit fournir à l'utilisateur les commandes exactes à lancer
    et attendre ses résultats ;
7.  si un test échoue, analyser la cause avant de modifier quoi que ce
    soit ;
8.  si la cause est claire et locale, effectuer une correction puis
    préparer la nouvelle validation ; ne la relancer directement que si
    les conditions de la section `Tests` le justifient, sinon demander à
    l'utilisateur de l'exécuter et de transmettre le résultat ;
9.  éviter les boucles répétitives modification → test → logs →
    modification sans nouveau diagnostic ;
10. après deux tentatives de correction infructueuses sur le même
    problème, ou dès que plusieurs hypothèses plausibles nécessitent des
    changements différents, STOP, résumer le diagnostic et demander à
    l'utilisateur comment poursuivre ;
11. après toute modification de `server.js` ou du serveur Express,
    redémarrer systématiquement le service `server-dev`, attendre qu’il
    soit de nouveau disponible, puis seulement effectuer la validation
    navigateur ou fonctionnelle ; ne pas supposer que nodemon ou un
    mécanisme de rechargement automatique a chargé la modification ;
12. après toute modification du code backend Medusa qui doit être chargé
    dans l’image du service, reconstruire/recréer systématiquement le
    service Medusa concerné, attendre son redémarrage et vérifier `/health`
    avant toute validation fonctionnelle ; le code backend Medusa n’étant
    pas monté en bind mount dans le conteneur, ne pas supposer qu’une
    modification locale est déjà exécutée ;
13. ne jamais conclure qu’une correction serveur est inefficace ou qu’une
    nouvelle régression existe tant que le service concerné n’a pas été
    explicitement rechargé avec le code actuel ;
14. arrêter et demander si la correction nécessite une décision
    structurante ;
15. si l’utilisateur demande explicitement d’arrêter, ne lancer aucune
    nouvelle action, modification ou validation ;
16. terminer par un rapport synthétique.

La fiche fonctionnelle ou le fichier initialement visé par une migration
ne constitue pas nécessairement une frontière absolue. Rechercher une
frontière fonctionnelle stable et testable :

- analyser les dépendances directes de la fonction demandée ;
- adapter les fonctions directement dépendantes si cela évite deux
  sources de vérité contradictoires, empêche une régression
  directement causée par la migration ou maintient un parcours
  utilisateur cohérent et testable ;
- ne pas étendre automatiquement la migration à toute la chaîne de
  dépendances ;
- s'arrêter et demander une décision lorsqu'une nouvelle décision
  structurante, un changement important d'architecture, un nouveau
  domaine fonctionnel majeur ou un changement non déjà décidé
  concernant notamment l'authentification, le paiement, la commande,
  le modèle de données ou l'infrastructure devient nécessaire.

Le déroulement attendu est : objectif fonctionnel → analyse des
dépendances → adaptations nécessaires → frontière stable → tests →
rapport.

## Tests

### Stratégie d'exécution des tests et économie de quota Codex

Distinguer systématiquement **écrire ou adapter les tests** de
**les exécuter**.

Par défaut, Codex peut examiner, écrire et adapter les tests nécessaires,
mais il ne doit pas lancer automatiquement les suites de tests lorsque
l'utilisateur peut les exécuter lui-même et transmettre les résultats.
Dans ce cas, Codex doit :

1.  préparer les tests nécessaires ;
2.  fournir les commandes exactes à lancer ;
3.  demander à l'utilisateur d'exécuter ces commandes ;
4.  attendre les résultats transmis par l'utilisateur ;
5.  reprendre ensuite le diagnostic ou la correction à partir de ces
    résultats.

Codex peut exécuter lui-même un test uniquement lorsque l'une des
conditions suivantes est remplie :

- l'utilisateur demande explicitement son exécution ;
- le test est très ciblé, rapide et son résultat est nécessaire
  immédiatement pour poursuivre un diagnostic ;
- plusieurs itérations très courtes test → correction → retest sont
  nécessaires et les déléguer une par une à l'utilisateur rendrait le
  travail nettement moins efficace ;
- l'observation directe du navigateur ou du comportement d'exécution
  fait partie du diagnostic et un simple résultat transmis par
  l'utilisateur serait insuffisant.

Même dans ces cas :

- privilégier le test le plus ciblé possible ;
- éviter de lancer une suite complète lorsque quelques tests suffisent ;
- ne pas relancer plusieurs fois une suite lourde sans nouvelle raison
  de diagnostic ;
- ne pas lancer automatiquement un test nécessitant un accès réseau
  externe ou une autorisation particulière ;
- respecter les règles spécifiques concernant Firestore legacy et les
  approbations ponctuelles.

Pour une validation finale ou une suite complète de non-régression,
privilégier l'exécution par l'utilisateur : fournir les commandes exactes
et demander qu'il transmette les résultats.

Les vérifications très légères et quasi instantanées telles que
`git status`, `git diff`, `git diff --check`, une vérification de syntaxe
ciblée ou une vérification de configuration non destructive peuvent rester
exécutées directement par Codex lorsqu'elles sont utiles.

Le coût en quota fait partie de la stratégie de validation : réserver le
quota Codex en priorité aux tâches qui nécessitent analyse, raisonnement,
modification ou diagnostic, et déléguer à l'utilisateur les exécutions
mécaniques lorsque cela ne réduit pas la qualité du travail.

Les tests end-to-end existants utilisent Playwright.

La boutique testée est disponible sur :

`http://127.0.0.1:5000`

Playwright ne démarre pas lui-même la boutique.

Sous Windows dans l'environnement Codex, ne pas supposer que `npx` est
disponible. Pour lancer Playwright depuis Codex, utiliser directement le
runtime Node disponible et le CLI Playwright local du projet.

Les tests Playwright purement locaux peuvent être exécutés sans
approbation lorsqu'ils n'ont pas besoin d'accès réseau externe.

Le test legacy `tests/f01-f02-f03-account.spec.js` utilise encore
Firebase Admin / Firestore pour son nettoyage. Ses assertions
F-01/F-03/F-02 fonctionnent, mais le nettoyage Firestore nécessite
actuellement un accès réseau externe depuis le processus Playwright. Cet
accès reste soumis à une approbation ponctuelle : ne pas créer de règle
permanente pour le contourner.

Commande de référence depuis Codex :

`<runtime-node-direct> .\\node_modules\\playwright\\cli.js test`

La baseline de non-régression actuelle est de 22 tests Playwright réussis sur 22.

Ne jamais modifier un test simplement pour obtenir un résultat vert sans
avoir vérifié que le comportement attendu doit réellement changer.

Des tests automatisés réussis valident uniquement ce qu'ils couvrent.
Lorsqu'une tâche modifie une interface ou un parcours utilisateur, ne
pas conclure que l'interface, l'ergonomie ou le rendu visuel sont
validés uniquement parce que les tests sont verts. Signaler lorsqu'une
validation réelle du comportement ou du rendu reste nécessaire.

Pour les parcours interactifs importants, tester le comportement
observable et pas seulement l'existence du code correspondant.
Lorsqu'une tâche concerne le checkout ou le panier, couvrir selon le
périmètre modifié les interactions réellement utilisées par
l'utilisateur, notamment les boutons `+` / `-`, la suppression d'un
article, le changement de méthode de livraison, le recalcul des
sous-totaux/totaux et les messages d'erreur associés.

Distinguer clairement dans les rapports :

- un test avec réponses simulées ou mocks ;
- un test d'intégration avec les vrais services locaux ;
- un test end-to-end dans un navigateur réel.

Ne jamais présenter un comportement comme validé en conditions réelles
lorsqu'il a seulement été vérifié dans le code, simulé ou mocké.

Un test qui expire, ne peut pas initialiser la page, est bloqué par
l'authentification, par une autre session d'automatisation ou par
l'environnement n'est pas un test réussi : le comportement concerné
reste **non validé**. Ne pas remplacer silencieusement cette validation
par une simple inspection du code.

Lorsqu'une tâche demande de tester un formulaire ou « toutes ses
fonctionnalités », utiliser des données de test clairement fictives et
non sensibles dans l'environnement local lorsque cela suffit à exercer
les validations et interactions. Ne jamais saisir de données
personnelles réelles. Ne pas déclencher un paiement Stripe, créer
volontairement une commande persistante ou créer/modifier un compte de
test sauf si la tâche l'autorise explicitement ou si cette action fait
déjà partie du scénario de test explicitement demandé.

Si l'authentification empêche un test navigateur réel et qu'aucune
session ou donnée de test autorisée n'est disponible, signaler
précisément ce blocage. Ne pas affirmer que les interactions derrière ce
blocage sont validées parce qu'elles existent dans le code.

Pour une modification qui ne concerne que de la documentation, les tests
applicatifs ne sont pas obligatoires.

## Docker Compose

Employer une terminologie précise dans les rapports :

- Docker Engine : construit les images et exécute les conteneurs ;
- Docker CLI : commandes `docker ...` ;
- Docker Compose : orchestration des services définis dans
  `compose.yaml`.

Pour une simple validation Docker Compose, toujours préférer
`docker compose config --quiet`, sans afficher la configuration
développée si cela n'est pas indispensable, afin de ne pas exposer les
secrets.

`docker compose config --quiet`

## Sécurité

Ne jamais :

- afficher le contenu complet d'un fichier `.env` ;
- recopier des secrets dans un rapport ;
- exposer volontairement des clés Firebase, AWS, Stripe ou Medusa ;
- exécuter automatiquement `npm audit fix` ;
- supprimer un volume ou des données persistantes sans autorisation ;
- exécuter `git reset --hard`, `git clean -fd`, un force push ou une
  commande Git destructive sans autorisation explicite ;
- supprimer ou recréer une base PostgreSQL sans autorisation
  explicite.

Ne jamais considérer comme globalement sûrs ni chercher à faire
autoriser globalement :

- PowerShell ;
- `docker compose exec` ;
- `psql` ;
- Node ;
- Playwright ;
- toute commande pouvant exécuter du code arbitraire ou modifier des
  données.

Ne pas faire de commit ni de push sauf si la tâche le demande
explicitement.

## Documentation

La documentation doit rester minimale et utile.

Tout document permanent du projet doit comporter une **table des matières placée au début du document, immédiatement après son titre**.

Mettre à jour la documentation lorsqu'une modification change réellement
:

- une commande ;
- le fonctionnement du projet ;
- une décision d'architecture ;
- un parcours fonctionnel important.

Ne pas créer plusieurs documents décrivant la même chose.

Éviter de recopier dans la documentation des informations qui peuvent
être déduites directement du code et qui risquent de devenir rapidement
obsolètes.

## Rapport final de Codex

Avant tout rapport final concernant une modification du dépôt, vérifier
l'état Git réel et établir la liste des fichiers modifiés à partir de
Git et du diff (`git status` / `git diff`), et non à partir d'une
estimation interne de la session.

À la fin d'une tâche, indiquer brièvement :

- ce qui a été analysé ;
- les fichiers modifiés ;
- ce qui a changé ;
- les tests ou validations exécutés par Codex ;
- les tests ou validations laissés à exécuter par l'utilisateur avec les
  commandes correspondantes ;
- les résultats connus à ce stade ;
- les éventuels risques, blocages ou points restant à décider.

Employer explicitement `réussi`, `échoué`, `bloqué` ou `non validé` pour
les validations importantes. Ne pas résumer comme « vérifié » un
comportement seulement inspecté dans le code.

Si aucune modification n'était nécessaire, le dire explicitement.
