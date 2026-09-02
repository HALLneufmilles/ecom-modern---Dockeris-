# AGENTS.md

## Mission du projet

Faire évoluer progressivement la boutique e-commerce existante vers une architecture basée sur Medusa et PostgreSQL, sans casser le storefront actuel ni les fonctionnalités déjà validées.

La migration doit être progressive et vérifiable par les tests.

## Décisions d'architecture déjà validées

Ces décisions ne doivent pas être remises en cause sans demande explicite de l'utilisateur :

* la première version reste mono-marchand ;
* le storefront actuel est conservé ;
* Medusa devient le moteur e-commerce ;
* PostgreSQL devient le stockage durable des données e-commerce ;
* Medusa Admin sert à administrer les produits ;
* les variantes produit doivent gérer notamment les tailles et couleurs ;
* la wishlist est conservée et devra devenir persistante côté client ;
* Stripe est conservé en environnement de test pour le projet de démonstration ;
* les images doivent être gérées par Medusa File Module avec Cloudflare R2 comme stockage cible ;
* Firestore et la manipulation directe d'AWS S3 sont destinés à disparaître progressivement ;
* Redis viendra plus tard si nécessaire ;
* Strapi est également prévu plus tard pour le contenu éditorial.

Ne pas moderniser inutilement une partie legacy Firebase, Firestore ou AWS destinée à disparaître, sauf si cela est nécessaire pour sécuriser ou poursuivre la migration.

## Sources de vérité du projet

Avant une modification importante, consulter selon le besoin :

1. `AGENTS.md` pour les règles de travail ;
2. `docs/CARTOGRAPHIE_FONCTIONNELLE.md` pour le fonctionnement et les décisions fonctionnelles ;
3. `readme.md` pour les commandes et le fonctionnement documenté du projet ;
4. le code et la configuration réellement présents dans la branche de travail.

`docs/CODEX_PROJECT_BOOTSTRAP_v1.0.md` est un document méthodologique générique et évolutif. Il peut être consulté comme référence, mais ses instructions ne doivent pas être exécutées automatiquement lors des tâches courantes de ce projet. `AGENTS.md` reste la source des instructions opérationnelles actives de ce dépôt. Si Codex identifie une amélioration pertinente à apporter au Bootstrap, il doit la signaler avant toute modification de ce fichier, sauf si la tâche demande explicitement de le modifier.

Si le code, la documentation et les instructions semblent se contredire, ne pas choisir silencieusement une interprétation : signaler le conflit.

## Avant toute modification

Toujours commencer par vérifier l'état réel du dépôt :

* branche Git active ;
* `git status` ;
* modifications locales déjà présentes ;
* fichiers concernés par la tâche.

Ne jamais écraser ou annuler une modification locale préexistante sans autorisation explicite.

Examiner le code existant avant de proposer ou d'écrire une nouvelle implémentation.

## Actions autorisées sans décision préalable

Codex peut effectuer sans demander une décision préalable, dans le périmètre de la tâche en cours :

* lire et rechercher dans les fichiers du dépôt ;
* exécuter `git status`, `git diff`, `git branch` et les autres commandes Git strictement en lecture ;
* exécuter `docker compose ps` ;
* exécuter `docker compose config --quiet` ;
* consulter une quantité raisonnable de logs avec `docker compose logs`, en évitant d'exposer les secrets ;
* effectuer des vérifications locales de ports ou de processus en lecture seule ;
* effectuer des requêtes HTTP locales en lecture seule vers les services du projet, par exemple `/health` ou l'interface locale ;
* lancer les tests existants avec la commande adaptée à l'environnement d'exécution ;
* relancer un test après une correction autorisée ;
* construire une image déjà définie dans le projet lorsque la tâche le demande ;
* démarrer, arrêter ou redémarrer un service déjà défini dans `compose.yaml` lorsque la tâche le demande explicitement et que cela n'implique aucune suppression de volume ou de données ;
* analyser les erreurs et logs nécessaires à la tâche ;
* créer ou modifier les fichiers explicitement concernés par la tâche lorsqu'aucune décision structurante n'est nécessaire.

Les commandes bénéficiant d'une autorisation permanente ciblée doivent être exécutées séparément. Ne pas les regrouper inutilement avec d'autres commandes dans un script PowerShell composé, afin de préserver la correspondance avec la règle d'autorisation ciblée.

Regrouper autant que raisonnablement possible les vérifications non destructives qui nécessitent réellement une approbation, afin d'éviter plusieurs interruptions successives, sans contourner les approbations nécessaires.

Ne pas demander une décision utilisateur simplement parce qu'une action figure dans cette liste.

Rester strictement dans le périmètre de la tâche demandée.

Si l'application Codex elle-même exige une autorisation technique ou sandbox, cette autorisation peut malgré tout apparaître : ce n'est pas une décision d'architecture du projet.

Une action qui devient destructive, irréversible ou structurante reste soumise aux règles d'arrêt déjà présentes dans `AGENTS.md`.

## Décisions mineures et décisions structurantes

Une décision locale, réversible et sans effet sur l'architecture peut être prise directement par Codex si elle est nécessaire à la tâche.

En revanche, avant toute décision structurante, STOP et demander à l'utilisateur.

Sont notamment considérées comme structurantes :

* modification de l'architecture générale ;
* changement du rôle de Medusa, PostgreSQL, Stripe, R2, Redis ou Strapi ;
* ajout ou suppression d'un service d'infrastructure ;
* changement important de `compose.yaml`, des volumes, du réseau ou de la persistance ;
* modification du modèle de données ou création d'une stratégie de migration ;
* changement concernant l'authentification, les paiements, les commandes, les stocks ou les clients ;
* changement d'une décision fonctionnelle F-01 à F-19 ;
* ajout, suppression ou remplacement important d'une dépendance ;
* mise à jour majeure d'une dépendance ;
* suppression importante de code ou de données ;
* modification destructive de Git ou d'une base de données ;
* changement de stratégie concernant les secrets ou les variables d'environnement ;
* modification d'un test uniquement pour faire disparaître un échec alors que le comportement attendu n'a pas été validé.

Dans ce cas :

1. expliquer brièvement le choix à faire ;
2. proposer les options utiles ;
3. indiquer la recommandation de Codex ;
4. attendre la décision de l'utilisateur avant de modifier le projet.

## Méthode de modification

Pour chaque tâche :

1. comprendre le besoin ;
2. inspecter les fichiers concernés ;
3. effectuer le changement minimal nécessaire ;
4. éviter les refactorings sans rapport avec la tâche ;
5. lancer les validations pertinentes ;
6. si un test échoue, analyser la cause avant de modifier quoi que ce soit ;
7. corriger puis relancer le test lorsque la correction reste dans le périmètre autorisé ;
8. arrêter et demander si la correction nécessite une décision structurante ;
9. terminer par un rapport synthétique.

La fiche fonctionnelle ou le fichier initialement visé par une migration ne constitue pas nécessairement une frontière absolue. Rechercher une frontière fonctionnelle stable et testable :

* analyser les dépendances directes de la fonction demandée ;
* adapter les fonctions directement dépendantes si cela évite deux sources de vérité contradictoires, empêche une régression directement causée par la migration ou maintient un parcours utilisateur cohérent et testable ;
* ne pas étendre automatiquement la migration à toute la chaîne de dépendances ;
* s'arrêter et demander une décision lorsqu'une nouvelle décision structurante, un changement important d'architecture, un nouveau domaine fonctionnel majeur ou un changement non déjà décidé concernant notamment l'authentification, le paiement, la commande, le modèle de données ou l'infrastructure devient nécessaire.

Le déroulement attendu est : objectif fonctionnel → analyse des dépendances → adaptations nécessaires → frontière stable → tests → rapport.

## Tests

Les tests end-to-end existants utilisent Playwright.

La boutique testée est disponible sur :

`http://127.0.0.1:5000`

Playwright ne démarre pas lui-même la boutique.

Sous Windows dans l'environnement Codex, ne pas supposer que `npx` est disponible. Pour lancer Playwright depuis Codex, utiliser directement le runtime Node disponible et le CLI Playwright local du projet.

Les tests Playwright purement locaux peuvent être exécutés sans approbation lorsqu'ils n'ont pas besoin d'accès réseau externe.

Le test legacy `tests/f01-f02-f03-account.spec.js` utilise encore Firebase Admin / Firestore pour son nettoyage. Ses assertions F-01/F-03/F-02 fonctionnent, mais le nettoyage Firestore nécessite actuellement un accès réseau externe depuis le processus Playwright. Cet accès reste soumis à une approbation ponctuelle : ne pas créer de règle permanente pour le contourner.

Commande de référence depuis Codex :

`<runtime-node-direct> .\\node_modules\\playwright\\cli.js test`

La baseline validée après la migration vers Node 22 est de 18 tests réussis sur 18.

Ne jamais modifier un test simplement pour obtenir un résultat vert sans avoir vérifié que le comportement attendu doit réellement changer.

Pour une modification qui ne concerne que de la documentation, les tests applicatifs ne sont pas obligatoires.

## Docker Compose

Employer une terminologie précise dans les rapports :

* Docker Engine : construit les images et exécute les conteneurs ;
* Docker CLI : commandes `docker ...` ;
* Docker Compose : orchestration des services définis dans `compose.yaml`.

Pour une simple validation Docker Compose, toujours préférer `docker compose config --quiet`, sans afficher la configuration développée si cela n'est pas indispensable, afin de ne pas exposer les secrets.

`docker compose config --quiet`

## Sécurité

Ne jamais :

* afficher le contenu complet d'un fichier `.env` ;
* recopier des secrets dans un rapport ;
* exposer volontairement des clés Firebase, AWS, Stripe ou Medusa ;
* exécuter automatiquement `npm audit fix` ;
* supprimer un volume ou des données persistantes sans autorisation ;
* exécuter `git reset --hard`, `git clean -fd`, un force push ou une commande Git destructive sans autorisation explicite ;
* supprimer ou recréer une base PostgreSQL sans autorisation explicite.

Ne jamais considérer comme globalement sûrs ni chercher à faire autoriser globalement :

* PowerShell ;
* `docker compose exec` ;
* `psql` ;
* Node ;
* Playwright ;
* toute commande pouvant exécuter du code arbitraire ou modifier des données.

Ne pas faire de commit ni de push sauf si la tâche le demande explicitement.

## Documentation

La documentation doit rester minimale et utile.

Mettre à jour la documentation lorsqu'une modification change réellement :

* une commande ;
* le fonctionnement du projet ;
* une décision d'architecture ;
* un parcours fonctionnel important.

Ne pas créer plusieurs documents décrivant la même chose.

Éviter de recopier dans la documentation des informations qui peuvent être déduites directement du code et qui risquent de devenir rapidement obsolètes.

## Rapport final de Codex

Avant tout rapport final concernant une modification du dépôt, vérifier l'état Git réel et établir la liste des fichiers modifiés à partir de Git et du diff (`git status` / `git diff`), et non à partir d'une estimation interne de la session.

À la fin d'une tâche, indiquer brièvement :

* ce qui a été analysé ;
* les fichiers modifiés ;
* ce qui a changé ;
* les tests ou validations exécutés ;
* leur résultat ;
* les éventuels risques ou points restant à décider.

Si aucune modification n'était nécessaire, le dire explicitement.
