# Projet e-commerce — Storefront + Medusa + PostgreSQL

**Version : v1**  
**Date de publication : 09/10/2026**

<a id="table-des-matieres"></a>

## Table des matières
- [Suivi des modifications](#suivi-des-modifications)
- [Utilisation quotidienne — à lire en premier](#utilisation-quotidienne)
  - [Arbre de décision rapide](#arbre-decision-rapide)
- [Identifiant de test](#identifiant-de-test)
- [Documents du projet et localisation](#documents-du-projet)
- [1. Qu'est-ce que Medusa ?](#medusa)
- [2. Objectif de la migration](#objectif)
- [3. Architecture locale en un coup d'œil](#architecture-locale)
- [4. Comprendre les principales commandes Docker Compose](#commandes-compose)
- [5. Storefront `server-dev`](#server-dev)
- [6. Medusa](#service-medusa)
- [7. PostgreSQL](#postgresql)
- [8. Stripe Checkout en local](#stripe-local)
- [9. Tests de non-régression](#tests)
- [10. Logs et diagnostics rapides](#logs)
- [11. `server-prod`](#server-prod)
- [12. Commandes destructives / données](#commandes-dangereuses)
- [13. Résumé des règles à retenir](#regles)
- [14. Pour aller plus loin](#details)

---

<a id="suivi-des-modifications"></a>

## Suivi des modifications

| Version | Date de publication | Modification | Chapitre / paragraphe concerné |
|---|---|---|---|
| v1 | 09/10/2026 | Première version suivie : mise à jour de la référence Playwright à 35 scénarios déclarés, ajout de l’inventaire actuel des tests, ajout des identifiants de test et mise à jour des références vers la documentation Infrastructure actuelle. | `Utilisation quotidienne — Lancer les tests`, `Identifiant de test`, `Documents du projet et localisation`, `Tests de non-régression`, références Infrastructure |

---

> **Schémas :** les images du README sont stockées dans `./docs/images/architecture/`.

<a id="utilisation-quotidienne"></a>

## Utilisation quotidienne — à lire en premier

Cette section rassemble uniquement ce qu'il faut pour reprendre le projet, travailler, tester et l'arrêter sans devoir relire toute la documentation.

### 1. Démarrer l'environnement de travail

Depuis la **racine du projet**, dans le dossier qui contient `compose.yaml` :

Si les conteneurs existent déjà et ont simplement été arrêtés avec `stop` :

```powershell
docker compose start postgres medusa server-dev
```

Sinon :

```powershell
docker compose up -d postgres medusa server-dev
```

Vérifier l'état :

```powershell
docker compose ps
```

Accès utiles :

```text
Storefront :     http://localhost:5000
Medusa :         http://localhost:9000
Medusa health :  http://localhost:9000/health
```

### 2. Si le backend Medusa a été modifié

Le code backend Medusa n'est pas monté directement dans son conteneur. Après une modification qui doit être chargée dans l'image :

```powershell
docker compose up -d --build medusa
```

Puis vérifier :

```text
http://localhost:9000/health
```

### 3. Si le storefront / serveur Express a été modifié

Pour un changement qui nécessite explicitement de recharger le service :

```powershell
docker compose restart server-dev
```

Si la modification affecte l'image elle-même — `Dockerfile`, dépendance construite, version Node, etc. :

```powershell
docker compose up -d --build server-dev
```

### 4. Tester un paiement Stripe en local

Dans un terminal séparé :

```powershell
stripe listen --forward-to http://127.0.0.1:5000/stripe-checkout/webhook
```

Laisser Stripe CLI actif pendant tout le paiement de test.

Un événement reçu correctement ressemble notamment à :

```text
checkout.session.completed
<-- [200] POST http://127.0.0.1:5000/stripe-checkout/webhook
```

### 5. Lancer les tests

Suite Playwright complète :

```powershell
node .\node_modules\playwright\cli.js test
```

Tests ciblés :

```powershell
node .\node_modules\playwright\cli.js test f04-product-cart
node .\node_modules\playwright\cli.js test f05-checkout
node .\node_modules\playwright\cli.js test f06-payment-order
```

Baseline actuellement validée :

```text
35 scénarios Playwright déclarés
Wishlist activée : 34 réussis, 1 ignoré
Wishlist désactivée : les deux scénarios F-17 conditionnels inversent leur statut
```

Le scénario ignoré est attendu : un seul des deux scénarios F-17 (`wishlist` ON ou OFF) s’exécute selon la valeur du feature flag.

Test unitaire du webhook Stripe, depuis `medusa\apps\backend` :

```powershell
$env:TEST_TYPE = 'unit'
$env:NODE_OPTIONS = '--experimental-vm-modules'

node ..\..\node_modules\jest\bin\jest.js --config jest.config.js --silent --runInBand --forceExit --runTestsByPath src/__tests__/stripe-checkout-billing.unit.spec.ts
```

### 6. Arrêter le projet en fin de session

```powershell
docker compose stop server-dev medusa postgres
```

`stop` conserve les conteneurs. La session suivante peut donc reprendre avec `start`.

> ⚠️ Ne pas utiliser `docker compose down -v` par habitude : `-v` supprime aussi les volumes et peut donc effacer la base PostgreSQL locale.


<a id="arbre-decision-rapide"></a>

### 7. Arbre de décision rapide

```text
Je reprends le projet
│
├── les conteneurs existent et ont seulement été arrêtés
│   └── docker compose start postgres medusa server-dev
│
├── les conteneurs n'existent plus / un down a été fait
│   └── docker compose up -d postgres medusa server-dev
│
├── j'ai modifié le backend Medusa chargé dans l'image
│   └── docker compose up -d --build medusa
│
├── j'ai modifié le Dockerfile / Node / une dépendance construite de server-dev
│   └── docker compose up -d --build server-dev
│
└── je soupçonne un problème de cache de construction
    └── docker compose build --no-cache <service>
        puis docker compose up -d <service>
```

---

<a id="identifiant-de-test"></a>

## Identifiant de test

Ces identifiants sont réservés aux tests locaux du projet :

```text
Login : user2@user.fr
Mot de passe : user256000
```

> ⚠️ Ne jamais remplacer ces identifiants de test par de véritables identifiants personnels, mots de passe, clés API ou secrets.

---

<a id="documents-du-projet"></a>

## Documents du projet et localisation

Les documents permanents du projet doivent être retrouvables depuis cette section.

| Document / fichier | Localisation dans le projet | Rôle |
|---|---|---|
| `README.md` | **racine du projet** | utilisation quotidienne, commandes, tests, rappels pédagogiques |
| `AGENTS.md` | **racine du projet** | règles opérationnelles permanentes données à Codex |
| `compose.yaml` | **racine du projet** | définition des services Docker Compose |
| `.env` | **racine locale uniquement — non commité** | secrets et variables d'environnement locales |
| `docs/CARTOGRAPHIE_FONCTIONNELLE.md` | dossier `docs/` | fonctionnement métier, fiches F-01 à F-19 et cible fonctionnelle |
| `docs/CODEX_PROJECT_BOOTSTRAP_v1.0.md` | dossier `docs/` | méthode générique de reprise / bootstrap d'un projet avec Codex |
| `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md` | dossier `docs/` | architecture détaillée, socle modulaire, évolution multi-vendeur, production, Docker/Compose, Stripe, stockage, fournisseurs et coûts |
| `docs/images/architecture/` | dossier `docs/` | schémas utilisés par le README et la documentation Infrastructure |

### Quelle documentation consulter ?

```text
Je veux travailler aujourd'hui
→ README.md

Je veux connaître les règles de Codex
→ AGENTS.md

Je veux comprendre une fonction F-xx
→ docs/CARTOGRAPHIE_FONCTIONNELLE.md

Je veux comprendre l'architecture ou un choix technique en détail
→ docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md

Je veux réutiliser notre méthode sur un autre projet
→ docs/CODEX_PROJECT_BOOTSTRAP_v1.0.md
```

> **Convention documentaire du projet : tout document permanent doit comporter une table des matières.**

---

<a id="medusa"></a>

## 1. Qu'est-ce que Medusa ?

**Medusa est le moteur e-commerce headless de la boutique.**

Le storefront reste le site visible par le client. Medusa prend progressivement en charge la logique e-commerce : produits, variantes, prix, stock, Cart, clients, commandes, promotions, paiements et retours.

![Qu'est-ce que Medusa et quel était notre objectif ?](./docs/images/architecture/01-medusa-overview.png)

Medusa n'est donc pas une nouvelle interface graphique à la place de notre boutique : il devient le **moteur métier** auquel le storefront se connecte.

> 📚 **Plus de détails :** `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md`, sections *Rôle des composants* et *Architecture locale / production*.

---

<a id="objectif"></a>

## 2. Objectif de la migration

Le projet part d'une boutique front déjà réalisée.

L'objectif retenu est de :

1. conserver le storefront existant ;
2. faire de **Medusa le moteur e-commerce** ;
3. utiliser **PostgreSQL** comme stockage durable des données e-commerce ;
4. utiliser les API Medusa pour le catalogue, les variantes, le stock, le Cart, le checkout et l'Order ;
5. utiliser Stripe en environnement de test avec un vrai parcours Stripe Checkout ;
6. supprimer progressivement Firestore et la manipulation directe d'AWS S3 ;
7. obtenir un démonstrateur qui se comporte comme une vraie boutique e-commerce.


### Deux contraintes à préserver pour la suite

La version opérationnelle actuelle reste **mono-marchand**, mais l'architecture ne doit pas nous enfermer dans ce modèle :

- le socle doit pouvoir évoluer plus tard vers une option **multi-vendeur limitée à 2 ou 3 vendeurs**, sans reconstruire le cœur e-commerce ;
- le futur socle MVDW doit être **configurable par modules/options** : un noyau obligatoire, des modules optionnels et des providers remplaçables.

Ces capacités ne sont pas toutes à implémenter maintenant. Elles servent de contraintes d'architecture pour éviter de rendre la migration actuelle difficile à faire évoluer.

La migration ne consiste donc pas à remplacer :

```text
requête Firestore
→ requête PostgreSQL équivalente
```

mais à déplacer progressivement la responsabilité métier vers Medusa :

```text
Storefront
    │
    ▼
Medusa
    │
    ▼
PostgreSQL
```

> 📚 **Plus de détails :** `docs/CARTOGRAPHIE_FONCTIONNELLE.md` pour les fonctions F-01 à F-19 et `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md` pour les décisions d'architecture.

---

<a id="architecture-locale"></a>

## 3. Architecture locale en un coup d'œil

![Architecture locale du projet](./docs/images/architecture/02-local-architecture.png)

Le projet utilise Docker Desktop, qui fournit notamment :

- **Docker Engine** : construit les images, exécute les conteneurs et gère volumes/réseaux ;
- **Docker CLI** : reçoit les commandes `docker ...` ;
- **Docker Compose** : lit `compose.yaml` et orchestre les services.

`compose.yaml` est le **fichier de configuration** lu par Docker Compose.

### Services principaux

| Service Compose | Rôle | Accès local |
|---|---|---|
| `server-dev` | storefront / serveur Express de développement | `http://localhost:5000` |
| `server-prod` | même storefront en mode production locale | `http://localhost:5001` |
| `postgres` | PostgreSQL local | port `5432` |
| `medusa` | moteur e-commerce / Store API / Admin | `http://localhost:9000` |

Redis viendra plus tard si l'architecture en a réellement besoin.

### Service, image et conteneur

Un **service Compose** est une fiche de configuration.

Une **image** est l'environnement préparé.

Un **conteneur** est une instance réellement exécutée à partir d'une image.

![Du Dockerfile au conteneur](./docs/images/architecture/03-docker-build-flow.png)

> 📚 **Plus de détails :** `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md`, section *Architecture locale Docker / Docker Compose*. On y retrouve `build:`, `image:`, `target`, ports, volumes, noms d'images/conteneurs et différence local / production.

---

<a id="commandes-compose"></a>

## 4. Comprendre les principales commandes Docker Compose

Toutes les commandes ci-dessous se lancent depuis la **racine du projet**.

### `start`

```powershell
docker compose start postgres medusa server-dev
```

Utilise les conteneurs qui existent déjà.

Il ne reconstruit pas les images et ne recrée pas des conteneurs supprimés.

### `up -d`

```powershell
docker compose up -d postgres medusa server-dev
```

Demande à Docker Compose de créer/recréer ce qui est nécessaire puis de démarrer les services ciblés.

`-d` signifie *detached* : les conteneurs restent en arrière-plan.

### `--build`

```powershell
docker compose up -d --build medusa
```

Demande une reconstruction de l'image avant le démarrage.

À retenir :

```text
build: dans compose.yaml
→ explique COMMENT construire

--build dans le terminal
→ demande de reconstruire MAINTENANT
```

### `restart`

```powershell
docker compose restart server-dev
```

Redémarre un conteneur existant sans reconstruire son image.

### `stop`

```powershell
docker compose stop server-dev medusa postgres
```

Arrête les conteneurs mais les conserve.

### `down`

```powershell
docker compose down
```

Supprime les conteneurs et le réseau Compose. Après cela, `start` ne suffit plus.

> 📚 **Plus de détails :** `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md`.

---

<a id="server-dev"></a>

## 5. Storefront `server-dev`

### Créer / démarrer

```powershell
docker compose up -d server-dev
```

### Reprendre après un simple `stop`

```powershell
docker compose start server-dev
```

### Redémarrer

```powershell
docker compose restart server-dev
```

### Reconstruire

```powershell
docker compose up -d --build server-dev
```

### Logs

```powershell
docker compose logs -f server-dev
```

Quitter les logs avec `Ctrl + C` n'arrête pas le service.

### Vérifier Node dans le conteneur

```powershell
docker compose exec server-dev node -v
```

### Ouvrir un shell

```powershell
docker compose exec server-dev sh
```

Quitter :

```text
exit
```

---

<a id="service-medusa"></a>

## 6. Medusa

Accès local :

```text
http://localhost:9000
```

Healthcheck :

```text
http://localhost:9000/health
```

### Démarrer

```powershell
docker compose up -d medusa
```

### Reprendre

```powershell
docker compose start medusa
```

### Arrêter

```powershell
docker compose stop medusa
```

### Logs

```powershell
docker compose logs -f medusa
```

### Après une modification du backend Medusa

Le backend Medusa n'est pas monté en bind mount dans son conteneur.

Il faut donc reconstruire/recréer le service :

```powershell
docker compose up -d --build medusa
```

Puis vérifier `/health` avant un test fonctionnel.

### Relation avec PostgreSQL

```text
Medusa
  │
  │ DATABASE_URL
  ▼
PostgreSQL
  │
  └── base "medusa"
      └── tables e-commerce
```

> 📚 **Plus de détails :** `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md`, notamment le rôle du serveur Medusa, du Worker, de PostgreSQL et de Redis.

---

<a id="postgresql"></a>

## 7. PostgreSQL

L'environnement local utilise l'image :

```text
postgres:15-alpine
```

Les données sont conservées dans le volume nommé `postgres-data`.

### Démarrer

```powershell
docker compose up -d postgres
```

### Reprendre

```powershell
docker compose start postgres
```

### Arrêter

```powershell
docker compose stop postgres
```

### Logs

```powershell
docker compose logs -f postgres
```

### Ouvrir `psql`

```powershell
docker compose exec postgres psql -U medusa -d medusa
```

Commandes utiles dans `psql` :

```text
\conninfo
\dt
\q
```

### Afficher les volumes

```powershell
docker volume ls
```

> ⚠️ `postgres-data` contient les données locales. Ne pas le supprimer par habitude.

> 📚 **Plus de détails :** `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md`, sections sur les stockages, PostgreSQL, sauvegardes et architecture de production.

---

<a id="stripe-local"></a>

## 8. Stripe Checkout en local

Le parcours actif utilise **Stripe Checkout hébergé**.

![Flux Stripe Checkout, webhook et Order Medusa](./docs/images/architecture/04-stripe-payment-flow.png)

### Deux chemins après le paiement

```text
                        ┌──► navigateur ──► /stripe-checkout/return
                        │
Stripe ─ paiement OK ───┤
                        │
                        └──► webhook ──► Medusa ──► Order
```

La page de retour améliore l'expérience utilisateur.

Le **webhook reste la source de vérité du paiement** : le navigateur peut être lent, fermé ou déconnecté sans devenir nécessaire à la création de l'Order.

### Variables concernées

Noms utilisés notamment :

- `MEDUSA_BACKEND_URL`
- `MEDUSA_PUBLISHABLE_API_KEY`
- `stripe_key`
- `STOREFRONT_URL`
- `STRIPE_WEBHOOK_SECRET`

Leurs valeurs restent dans `.env`.

### Stripe CLI

```powershell
stripe listen --forward-to http://127.0.0.1:5000/stripe-checkout/webhook
```

Stripe CLI doit rester actif pendant les paiements réels en mode test.

### Retour navigateur

`/stripe-checkout/return` effectue un polling pour attendre l'Order finalisée côté serveur.

Le projet ne conserve plus le délai artificiel de 5 secondes :

```text
aucun délai configuré
→ delay: 0
```

Un délai explicitement configuré reste respecté.

Carte bancaire et Link utilisent le même Checkout hébergé.

> 📚 **Plus de détails :** `docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md`, section *Paiement Stripe, webhook et création d'Order Medusa* : Payment Provider, événements, signature `whsec_...`, paiement synchrone/asynchrone, idempotence et différence local / production.

---

<a id="tests"></a>

## 9. Tests de non-régression

Baseline actuelle :

```text
35 scénarios Playwright déclarés
Wishlist activée : 34 réussis, 1 ignoré
Wishlist désactivée : les deux scénarios F-17 conditionnels inversent leur statut
```

Le scénario ignoré est attendu : la suite contient un scénario F-17 pour la Wishlist activée et un autre pour la Wishlist désactivée.

### Suite complète

```powershell
node .\node_modules\playwright\cli.js test
```

### Ciblés

```powershell
node .\node_modules\playwright\cli.js test f04-product-cart
node .\node_modules\playwright\cli.js test f05-checkout
node .\node_modules\playwright\cli.js test f06-payment-order
node .\node_modules\playwright\cli.js test f17-wishlist
node .\node_modules\playwright\cli.js test f18-cart-update
node .\node_modules\playwright\cli.js test f19-images
```

### Inventaire actuel

| Fichier / périmètre | Scénarios | Couverture principale |
|---|---:|---|
| F-01 / F-02 / F-03 | 1 | inscription, déconnexion, reconnexion, persistance du Cart et bascule Standard ↔ Express sans cumul |
| F-04 | 5 | fiche produit Medusa, variante, ajout Cart, libellés Couleur, indisponibilités et galeries |
| F-05 Checkout | 3 | formulaire, reset Checkout, livraison, quantités, totaux, refresh, retour et BFCache |
| F-06 Stripe / Order | 4 | retours Stripe carte/Link, retour non confirmé et attente d’une Order finalisée |
| F-07 à F-14 | 8 | un scénario de non-régression par fonctionnalité |
| F-15 Recherche | 3 | recherche par clic/Entrée, aucun résultat et erreur |
| F-16 Recommandations | 6 | sélection catégorielle, carrousel, limites, vide/erreur et ON/OFF |
| F-17 Wishlist | 2 | persistance Customer/Product et scénario ON/OFF conditionnel |
| F-18 Panier | 1 | modification et suppression d’une ligne du Cart |
| F-19 Images | 1 | retrait puis remplacement d’une image produit |
| Smoke | 1 | disponibilité de la page d’accueil |
| **Total** | **35** | **34 exécutés et réussis + 1 ignoré avec Wishlist activée** |

F-05 protège notamment :

- reset du Checkout à chaque nouvelle entrée ;
- formulaire vide après entrée, refresh, retour ou restauration BFCache ;
- aucune méthode de livraison active après reset ;
- remplacement Standard ↔ Express sans cumul ;
- conservation des lignes produit du Cart pendant le reset ;
- `Delivery = 0` lorsqu'aucune livraison n'est sélectionnée ;
- quantités `+` / `-` et résumé synchronisé ;
- cohérence des sous-totaux et totaux Medusa ;
- récupération après erreur API ;
- abandon / retour Stripe sans perdre le Cart.

F-06 protège notamment :

- retour Stripe carte ;
- retour Stripe Link ;
- retour non confirmé conservant le Cart ;
- polling jusqu'à une Order finalisée par le webhook ;
- priorité donnée à la finalisation d’un paiement réussi avant tout reset Checkout.

### Test unitaire du webhook Stripe

Depuis `medusa\apps\backend` :

```powershell
$env:TEST_TYPE = 'unit'
$env:NODE_OPTIONS = '--experimental-vm-modules'

node ..\..\node_modules\jest\bin\jest.js --config jest.config.js --silent --runInBand --forceExit --runTestsByPath src/__tests__/stripe-checkout-billing.unit.spec.ts
```

### Vérifier le diff

```powershell
git diff --check
```

Les avertissements `LF will be replaced by CRLF` ne constituent pas, à eux seuls, un échec de `git diff --check`.

---

<a id="logs"></a>

## 10. Logs et diagnostics rapides

État :

```powershell
docker compose ps
```

Inclure les services arrêtés :

```powershell
docker compose ps -a
```

Logs combinés :

```powershell
docker compose logs -f server-dev medusa postgres
```

Valider la configuration Compose sans imprimer les variables résolues :

```powershell
docker compose config --quiet
```

---

<a id="server-prod"></a>

## 11. `server-prod`

Production locale :

```powershell
docker compose up -d server-prod
```

Accès :

```text
http://localhost:5001
```

Reconstruire :

```powershell
docker compose up -d --build server-prod
```

Arrêter :

```powershell
docker compose stop server-prod
```

En développement courant, `server-prod` n'a généralement pas besoin de tourner en même temps que `server-dev`.

---

<a id="commandes-dangereuses"></a>

## 12. Commandes destructives / données

### `down`

```powershell
docker compose down
```

Supprime les conteneurs et le réseau Compose mais conserve normalement les volumes nommés.

### `down -v`

```powershell
docker compose down -v
```

ou :

```powershell
docker compose down --volumes
```

supprime également les volumes.

Pour PostgreSQL :

```text
suppression de postgres-data
→ suppression potentielle de la base locale
```

> ⚠️ Utiliser `-v` uniquement lorsqu'on veut réellement effacer les données locales.

---

<a id="regles"></a>

## 13. Résumé des règles à retenir

```text
STOP
→ START

DOWN
→ UP

Dockerfile / dépendance construite / backend Medusa dans l'image
→ UP --BUILD

DOWN -v
→ supprime aussi les volumes
→ ATTENTION aux données
```

Architecture :

```text
Storefront
→ interface client

Medusa
→ logique e-commerce

PostgreSQL
→ données durables

Stripe
→ paiement

Webhook
→ confirmation serveur fiable
```

---

<a id="details"></a>

## 14. Pour aller plus loin

Le README doit rester rapide à utiliser.

Pour les explications de référence, consulter :

```text
docs/INFRASTRUCTURE_MEDUSA_STOREFRONT_v8.md
```

Ce document détaille notamment :

- architecture Medusa / storefront ;
- Docker Engine, Docker CLI, Docker Compose, images, conteneurs, volumes et réseaux ;
- infrastructure de production ;
- Worker Medusa et Redis ;
- PostgreSQL, sauvegardes et PITR ;
- Cloudflare R2 et alternatives de stockage ;
- Render ;
- Stripe Checkout, webhook, Payment Provider et Order Medusa ;
- différence développement local / production ;
- email transactionnel / marketing ;
- monitoring ;
- portabilité et archivage ;
- fournisseurs, coûts et alternatives ;
- principes du futur socle MVDW configurable par modules/options ;
- contraintes d'évolution vers une option multi-vendeur limitée à quelques vendeurs.
