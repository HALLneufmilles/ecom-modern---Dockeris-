login: user2@user.fr

mdp: user256000

first release

nom github : ecom-moderne-dockerise

> ⚠️ **Sécurité** : les identifiants indiqués dans ce README doivent être des identifiants de test uniquement. Ne jamais y placer de véritables mots de passe, clés API ou secrets. Les secrets techniques du projet doivent rester dans `.env`, qui ne doit pas être commité dans Git.

# Docker Desktop / Docker Compose — explications et commandes utiles pour le projet E-commerce

Les commandes de ce document doivent être exécutées depuis la racine du projet, dans le dossier qui contient `compose.yaml`.

Le projet contient actuellement trois **services Docker Compose** :

- `server-dev` : boutique actuelle en environnement de développement, accessible sur `http://localhost:5000`
- `server-prod` : même boutique en environnement de production local, accessible sur `http://localhost:5001`
- `postgres` : PostgreSQL local destiné à Medusa, exposé sur le port `5432`

Medusa et Redis seront ajoutés plus tard comme services supplémentaires.

> 💡 Pour le travail courant, on cible en priorité les services dont on a réellement besoin.
> Éviter `docker compose up -d` sans nom de service si l'on ne veut pas démarrer tout ce qui est défini dans `compose.yaml`.

---

## Table des matières

- [0. Comprendre l'architecture avant d'utiliser les commandes](#section-0)
- [1. Quelle commande choisir ?](#section-1)
- [2. Arbre de décision rapide](#section-2)
- [3. Démarrer `server-dev`](#section-3)
- [4. Arrêter et redémarrer `server-dev`](#section-4)
- [5. PostgreSQL local](#section-5)
- [6. Vérifier l'état du projet](#section-6)
- [7. Consulter les logs de l'application](#section-7)
- [8. Travailler à l'intérieur du conteneur `server-dev`](#section-8)
- [9. Service `server-prod`](#section-9)
- [10. Commandes concernant plusieurs services](#section-10)
- [11. Arrêt et suppression](#section-11)
- [12. Volumes](#section-12)
- [13. Résumé quotidien](#section-13)
- [14. Règles simples à retenir](#section-14)
- [15. Schéma récapitulatif](#section-15)

---

<a id="section-0"></a>

# 0. Comprendre l'architecture avant d'utiliser les commandes

Cette partie explique dans quel ordre les différents éléments interviennent : **Docker Desktop → Docker CLI → Docker Compose → `compose.yaml` → service → image → conteneur → volume/réseau**.

## 0.1 Ce qui a été installé avec Docker Desktop

On n'a pas installé Docker Compose séparément : **Docker Desktop l'inclut**.

Pour ce projet, les trois composants à distinguer sont :

```text
Docker Desktop
│
├── Docker Engine
│   ├── construit les images
│   ├── crée et exécute les conteneurs
│   ├── gère les volumes
│   └── gère les réseaux
│
├── Docker CLI
│   └── reçoit les commandes tapées dans le terminal :
│       docker ...
│
└── Docker Compose
    ├── lit compose.yaml
    ├── comprend les services qui y sont décrits
    └── orchestre leur création, leur démarrage, leur arrêt, etc.
```

On peut vérifier que Docker Compose est disponible avec :

```powershell
docker compose version
```

### Important

`compose.yaml` **n'est pas Docker Compose**.

- **Docker Compose** = le programme qui orchestre les services.
- **`compose.yaml`** = le fichier de configuration lu par Docker Compose.

---

## 0.2 À quoi sert `compose.yaml` ?

`compose.yaml` décrit l'architecture locale de l'application.

Sa structure principale ressemble actuellement à ceci :

```yaml
services:
  server-dev:
    ...

  server-prod:
    ...

  postgres:
    ...

volumes:
  postgres-data:
```

Chaque nom placé directement sous `services:` est le nom d'un **service Compose**.

Dans notre projet :

```text
services
│
├── server-dev
├── server-prod
└── postgres
```

---

## 0.3 Qu'est-ce qu'un service Compose ?

Un **service Compose** est une fiche de configuration dans `compose.yaml`.

Cette fiche indique à Docker Compose comment un élément de l'application doit être préparé et exécuté.

Elle peut notamment préciser :

```text
SERVICE COMPOSE
│
├── comment obtenir ou construire l'image ?
├── quel Dockerfile utiliser ?
├── quels ports utiliser ?
├── quelles variables d'environnement fournir ?
├── quels volumes monter ?
├── quel réseau utiliser ?
├── de quels autres services dépendre ?
├── quelle commande lancer ?
└── comment vérifier que le service est healthy ?
```

Le service **n'est pas encore le conteneur**.

Il décrit ce que Docker Compose doit demander à Docker Engine de créer et d'exécuter.

---

## 0.4 Image et conteneur : la différence

Pour garder une représentation simple :

```text
IMAGE
= le type de machine / environnement prêt à servir
        │
        ▼
CONTENEUR
= une instance réellement créée et exécutée à partir de cette image
```

Une même image peut servir à créer plusieurs conteneurs.

Exemple pour PostgreSQL :

```text
image
postgres:15-alpine
        │
        ▼
conteneur
ecom-modern-postgres
```

---

## 0.5 À quoi sert le `Dockerfile` ?

Le `Dockerfile` est la **recette de construction d'une image**.

Il contient des instructions comme :

```text
FROM
WORKDIR
COPY
RUN
ENV
CMD
...
```

Pour la boutique actuelle :

```text
Dockerfile
    │
    │ recette de construction
    ▼
image de la boutique
    │
    ▼
conteneur de la boutique
```

Le `Dockerfile` ne contient donc pas l'image : il contient **les instructions permettant à Docker Engine de la construire**.

---

## 0.6 Quel est le lien entre `build:` dans `compose.yaml` et le `Dockerfile` ?

Le service `server-dev` contient notamment :

```yaml
server-dev:
  build:
    context: .
    target: dev
```

La partie :

```yaml
build:
  context: .
```

indique à Docker Compose qu'une image doit pouvoir être **construite à partir du dossier courant**.

Le point :

```text
.
```

signifie :

```text
le dossier du projet où se trouve compose.yaml
```

Comme aucun autre nom de fichier n'est indiqué, la construction utilise par défaut le fichier :

```text
Dockerfile
```

situé dans ce contexte.

On pourrait rendre ce lien explicite avec :

```yaml
server-dev:
  build:
    context: .
    dockerfile: Dockerfile
    target: dev
```

Dans notre configuration, `dockerfile: Dockerfile` n'est pas nécessaire car `Dockerfile` est le nom par défaut.

Le chemin logique est donc :

```text
compose.yaml
│
└── service server-dev
    │
    └── build:
        │
        └── context: .
            │
            ▼
        Dockerfile
            │
            ▼
        Docker Engine construit l'image
```

---

## 0.7 À quoi sert `target: dev` ou `target: prod` ?

Notre `Dockerfile` contient plusieurs étapes de construction.

Dans `compose.yaml` :

```yaml
server-dev:
  build:
    context: .
    target: dev
```

signifie que `server-dev` utilise la cible `dev`.

Et :

```yaml
server-prod:
  build:
    context: .
    target: prod
```

signifie que `server-prod` utilise la cible `prod`.

On utilise donc le **même `Dockerfile`**, mais pas la même cible :

```text
                    Dockerfile
                       │
              ┌────────┴────────┐
              ▼                 ▼
          target dev        target prod
              │                 │
              ▼                 ▼
     image server-dev   image server-prod
```

`server-dev` et `server-prod` ne sont donc pas deux boutiques différentes : ce sont deux manières de construire/lancer **la même application**.

---

## 0.8 Différence entre `build:` et `--build`

Il ne faut pas confondre les deux.

### `build:` dans `compose.yaml`

```yaml
build:
```

fait partie de la fiche du service.

Il indique **comment l'image de ce service peut être construite**.

### `--build` dans le terminal

```powershell
docker compose up -d --build server-dev
```

demande à Docker Compose :

```text
avant de démarrer server-dev,
demande à Docker Engine de reconstruire son image
```

Donc :

```text
build:                     --build
dans compose.yaml          dans la commande
      │                         │
      ▼                         ▼
"voici comment             "reconstruis l'image
 construire l'image"        avant le démarrage"
```

Décomposition de :

```powershell
docker compose up -d --build server-dev
```

```text
docker
└── commande reçue par Docker CLI

compose
└── utilise Docker Compose

up
└── crée/recrée et démarre ce qui est nécessaire

-d
└── exécute en arrière-plan

--build
└── demande la reconstruction de l'image avant le démarrage

server-dev
└── nom du service Compose ciblé
```

---

## 0.9 À quoi sert `image:` ?

`image:` indique **quelle image doit être utilisée par le service**.

Il y a plusieurs cas.

### Cas A — `image:` sans `build:` : image déjà disponible ou téléchargeable

PostgreSQL est déclaré ainsi :

```yaml
postgres:
  image: postgres:15-alpine
```

Il n'y a pas de `build:` pour ce service.

Docker Compose demande donc à Docker Engine d'utiliser :

```text
postgres:15-alpine
```

Si cette image n'est pas présente localement, elle est téléchargée depuis le registre configuré.

C'est ce que nous avons observé :

```text
Image postgres:15-alpine Pulled
```

`Pulled` = image téléchargée.

### Cas B — `build:` sans `image:` : image construite et nommée automatiquement

`server-dev` contient actuellement :

```yaml
server-dev:
  build:
    context: .
    target: dev
```

mais aucune ligne :

```yaml
image:
```

Docker Compose peut donc attribuer automatiquement un nom à l'image construite.

Dans notre projet, on obtient notamment :

```text
ecom-modern-dockerise-server-dev:latest
```

### Cas C — `build:` + `image:` : construction + nom explicite

On pourrait parfaitement écrire :

```yaml
server-dev:
  build:
    context: .
    target: dev
  image: ma-boutique-dev:latest
```

Même si `ma-boutique-dev:latest` n'existe pas encore avant la première construction.

Ici :

```text
build:
= comment construire l'image

image:
= sous quel nom/tag référencer cette image
```

Donc `server-dev` et `server-prod` pourraient avoir une ligne `image:` si l'on voulait choisir nous-mêmes leurs noms.

---

## 0.10 Que signifie `postgres:15-alpine` ?

```text
postgres:15-alpine
    │      │
    │      └── variante basée sur Alpine Linux
    │
    └── PostgreSQL version 15
```

**Alpine Linux n'est pas un dossier de notre projet.**

C'est un système d'exploitation Linux minimal qui sert de fondation à cette variante de l'image PostgreSQL.

L'image `postgres:15-alpine` contient déjà ce qu'il faut pour exécuter PostgreSQL, notamment :

- un environnement Linux minimal basé sur Alpine Linux ;
- PostgreSQL 15 ;
- les scripts nécessaires à l'initialisation et au démarrage de PostgreSQL.

C'est pour cette raison que nous n'avons pas modifié notre `Dockerfile` pour installer PostgreSQL.

Comparaison :

```text
BOUTIQUE

compose.yaml
    │
    └── build:
        │
        ▼
    Dockerfile
        │
        ▼
    Docker Engine construit l'image
        │
        ▼
    conteneur server-dev


POSTGRESQL

compose.yaml
    │
    └── image: postgres:15-alpine
        │
        ▼
    image téléchargée si nécessaire
        │
        ▼
    conteneur ecom-modern-postgres
```

---

## 0.11 Qui définit les noms que l'on voit dans Docker Desktop ?

Il faut distinguer **quatre noms** :

1. nom du projet Compose / groupe affiché dans Docker Desktop ;
2. nom du service Compose ;
3. nom de l'image ;
4. nom du conteneur.

### Résumé pour notre projet

| Élément | Exemple | Qui le définit ? |
|---|---|---|
| Projet Compose / groupe | `ecom-modern-dockerise` | Docker Compose, par défaut à partir du nom du dossier du projet |
| Service | `server-dev` | Nous, dans `compose.yaml` sous `services:` |
| Image de `server-dev` | `ecom-modern-dockerise-server-dev:latest` | Nom généré automatiquement car le service possède `build:` mais pas `image:` |
| Conteneur de `server-dev` | affiché comme `server-dev-1` dans le groupe Compose | Nom généré automatiquement car aucun `container_name:` n'est imposé |
| Service PostgreSQL | `postgres` | Nous, dans `compose.yaml` |
| Image PostgreSQL | `postgres:15-alpine` | Nous, avec `image:` |
| Conteneur PostgreSQL | `ecom-modern-postgres` | Nous, avec `container_name:` |

### Chaîne de `server-dev`

```text
dossier du projet
ecom-modern-dockerise
        │
        ▼
projet Compose / groupe
ecom-modern-dockerise
        │
        ▼
service Compose
server-dev
        │
        ├── build:
        │
        ▼
Dockerfile
        │
        ▼
image construite
ecom-modern-dockerise-server-dev:latest
        │
        ▼
conteneur
server-dev-1
```

### Chaîne de PostgreSQL

```text
projet Compose / groupe
ecom-modern-dockerise
        │
        ▼
service Compose
postgres
        │
        ├── image: postgres:15-alpine
        │
        ▼
image existante/téléchargée
postgres:15-alpine
        │
        ├── container_name: ecom-modern-postgres
        │
        ▼
conteneur
ecom-modern-postgres
```

---

## 0.12 Pourquoi Docker Desktop affiche-t-il un groupe `ecom-modern-dockerise` ?

Dans l'onglet **Containers**, Docker Desktop regroupe les conteneurs appartenant au même projet Compose.

On peut donc voir :

```text
ecom-modern-dockerise
│
├── server-dev-1
└── ecom-modern-postgres
```

La ligne :

```text
ecom-modern-dockerise
```

n'est pas un conteneur.

C'est le **projet/groupe Compose**.

Il faut le déplier pour voir les conteneurs qu'il contient.

Plus tard, le groupe pourra contenir :

```text
ecom-modern-dockerise
│
├── server-dev-1
├── ecom-modern-postgres
├── futur conteneur Medusa
└── futur conteneur Redis
```

---

## 0.13 À quoi correspondent les anciennes images et les images `<none>` ?

Dans Docker Desktop, l'onglet **Images** peut contenir d'anciennes images du projet.

Par exemple :

```text
ecom-modern-dockeris-server:latest
```

est très probablement une ancienne image construite avec une ancienne configuration du projet, à une époque où le projet/service portait d'autres noms.

Elle ne correspond pas à la configuration actuelle :

```text
ecom-modern-dockerise-server-dev
ecom-modern-dockerise-server-prod
postgres:15-alpine
```

### Images `<none>:<none>`

Après plusieurs reconstructions, une ancienne image peut perdre son nom/tag lorsqu'une nouvelle image récupère le tag `latest`.

Exemple :

```text
avant reconstruction

ecom-modern-dockerise-server-dev:latest
        │
        ▼
ancienne image A
```

Après une nouvelle construction :

```text
ecom-modern-dockerise-server-dev:latest
        │
        ▼
nouvelle image B
```

L'ancienne image A peut alors apparaître comme :

```text
<none>:<none>
```

Ces images peuvent provenir d'anciennes constructions et seront nettoyées plus tard avec précaution.

---

## 0.14 À quoi servent les ports ?

Exemple PostgreSQL :

```yaml
ports:
  - "5432:5432"
```

La convention est :

```text
PORT DU PC : PORT DU CONTENEUR
```

Donc :

```text
5432 du PC
    │
    ▼
5432 du conteneur PostgreSQL
```

Pour `server-dev` :

```yaml
ports:
  - 5000:5000
```

signifie :

```text
localhost:5000 sur le PC
        │
        ▼
port 5000 dans le conteneur server-dev
```

Les services peuvent également communiquer entre eux sur le réseau Compose sans obligatoirement exposer tous leurs ports vers le PC.

---

## 0.15 À quoi sert un volume ?

Un conteneur peut être supprimé et recréé.

Pour PostgreSQL, on ne veut pas que les données disparaissent à chaque recréation du conteneur.

Le service contient donc :

```yaml
volumes:
  - postgres-data:/var/lib/postgresql/data
```

et le fichier déclare :

```yaml
volumes:
  postgres-data:
```

Le principe est :

```text
conteneur ecom-modern-postgres
        │
        ▼
volume postgres-data
        │
        ▼
données PostgreSQL persistantes
```

Le volume est géré par Docker Engine et n'est pas un dossier du dépôt Git.

Le nom réel généré par Compose est généralement :

```text
ecom-modern-dockerise_postgres-data
```

On peut afficher les volumes avec :

```powershell
docker volume ls
```

---

## 0.16 Pourquoi `docker compose down -v` devient dangereux avec PostgreSQL ?

```powershell
docker compose down
```

supprime les conteneurs et le réseau Compose, mais conserve normalement le volume nommé PostgreSQL.

En revanche :

```powershell
docker compose down -v
```

ou :

```powershell
docker compose down --volumes
```

supprime également les volumes du projet Compose.

Donc :

```text
docker compose down
→ conteneurs supprimés
→ volume PostgreSQL conservé

docker compose down -v
→ conteneurs supprimés
→ volume PostgreSQL supprimé
→ base locale potentiellement perdue
```

> ⚠️ Dès que PostgreSQL contient des données utiles, utiliser `-v` uniquement si l'on veut réellement effacer la base locale.

---

## 0.17 PostgreSQL, la base `medusa` et le futur logiciel Medusa

Dans `compose.yaml`, nous avons défini :

```yaml
POSTGRES_DB: medusa
POSTGRES_USER: medusa
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### Mot de passe PostgreSQL et fichier `.env`

Le mot de passe n'est volontairement **pas écrit directement dans `compose.yaml`**.

La notation :

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

demande à Docker Compose de remplacer `${POSTGRES_PASSWORD}` par la valeur disponible dans l'environnement du projet. Dans notre cas, elle est définie localement dans le fichier `.env` situé à la racine du projet.

Exemple de principe, sans mettre de vrai mot de passe dans ce README :

```dotenv
POSTGRES_PASSWORD=mot_de_passe_local
```

Le fichier `.env` est ignoré par Git grâce à `.gitignore` et **ne doit pas être commité**. Ainsi, `compose.yaml` peut être versionné sans publier le mot de passe PostgreSQL.

Le mot `medusa` désigne ici :

- une **base PostgreSQL** appelée `medusa` ;
- un **utilisateur PostgreSQL** appelé `medusa`.

Cela ne signifie pas que le logiciel Medusa est déjà installé.

La situation actuelle est :

```text
PostgreSQL
│
└── base "medusa"
    └── actuellement vide
```

Nous avons vérifié la connexion avec :

```powershell
docker compose exec postgres psql -U medusa -d medusa
```

Puis :

```text
\conninfo
```

a confirmé la connexion à la base `medusa`.

Et :

```text
\dt
```

a indiqué qu'aucune table n'existe encore, ce qui est normal avant l'installation de Medusa.

Pour quitter `psql` :

```text
\q
```

Plus tard :

```text
Medusa
   │
   │ DATABASE_URL
   ▼
PostgreSQL
   │
   └── base "medusa"
       ├── produits
       ├── variantes
       ├── clients
       ├── paniers
       ├── commandes
       └── autres tables gérées par Medusa
```

---

## 0.18 Architecture de développement visée

Actuellement :

```text
Docker Desktop
│
└── projet Compose : ecom-modern-dockerise
    │
    ├── server-dev
    │   └── boutique actuelle
    │
    └── postgres
        └── PostgreSQL
            └── volume postgres-data
```

Après installation de Medusa :

```text
Docker Desktop
│
└── projet Compose : ecom-modern-dockerise
    │
    ├── server-dev
    │   └── boutique actuelle
    │
    ├── medusa
    │   └── moteur e-commerce + Medusa Admin
    │
    └── postgres
        └── PostgreSQL
            └── volume postgres-data
```

Puis, avec Redis :

```text
Docker Desktop
│
└── projet Compose : ecom-modern-dockerise
    │
    ├── server-dev
    ├── medusa
    ├── postgres
    └── redis
```

Pendant le développement courant, `server-prod` n'a généralement pas besoin de tourner en même temps que `server-dev`.

---

## 0.19 Développement local et production

Le volume `postgres-data` sert au PostgreSQL **local de développement**.

Il ne sera pas automatiquement transféré en production.

Architecture envisagée en production :

```text
Storefront
    │
    ▼
Medusa
    │
    │ DATABASE_URL
    ▼
PostgreSQL géré en production
```

La base PostgreSQL de production sera donc séparée du volume local utilisé par Docker Desktop.

---

<a id="section-1"></a>

# 1. Quelle commande choisir ?

| Situation | Commande |
|---|---|
| Reprendre `server-dev` après un simple `stop` | `docker compose start server-dev` |
| Reprendre l'application + PostgreSQL après un simple `stop` | `docker compose start server-dev postgres` |
| Créer/démarrer `server-dev` si nécessaire | `docker compose up -d server-dev` |
| Créer/démarrer l'application + PostgreSQL si nécessaire | `docker compose up -d server-dev postgres` |
| Reconstruire l'image de `server-dev` puis démarrer | `docker compose up -d --build server-dev` |
| Reconstruire `server-dev` puis démarrer aussi PostgreSQL | `docker compose up -d --build server-dev postgres` |
| Forcer une reconstruction sans cache | `docker compose build --no-cache server-dev`, puis `docker compose up -d server-dev` |
| Redémarrer le conteneur `server-dev` existant | `docker compose restart server-dev` |
| Redémarrer l'application + PostgreSQL | `docker compose restart server-dev postgres` |
| Arrêter `server-dev` sans le supprimer | `docker compose stop server-dev` |
| Arrêter l'application + PostgreSQL sans supprimer les conteneurs | `docker compose stop server-dev postgres` |
| Créer/démarrer uniquement PostgreSQL | `docker compose up -d postgres` |
| Reprendre PostgreSQL après un simple `stop` | `docker compose start postgres` |
| Arrêter uniquement PostgreSQL | `docker compose stop postgres` |
| Redémarrer PostgreSQL | `docker compose restart postgres` |
| Voir les services en cours d'exécution | `docker compose ps` |
| Voir aussi les conteneurs arrêtés | `docker compose ps -a` |
| Voir les logs de `server-dev` | `docker compose logs -f server-dev` |
| Voir les logs de l'application + PostgreSQL | `docker compose logs -f server-dev postgres` |
| Voir les logs PostgreSQL | `docker compose logs -f postgres` |
| Ouvrir `psql` dans PostgreSQL | `docker compose exec postgres psql -U medusa -d medusa` |
| Arrêter et supprimer les conteneurs/réseau Compose | `docker compose down` |
| Supprimer aussi les volumes | `docker compose down -v` ⚠️ |

---

<a id="section-2"></a>

# 2. Arbre de décision rapide

```text
Je veux reprendre le développement
        |
        +-- server-dev existe mais a été arrêté avec stop
        |       |
        |       +--> docker compose start server-dev
        |
        +-- server-dev n'existe plus
        |       |
        |       +--> docker compose up -d server-dev
        |
        +-- J'ai modifié le Dockerfile / Node / une dépendance de l'image
        |       |
        |       +--> docker compose up -d --build server-dev
        |
        +-- Je veux uniquement PostgreSQL
                |
                +-- le conteneur existe et est arrêté
                |       |
                |       +--> docker compose start postgres
                |
                +-- il faut le créer/recréer
                        |
                        +--> docker compose up -d postgres
```

---

<a id="section-3"></a>

# 3. Démarrer `server-dev`

## 3.1 Reprendre après un simple arrêt

Si le conteneur existe déjà et a été arrêté avec :

```powershell
docker compose stop server-dev
```

le redémarrer avec :

```powershell
docker compose start server-dev
```

`start` ne construit aucune image et ne crée aucun nouveau conteneur.

---

## 3.2 Créer ou démarrer `server-dev`

```powershell
docker compose up -d server-dev
```

Cette commande demande à Docker Compose de faire en sorte que le service `server-dev` soit créé et démarré.

`-d` signifie *detached* : le conteneur tourne en arrière-plan.

---

## 3.3 Reconstruire l'image puis démarrer `server-dev`

À utiliser après une modification qui affecte la construction de l'image :

- `Dockerfile` ;
- version de Node dans le `Dockerfile` ;
- dépendance installée pendant la construction ;
- instruction `RUN`, `COPY`, `ENV`, etc.

```powershell
docker compose up -d --build server-dev
```

Docker Compose lit la fiche `server-dev` dans `compose.yaml`, puis demande à Docker Engine de reconstruire l'image conformément à `build:` avant de créer/recréer le conteneur si nécessaire.

---

## 3.4 Reconstruction sans cache

```powershell
docker compose build --no-cache server-dev
```

Puis :

```powershell
docker compose up -d server-dev
```

À utiliser seulement lorsqu'on veut forcer une construction complète sans réutiliser le cache de construction.

---

## 3.5 Quand une reconstruction n'est-elle pas nécessaire ?

Une reconstruction de l'image n'est généralement pas nécessaire après :

- une modification de `.gitignore` ;
- un simple `stop` / `start` ;
- une modification d'un fichier source monté directement dans le conteneur de développement ;
- un changement qui n'affecte pas le contenu construit dans l'image.

---

<a id="section-4"></a>

# 4. Arrêter et redémarrer `server-dev`

## Arrêter sans supprimer

```powershell
docker compose stop server-dev
```

## Reprendre

```powershell
docker compose start server-dev
```

## Redémarrer le conteneur existant

```powershell
docker compose restart server-dev
```

`restart` ne reconstruit pas l'image.

### Workflow recommandé en fin de journée

```text
Fin de journée :
docker compose stop server-dev

Reprise :
docker compose start server-dev
```

---

<a id="section-5"></a>

# 5. PostgreSQL local

## 5.1 Démarrer uniquement PostgreSQL

```powershell
docker compose up -d postgres
```

Lors de la première exécution, Docker Compose / Docker Engine peuvent notamment :

1. télécharger `postgres:15-alpine` si l'image n'est pas présente localement ;
2. créer le volume `postgres-data` s'il n'existe pas ;
3. créer le conteneur `ecom-modern-postgres` ;
4. démarrer PostgreSQL.

---

## 5.2 Vérifier son état

```powershell
docker compose ps
```

Le statut attendu est :

```text
healthy
```

---

## 5.3 Arrêter uniquement PostgreSQL

```powershell
docker compose stop postgres
```

## 5.4 Reprendre PostgreSQL

```powershell
docker compose start postgres
```

## 5.5 Redémarrer PostgreSQL

```powershell
docker compose restart postgres
```

---

## 5.6 Logs PostgreSQL

```powershell
docker compose logs postgres
```

En temps réel :

```powershell
docker compose logs -f postgres
```

Quitter le suivi avec :

```text
Ctrl + C
```

Cela n'arrête pas le conteneur.

---

## 5.7 Se connecter avec `psql`

```powershell
docker compose exec postgres psql -U medusa -d medusa
```

Vérifier la connexion :

```text
\conninfo
```

Afficher les tables :

```text
\dt
```

Avant l'installation de Medusa, il est normal d'obtenir :

```text
Did not find any relations.
```

Quitter :

```text
\q
```

---

<a id="section-6"></a>

# 6. Vérifier l'état du projet

## Services en cours d'exécution

```powershell
docker compose ps
```

## Inclure aussi les conteneurs arrêtés

```powershell
docker compose ps -a
```

---

<a id="section-7"></a>

# 7. Consulter les logs de l'application

## Logs existants

```powershell
docker compose logs server-dev
```

## Logs en temps réel

```powershell
docker compose logs -f server-dev
```

Quitter avec :

```text
Ctrl + C
```

---

<a id="section-8"></a>

# 8. Travailler à l'intérieur du conteneur `server-dev`

## Vérifier la version de Node dans le conteneur

```powershell
docker compose exec server-dev node -v
```

Cette version est indépendante de la version de Node sélectionnée sur Windows avec NVM.

## Ouvrir un shell

L'image de développement est basée sur Alpine Linux ; le shell disponible est généralement `sh` :

```powershell
docker compose exec server-dev sh
```

Quitter :

```text
exit
```

---

<a id="section-9"></a>

# 9. Service `server-prod`

## Démarrer

```powershell
docker compose up -d server-prod
```

Accessible sur :

```text
http://localhost:5001
```

## Reconstruire puis démarrer

```powershell
docker compose up -d --build server-prod
```

## Arrêter

```powershell
docker compose stop server-prod
```

---

<a id="section-10"></a>

# 10. Commandes concernant plusieurs services

## Reprendre l'environnement de travail courant après un simple `stop`

Si `server-dev` et `postgres` existent déjà et ont simplement été arrêtés :

```powershell
docker compose start server-dev postgres
```

Cette commande redémarre les deux conteneurs existants sans reconstruire d'image et sans les recréer.

## Arrêter l'application et PostgreSQL sans les supprimer

```powershell
docker compose stop server-dev postgres
```

## Redémarrer les deux conteneurs existants

```powershell
docker compose restart server-dev postgres
```

`restart` ne reconstruit pas l'image de `server-dev`.

## Suivre les logs des deux services

```powershell
docker compose logs -f server-dev postgres
```

Quitter le suivi avec `Ctrl + C` n'arrête pas les conteneurs.

## Créer/démarrer l'application et PostgreSQL si nécessaire

```powershell
docker compose up -d server-dev postgres
```

## Reconstruire l'image de `server-dev` puis démarrer les deux services

```powershell
docker compose up -d --build server-dev postgres
```

Dans cette commande, `server-dev` est reconstruisible car il utilise `build:`. PostgreSQL utilise directement l'image `postgres:15-alpine`, il n'est donc pas construit à partir de notre `Dockerfile`.

## Démarrer tous les services définis actuellement

```powershell
docker compose up -d
```

Avec le `compose.yaml` actuel, cette commande peut démarrer :

```text
server-dev
server-prod
postgres
```

En développement courant, il est préférable de cibler explicitement les services nécessaires.

Par exemple :

```powershell
docker compose up -d server-dev postgres
```

démarre `server-dev` et PostgreSQL sans démarrer `server-prod`.

## Construire puis démarrer tous les services buildables

```powershell
docker compose up -d --build
```

À utiliser uniquement si l'on veut réellement appliquer l'opération à l'ensemble du projet Compose.

---

<a id="section-11"></a>

# 11. Arrêt et suppression

## Arrêter un service sans supprimer son conteneur

```powershell
docker compose stop server-dev
```

ou :

```powershell
docker compose stop postgres
```

## Arrêter tous les services sans supprimer les conteneurs

```powershell
docker compose stop
```

Reprendre :

```powershell
docker compose start
```

---

## Supprimer les conteneurs et le réseau Compose

```powershell
docker compose down
```

Après `down`, `start` ne suffit plus : les conteneurs ont été supprimés.

Il faut utiliser par exemple :

```powershell
docker compose up -d server-dev
```

ou :

```powershell
docker compose up -d postgres
```

---

## Supprimer aussi les volumes

```powershell
docker compose down --volumes
```

ou :

```powershell
docker compose down -v
```

> ⚠️ Cette commande supprime aussi le volume PostgreSQL local. Elle peut donc effacer la base `medusa` de développement.

---

## Supprimer uniquement le conteneur `server-dev` arrêté

```powershell
docker compose rm -f server-dev
```

Puis le recréer :

```powershell
docker compose up -d server-dev
```

---

<a id="section-12"></a>

# 12. Volumes

Afficher les volumes gérés par Docker Engine :

```powershell
docker volume ls
```

Le volume PostgreSQL du projet doit apparaître sous un nom proche de :

```text
ecom-modern-dockerise_postgres-data
```

---

<a id="section-13"></a>

# 13. Résumé quotidien

## Application e-commerce actuelle (`server-dev`)

```powershell
# Reprendre après un simple stop
docker compose start server-dev

# Arrêter sans supprimer
docker compose stop server-dev

# Créer/recréer et démarrer si nécessaire
docker compose up -d server-dev

# Reconstruire l'image puis démarrer
docker compose up -d --build server-dev

# Redémarrer le conteneur existant
docker compose restart server-dev
```

## PostgreSQL (`postgres`)

```powershell
# Reprendre après un simple stop
docker compose start postgres

# Arrêter sans supprimer
docker compose stop postgres

# Créer/recréer et démarrer si nécessaire
docker compose up -d postgres

# Redémarrer le conteneur existant
docker compose restart postgres

# Logs
docker compose logs -f postgres
```

## Application + PostgreSQL (`server-dev` + `postgres`)

C'est la combinaison la plus utile lorsque l'on travaille sur l'application actuelle avec la base PostgreSQL destinée à Medusa.

```powershell
# Reprendre les deux après un simple stop
docker compose start server-dev postgres

# Arrêter les deux sans supprimer les conteneurs
docker compose stop server-dev postgres

# Créer/recréer et démarrer les deux si nécessaire
docker compose up -d server-dev postgres

# Reconstruire l'image de server-dev puis démarrer aussi PostgreSQL
docker compose up -d --build server-dev postgres

# Redémarrer les deux conteneurs existants
docker compose restart server-dev postgres

# Suivre les logs des deux services
docker compose logs -f server-dev postgres
```

### En cas de reconstruction complète sans cache

```powershell
docker compose build --no-cache server-dev
docker compose up -d server-dev postgres
```

### Workflow courant après un simple arrêt

```text
Début de session
→ docker compose start server-dev postgres

Fin de session
→ docker compose stop server-dev postgres
```

> 💡 Utiliser `start` uniquement si les conteneurs existent déjà. Après un `docker compose down`, utiliser `docker compose up -d server-dev postgres`, car `down` supprime les conteneurs.

## Vérifications

```powershell
docker compose ps
docker compose ps -a
```

---

<a id="section-14"></a>

# 14. Règles simples à retenir

```text
STOP
→ START

DOWN
→ UP

Modification du Dockerfile / Node / dépendance construite dans l'image
→ UP --BUILD

Problème de cache de construction
→ BUILD --NO-CACHE puis UP

PostgreSQL arrêté mais conteneur encore présent
→ START postgres

PostgreSQL absent / conteneur supprimé
→ UP -d postgres

DOWN
→ conserve normalement le volume PostgreSQL

DOWN -v
→ supprime aussi le volume PostgreSQL
→ ATTENTION aux données
```

---

<a id="section-15"></a>

# 15. Schéma récapitulatif

```text
Docker Desktop
│
├── Docker CLI
│   └── reçoit : docker compose up -d --build server-dev
│
├── Docker Compose
│   └── lit compose.yaml
│       │
│       ├── service server-dev
│       │   └── build:
│       │       └── context: .
│       │           └── Dockerfile
│       │
│       ├── service server-prod
│       │   └── build:
│       │       └── context: .
│       │           └── Dockerfile
│       │
│       └── service postgres
│           └── image: postgres:15-alpine
│
└── Docker Engine
    │
    ├── construit les images des services utilisant build:
    ├── utilise/télécharge les images référencées par image:
    ├── crée les conteneurs
    ├── crée les réseaux
    └── gère les volumes

Projet Compose : ecom-modern-dockerise
│
├── service server-dev
│   ├── image : ecom-modern-dockerise-server-dev:latest
│   └── conteneur : server-dev-1
│
├── service server-prod
│   ├── image : ecom-modern-dockerise-server-prod:latest
│   └── conteneur : créé/démarré seulement si demandé
│
└── service postgres
    ├── image : postgres:15-alpine
    ├── conteneur : ecom-modern-postgres
    └── volume : postgres-data
```
