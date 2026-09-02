# CODEX_PROJECT_BOOTSTRAP.md

**Version : 1.0**  
**Statut : document générique évolutif**  
**Objectif : préparer méthodiquement un nouveau projet avant les modifications de code importantes.**

---

## 1. Rôle de ce document

Ce document explique à Codex **comment prendre en main un projet qu'il ne connaît pas encore**.

Il ne décrit pas l'architecture d'un projet particulier et ne doit pas imposer à l'avance un framework, une base de données, un hébergeur, un système d'authentification, un outil de paiement, un CMS ou une autre technologie.

Son rôle est de guider Codex jusqu'au moment où il dispose de suffisamment d'informations fiables pour travailler de façon autonome et sûre dans le projet.

Le résultat attendu est le passage progressif de :

```text
Dépôt inconnu
    ↓
Découverte
    ↓
Compréhension fonctionnelle et technique
    ↓
Décisions structurantes avec l'utilisateur
    ↓
Documentation de référence
    ↓
Filet de sécurité / baseline
    ↓
Plan de travail
    ↓
AGENTS.md opérationnel
    ↓
Développement autonome par objectifs
```

---

## 2. Principe général

Au démarrage d'un projet, Codex ne doit pas commencer immédiatement à modifier le code.

Il doit d'abord :

1. comprendre ce qui existe ;
2. identifier ce qui est certain et ce qui ne l'est pas ;
3. distinguer les choix mineurs des décisions structurantes ;
4. poser à l'utilisateur uniquement les questions réellement nécessaires ;
5. formaliser les décisions prises ;
6. créer ou compléter les documents de référence utiles ;
7. établir un état de référence testable ;
8. seulement ensuite commencer les modifications importantes.

L'objectif n'est pas de produire beaucoup de documentation. L'objectif est de produire **le minimum de documentation durable nécessaire pour que Codex puisse ensuite travailler sans redemander continuellement le contexte**.

---

## 3. Deux modes de démarrage

Codex doit d'abord déterminer dans quel cas se trouve le projet.

### Mode A — Projet existant

Le dépôt contient déjà une application ou un système fonctionnel, même partiellement.

Dans ce cas, Codex doit distinguer :

```text
AS-IS
→ ce que le projet fait réellement aujourd'hui

TO-BE
→ ce que le projet devra devenir
```

Une cartographie fonctionnelle et technique de l'existant est généralement nécessaire avant toute transformation importante.

### Mode B — Nouveau projet / greenfield

Le dépôt est vide ou presque vide et le produit n'existe pas encore.

Dans ce cas, Codex ne doit pas inventer une fausse cartographie AS-IS.

Il doit plutôt aider à définir :

- le besoin métier ;
- les parcours utilisateurs ;
- les fonctions attendues ;
- les contraintes ;
- les choix structurants ;
- l'architecture cible ;
- la stratégie de tests ;
- les étapes de réalisation.

---

## 4. Phase 0 — Sécurité et état initial

Avant toute action importante, Codex doit établir l'état réel du dépôt.

Vérifier au minimum, lorsque cela s'applique :

- la branche Git active ;
- `git status` ;
- les modifications locales existantes ;
- les fichiers non suivis ;
- la présence éventuelle d'un `AGENTS.md` ;
- la présence de README, documentation, tests et fichiers de configuration ;
- les fichiers contenant potentiellement des secrets ou variables d'environnement ;
- les outils et runtimes utilisés par le projet.

Ne jamais :

- écraser une modification locale préexistante ;
- afficher inutilement des secrets ;
- exécuter une commande destructive pour « repartir proprement » ;
- modifier un fichier avant d'avoir compris son rôle ;
- supposer qu'une configuration d'exemple correspond à l'environnement réel.

Si un `AGENTS.md` existe déjà, le lire avant toute autre modification et considérer ses règles comme prioritaires pour ce dépôt.

---

## 5. Phase 1 — Découverte du dépôt

Codex doit inspecter le projet sans chercher immédiatement à le corriger.

Il doit identifier autant que possible :

### Structure générale

- applications et services ;
- frontend / storefront ;
- backend / API ;
- bases de données ;
- stockage de fichiers ;
- systèmes externes ;
- scripts ;
- tests ;
- CI/CD ;
- conteneurs et orchestration éventuelle ;
- hébergement ou infrastructure décrite dans le dépôt.

### Stack technique

- langages ;
- runtimes ;
- frameworks ;
- bibliothèques importantes ;
- versions ;
- package managers ;
- outils de build ;
- systèmes de test ;
- systèmes de persistance ;
- services tiers.

### Flux principaux

Codex doit repérer les principaux parcours du projet, par exemple :

```text
interface
→ logique frontend
→ API
→ logique métier
→ stockage
→ service externe éventuel
```

Le but de cette phase est la compréhension, pas le refactoring.

---

## 6. Phase 2 — Cartographie fonctionnelle

Pour un projet existant, Codex doit dresser une cartographie fonctionnelle de ce que l'application fait réellement.

Chaque fonction importante devrait idéalement préciser :

- son objectif utilisateur ;
- son point d'entrée ;
- les fichiers principaux ;
- les routes/API concernées ;
- les données utilisées ;
- les dépendances ;
- la persistance ;
- les services externes ;
- les risques connus ;
- les tests existants ;
- la cible future si elle est déjà décidée.

Utiliser des identifiants stables si le projet est assez grand, par exemple :

```text
F-01
F-02
F-03
...
```

Ne pas créer cette structure artificiellement pour un projet très petit si elle n'apporte rien.

Pour un projet greenfield, remplacer la cartographie AS-IS par une **spécification fonctionnelle initiale** des parcours et fonctions attendus.

---

## 7. Phase 3 — Cartographie technique

Codex doit comprendre les grandes responsabilités techniques avant de proposer des changements d'architecture.

Documenter seulement ce qui est utile, notamment :

- composants principaux ;
- communication entre composants ;
- source de vérité des données ;
- authentification ;
- sessions ;
- stockage ;
- traitements asynchrones ;
- paiements ;
- e-mails ;
- fichiers et médias ;
- observabilité ;
- déploiement ;
- dépendances externes critiques.

Un schéma simple vaut souvent mieux qu'un long texte.

Exemple générique :

```text
Navigateur
    ↓
Frontend
    ↓
Backend / API
    ↓
Moteur métier
    ↓
Base de données

        ├── stockage fichiers
        ├── authentification
        └── services externes
```

---

## 8. Phase 4 — Identifier les décisions structurantes manquantes

Codex ne doit pas inventer silencieusement les grandes décisions du projet.

Il doit établir la liste des choix qui nécessitent réellement l'utilisateur.

Exemples fréquents :

- objectif du produit ;
- public cible ;
- mono-utilisateur / multi-utilisateur ;
- mono-marchand / marketplace ;
- choix ou remplacement du framework ;
- SQL / NoSQL ;
- stratégie d'authentification ;
- hébergement ;
- stockage des fichiers ;
- système de paiement ;
- fournisseur d'e-mails ;
- CMS ;
- politique de données ;
- niveau de compatibilité avec l'existant ;
- migration progressive ou réécriture ;
- contraintes de coût ;
- contraintes open source / SaaS ;
- exigences de sécurité ou conformité ;
- stratégie de tests ;
- navigateur ou plateformes supportées.

Codex doit éviter les questions inutiles auxquelles il peut répondre en inspectant le dépôt.

---

## 9. Protocole de décision avec l'utilisateur

Lorsqu'une décision structurante est nécessaire, Codex doit :

1. expliquer brièvement le problème ;
2. présenter les options réellement pertinentes ;
3. donner les avantages et inconvénients utiles ;
4. formuler une recommandation ;
5. attendre la décision de l'utilisateur ;
6. enregistrer ensuite la décision dans un document durable du dépôt.

Le but n'est pas de transformer l'utilisateur en architecte logiciel.

Codex doit prendre seul les décisions locales, réversibles et sans impact architectural important.

---

## 10. Phase 5 — Produire les documents de référence

Ne créer que les documents réellement utiles au projet.

### 10.1 `AGENTS.md`

`AGENTS.md` contient les règles opérationnelles permanentes propres au dépôt.

Il peut notamment contenir :

- mission du projet ;
- décisions d'architecture déjà validées ;
- sources de vérité ;
- règles de sécurité ;
- commandes sûres ;
- règles Git ;
- stratégie de tests ;
- comportement attendu de Codex ;
- décisions mineures vs structurantes ;
- méthode de modification ;
- forme du rapport final.

`AGENTS.md` ne doit pas devenir une copie de toute la documentation du projet.

### 10.2 Cartographie fonctionnelle

Pour un projet existant suffisamment complexe :

```text
docs/CARTOGRAPHIE_FONCTIONNELLE.md
```

Elle décrit principalement le fonctionnement métier et les dépendances importantes.

### 10.3 Décisions du projet

Si les décisions structurantes deviennent nombreuses, créer un document dédié, par exemple :

```text
docs/DECISIONS_PROJET.md
```

Éviter toutefois de dupliquer les mêmes décisions dans plusieurs fichiers.

### 10.4 Roadmap / matrice de transformation

Pour une migration importante, créer si nécessaire une synthèse indiquant pour chaque fonction ou domaine :

```text
conserver
remplacer
adapter
développer
supprimer
```

Pour un projet greenfield, utiliser plutôt une roadmap de construction.

### 10.5 Documentation d'exploitation

Les commandes réellement utiles pour démarrer, arrêter, tester, construire ou déployer doivent être documentées dans le README ou un document opérationnel unique.

---

## 11. Phase 6 — Construire le filet de sécurité

Avant une transformation importante d'un projet existant, Codex doit chercher à établir une baseline.

Selon le projet, cela peut inclure :

- tests unitaires ;
- tests d'intégration ;
- tests end-to-end ;
- tests API ;
- tests de build ;
- tests de démarrage ;
- vérifications visuelles ;
- scénarios manuels reproductibles.

Principe :

```text
état actuel validé
    ↓
modification
    ↓
comparaison
```

Ne pas « réparer » un test uniquement pour le faire passer si le comportement fonctionnel attendu n'est pas établi.

Si aucun test n'existe, Codex doit proposer le filet de sécurité minimal adapté avant une migration risquée.

---

## 12. Phase 7 — Préparer l'environnement de travail

Avant les grosses modifications, vérifier selon le besoin :

- version du runtime ;
- dépendances ;
- environnement local reproductible ;
- conteneurs éventuels ;
- variables d'environnement ;
- services locaux ;
- accès aux bases ;
- outils de test ;
- scripts de démarrage ;
- état Git propre.

Ne pas mettre à jour toutes les dépendances « par principe ».

Chaque mise à jour doit servir un objectif identifié.

---

## 13. Phase 8 — Identifier, regrouper et hiérarchiser les objectifs

Une fois les décisions prises et le filet de sécurité disponible, Codex ne doit pas seulement attendre une liste détaillée de tâches fournie par l'utilisateur.

À partir de la cartographie, des décisions validées, du code réel, des tests et de la roadmap, il doit être capable de **proposer lui-même les prochains objectifs de travail**.

### 13.1 Identifier les objectifs

Codex doit transformer l'écart entre l'état actuel et l'état cible en objectifs fonctionnels ou techniques compréhensibles.

Un objectif doit décrire un résultat à atteindre, pas seulement une liste de fichiers à modifier.

Exemple générique :

```text
mauvais objectif
→ modifier auth.js, session.js et user.js

meilleur objectif
→ rendre l'authentification cohérente avec la nouvelle source d'identité
```

### 13.2 Regrouper les modifications liées

Codex doit rechercher les modifications qui appartiennent au même problème fonctionnel ou à la même source de vérité.

Il doit éviter de traiter séparément plusieurs changements qui doivent évoluer ensemble pour produire un état cohérent.

Exemple générique :

```text
fonction A
    ↓
donnée partagée
    ↓
fonction B
    ↓
fonction C
```

Si A, B et C doivent être adaptées ensemble pour que la donnée reste cohérente, elles peuvent former **un même groupe de travail**.

Le groupe doit être poursuivi jusqu'à une frontière fonctionnelle stable et testable avant de passer à un autre domaine indépendant.

### 13.3 Hiérarchiser les objectifs

L'ordre des travaux doit être raisonné.

Commencer par les changements les plus simples peut être utile pour apprendre le projet et réduire le risque, mais ce n'est pas une règle absolue.

Codex doit notamment prendre en compte :

1. les dépendances : traiter d'abord ce qui débloque les étapes suivantes ;
2. le risque : sécuriser tôt les zones critiques ou difficiles à tester ;
3. la simplicité : privilégier les gains rapides lorsqu'ils ne créent pas de détour ;
4. la cohérence des données : éliminer en priorité les doubles sources de vérité dangereuses ;
5. la valeur fonctionnelle : rendre un parcours complet utilisable plutôt que multiplier les demi-migrations ;
6. la réversibilité : préférer les étapes faciles à valider et à annuler ;
7. le legacy : supprimer progressivement ce qui n'est plus nécessaire sans moderniser inutilement ce qui doit disparaître ;
8. le coût de validation : regrouper ce qui peut être testé de façon cohérente ;
9. les décisions encore ouvertes : ne pas commencer un chantier bloqué par un choix structurant non tranché.

### 13.4 Construire une séquence de travail

Le plan doit donc ressembler à :

```text
état actuel
    ↓
identifier les écarts vers la cible
    ↓
regrouper les changements liés
    ↓
ordonner les groupes selon dépendances / risque / valeur
    ↓
traiter un groupe jusqu'à une frontière stable
    ↓
tester et valider
    ↓
mettre à jour l'état du plan
    ↓
choisir le groupe suivant
```

Ne pas suivre mécaniquement une numérotation, l'ordre des fichiers ou l'ordre historique des demandes si les dépendances réelles imposent une meilleure séquence.

Codex doit être capable d'expliquer brièvement **pourquoi il recommande cet ordre**.

---

## 14. Règle de frontière fonctionnelle stable

Lorsqu'un objectif de modification est donné, le fichier ou la fonction initialement nommée ne constitue pas nécessairement la frontière réelle du travail.

Codex doit rechercher une **frontière fonctionnelle stable et testable**.

Il peut adapter les fonctions directement dépendantes lorsque cela est nécessaire pour :

- éviter deux sources de vérité contradictoires ;
- empêcher une régression directement causée par la modification ;
- maintenir un parcours utilisateur cohérent ;
- atteindre un état réellement fonctionnel et testable.

Mais Codex ne doit pas transformer automatiquement toute la chaîne des dépendances.

Il doit s'arrêter lorsqu'il rencontre une nouvelle décision structurante ou un nouveau domaine majeur non encore décidé.

Schéma :

```text
objectif fonctionnel
    ↓
analyse des dépendances
    ↓
adaptations nécessaires
    ↓
frontière stable
    ↓
tests
    ↓
rapport
```

---

## 15. Boucle de développement autonome

Une fois le bootstrap terminé, Codex peut travailler par objectifs plutôt que par recettes détaillées.

Il ne doit pas seulement exécuter l'objectif courant : lorsqu'un groupe de travail est terminé, il doit aussi être capable d'identifier **le prochain objectif logique** à partir de la roadmap, de la cartographie, des dépendances et de l'état réel du projet.

Boucle attendue :

```text
choisir / confirmer l'objectif prioritaire
    ↓
inspection ciblée
    ↓
identifier les dépendances directes
    ↓
définir le groupe de modifications cohérent
    ↓
implémentation
    ↓
tests ciblés
    ↓
échec ? ── oui → analyse → correction → retest
    │
    non
    ↓
tests des fonctions liées
    ↓
validation navigateur si utile
    ↓
contrôle Git réel
    ↓
frontière stable atteinte ?
    │
    ├── non → poursuivre le même groupe
    │
    └── oui
            ↓
          rapport
            ↓
mettre à jour l'état du plan
            ↓
proposer le prochain objectif prioritaire
```

Codex doit éviter de disperser le travail entre plusieurs domaines indépendants en parallèle sans raison.

Lorsqu'un ensemble de modifications est fortement lié, il doit le mener jusqu'à une frontière cohérente et testable avant de passer à un autre ensemble.

Codex peut prendre seul les décisions locales nécessaires tant qu'elles respectent `AGENTS.md` et les décisions déjà validées.

Si le prochain objectif nécessite une nouvelle décision structurante, il doit la soumettre avant de commencer ce nouveau chantier.

---

## 16. Gestion des tests et du navigateur

Codex doit choisir les validations proportionnellement au changement.

Il ne doit pas lancer systématiquement toute la suite si un test ciblé suffit pendant l'itération.

Une stratégie efficace est souvent :

```text
test ciblé pendant le développement
    ↓
tests des fonctions directement liées
    ↓
suite complète avant validation finale si le risque le justifie
```

Lorsque le comportement visuel ou interactif fait partie du résultat, utiliser une validation navigateur si les outils disponibles le permettent.

Éviter les validations répétitives qui n'apportent aucune information nouvelle.

---

## 17. Gestion Git générique

Sauf règle différente du projet :

- travailler sur une branche dédiée pour une modification importante ;
- conserver `main` stable ;
- ne pas faire de commit ou push sans autorisation si `AGENTS.md` l'interdit ;
- vérifier le diff réel avant le rapport final ;
- fusionner une branche validée dans `main` ;
- utiliser un tag pour conserver un jalon historique important ;
- supprimer ensuite les branches de travail devenues inutiles.

Convention conceptuelle :

```text
branche = travail en cours
merge dans main = travail intégré
tag = jalon historique
```

Le nommage exact doit rester adapté au projet.

---

## 18. Sécurité

Les règles suivantes s'appliquent à tout projet :

- ne jamais exposer volontairement un secret ;
- éviter les commandes qui affichent inutilement les variables sensibles ;
- ne jamais supprimer des données persistantes sans autorisation explicite ;
- ne jamais exécuter une correction automatique massive de dépendances sans analyse ;
- ne jamais faire de force push, reset destructif ou nettoyage Git destructif sans autorisation explicite ;
- ne jamais créer une permission permanente trop large simplement pour éviter une confirmation ;
- préférer les autorisations étroites, prévisibles et réversibles ;
- traiter séparément les vulnérabilités ou secrets historiques découverts pendant un chantier si leur correction immédiate n'est pas nécessaire au périmètre en cours.

---

## 19. Documentation : règle de sobriété

La documentation doit aider Codex et les humains à prendre de meilleures décisions.

### 19.1 Types de documentation

Un projet préparé avec ce Bootstrap doit distinguer les rôles documentaires suivants :

- les instructions opérationnelles actives du projet, par exemple `AGENTS.md` ;
- la connaissance fonctionnelle du projet, par exemple une cartographie ;
- la documentation technique et d'exploitation, par exemple `README.md` ;
- la documentation méthodologique générique, comme `CODEX_PROJECT_BOOTSTRAP`.

Un document méthodologique générique ne doit pas devenir implicitement une deuxième source d'instructions actives concurrente d'`AGENTS.md`. Les règles opérationnelles applicables restent celles définies par le projet.

Ne pas créer un document pour chaque sujet.

Ne pas recopier :

- le code ;
- des listes de fichiers triviales ;
- des détails facilement déductibles qui deviendront vite obsolètes.

Préférer documenter :

- décisions ;
- architecture ;
- parcours ;
- responsabilités ;
- commandes ;
- contraintes ;
- comportements difficiles à déduire du code.

---

## 20. Critères de fin du bootstrap

Le bootstrap peut être considéré comme suffisamment terminé lorsque :

- Codex comprend la mission du projet ;
- la structure et les responsabilités principales sont identifiées ;
- les grandes fonctions sont cartographiées ou spécifiées ;
- les décisions structurantes nécessaires au démarrage ont été prises ;
- les choix sont enregistrés dans le dépôt ;
- `AGENTS.md` contient les règles propres au projet ;
- un filet de sécurité adapté existe ou son absence a été explicitement acceptée ;
- l'environnement de travail est compris ;
- une roadmap ou un prochain objectif clair existe ;
- Codex sait quelles décisions il peut prendre seul et lesquelles exigent l'utilisateur.

Le bootstrap n'a pas besoin de répondre à toutes les questions futures du projet.

Il doit seulement fournir **assez de contexte fiable pour commencer à développer proprement**.

---

## 21. Rapport de fin de bootstrap

Avant de commencer les modifications importantes, Codex doit remettre un rapport synthétique contenant au minimum :

- type de projet : existant ou greenfield ;
- mission comprise ;
- stack identifiée ;
- architecture actuelle ou cible ;
- documents créés ou mis à jour ;
- décisions structurantes prises ;
- décisions encore ouvertes ;
- baseline / tests disponibles ;
- risques importants ;
- dette legacy connue ;
- première frontière fonctionnelle recommandée ;
- état Git réel.

---

## 22. Prompt minimal pour utiliser ce document

Exemple de prompt utilisateur au début d'un futur projet :

```text
Applique CODEX_PROJECT_BOOTSTRAP.md à ce projet.

Commence par découvrir et comprendre le dépôt.
Ne modifie pas encore le code applicatif.

Construis progressivement avec moi les décisions et documents nécessaires jusqu'à ce que le projet soit prêt pour un développement autonome.

Pose-moi uniquement les questions correspondant à de vraies décisions structurantes que tu ne peux pas résoudre à partir du dépôt.

Lorsque le bootstrap est suffisamment terminé, présente-moi l'état du projet, les documents produits, les décisions prises, les risques et la première frontière fonctionnelle que tu recommandes de traiter.
```

---

## 23. Évolution de ce document

`CODEX_PROJECT_BOOTSTRAP.md` est un document générique vivant.

Lorsqu'un projet révèle une nouvelle bonne pratique réutilisable dans d'autres projets, évaluer si elle doit être intégrée ici.

Ne pas y ajouter une règle uniquement parce qu'elle est utile à un projet particulier : les règles spécifiques restent dans le `AGENTS.md` du projet concerné.

---

## Historique des versions

### 1.0 — 2026-09-02

Première version créée à partir des enseignements du workflow ChatGPT ↔ Codex :

- découverte avant modification ;
- distinction projet existant / greenfield ;
- décisions mineures vs structurantes ;
- cartographie fonctionnelle ;
- création progressive de `AGENTS.md` ;
- baseline de tests ;
- autonomie par objectifs ;
- identification autonome des prochains objectifs ;
- regroupement des modifications liées ;
- hiérarchisation par dépendances, risque, simplicité, valeur et cohérence ;
- traitement d'un groupe jusqu'à une frontière fonctionnelle stable avant de passer au suivant ;
- frontière fonctionnelle stable ;
- validation par tests et navigateur ;
- contrôle Git réel ;
- convention branche / merge / tag ;
- règles génériques de sécurité et de sobriété documentaire.
