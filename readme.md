login: user2@user.fr

mdp: user256000

first release

nom github : ecom-moderne-dockerise

# Docker — commandes utiles pour le projet E-commerce

Les commandes suivantes doivent être exécutées depuis la racine du projet, dans le dossier qui contient `compose.yaml`.

Le projet contient actuellement deux services Docker Compose :

- `server-dev` : environnement de développement, accessible sur `http://localhost:5000`
- `server-prod` : environnement de production local, accessible sur `http://localhost:5001`

> 💡 **Pour le travail courant sur le projet, on cible en priorité `server-dev`.**
> Éviter d'utiliser `docker compose up -d` sans préciser de service, sauf si l'on veut réellement démarrer tous les services définis dans `compose.yaml`.

---

## 🚦 Quelle commande choisir ?

C'est la partie à consulter en premier lorsqu'on ne sait plus quelle commande utiliser.

| Situation                                                                                      | Commande à utiliser                                                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| J'ai arrêté `server-dev` avec `docker compose stop server-dev` et je veux reprendre le travail | `docker compose start server-dev`                                                    |
| Le conteneur `server-dev` n'existe plus, par exemple après `docker compose down`               | `docker compose up -d server-dev`                                                    |
| Je veux créer/démarrer `server-dev` et laisser Docker décider s'il doit le recréer             | `docker compose up -d server-dev`                                                    |
| J'ai modifié le `Dockerfile`, la version de Node ou une dépendance installée dans l'image      | `docker compose up -d --build server-dev`                                            |
| Je soupçonne un problème de cache Docker                                                       | `docker compose build --no-cache server-dev`, puis `docker compose up -d server-dev` |
| Je veux simplement redémarrer le conteneur existant                                            | `docker compose restart server-dev`                                                  |
| Je veux arrêter `server-dev` sans le supprimer                                                 | `docker compose stop server-dev`                                                     |
| Je veux arrêter et supprimer les conteneurs du projet                                          | `docker compose down`                                                                |
| Je veux vérifier ce qui tourne                                                                 | `docker compose ps`                                                                  |
| Je veux voir les logs de `server-dev`                                                          | `docker compose logs -f server-dev`                                                  |

---

## 🧭 Arbre de décision rapide

```text
Je veux reprendre le développement
        |
        +-- J'avais fait : docker compose stop server-dev
        |       |
        |       +--> docker compose start server-dev
        |
        +-- J'avais fait : docker compose down
        |       |
        |       +--> docker compose up -d server-dev
        |
        +-- Le conteneur n'existe plus
        |       |
        |       +--> docker compose up -d server-dev
        |
        +-- J'ai modifié le Dockerfile / Node / une dépendance de l'image
                |
                +--> docker compose up -d --build server-dev
```

---

# 1. Commandes de démarrage

## Démarrer un conteneur de développement déjà existant

À utiliser lorsque le conteneur a simplement été arrêté avec :

```powershell
docker compose stop server-dev
```

Pour le redémarrer :

```powershell
docker compose start server-dev
```

### À retenir

`start` ne crée pas de nouveau conteneur.

Il redémarre uniquement un conteneur qui existe déjà et qui est arrêté.

C'est donc la commande normale pour reprendre le travail le lendemain si l'on avait simplement utilisé `stop`.

---

## Créer et démarrer le conteneur de développement

À utiliser si :

- le conteneur n'existe pas encore ;
- le conteneur a été supprimé ;
- on a exécuté `docker compose down` ;
- on veut laisser Docker Compose créer ou recréer le conteneur si nécessaire.

```powershell
docker compose up -d server-dev
```

`-d` signifie _detached_ : le conteneur tourne en arrière-plan et le terminal reste disponible.

### Différence importante avec `start`

```powershell
docker compose start server-dev
```

démarre seulement un conteneur **déjà existant**.

Alors que :

```powershell
docker compose up -d server-dev
```

peut **créer puis démarrer** le conteneur si nécessaire.

---

## ⚠️ À quoi sert `docker compose up -d` sans préciser `server-dev` ?

```powershell
docker compose up -d
```

Cette commande s'applique à l'ensemble des services définis dans `compose.yaml`.

Dans ce projet, elle peut donc démarrer :

- `server-dev`
- `server-prod`

Ce n'est généralement **pas ce que l'on veut pendant le développement courant**.

Pour travailler sur le projet, préférer :

```powershell
docker compose up -d server-dev
```

ou, si le conteneur existe déjà et a seulement été arrêté :

```powershell
docker compose start server-dev
```

---

# 2. Commandes d'arrêt

## Arrêter le conteneur de développement sans le supprimer

```powershell
docker compose stop server-dev
```

Le conteneur reste présent.

Pour reprendre le travail ensuite :

```powershell
docker compose start server-dev
```

### Usage recommandé en fin de journée

Si l'on veut simplement arrêter le projet et le reprendre plus tard, cette combinaison est la plus simple :

```text
Fin de journée :
docker compose stop server-dev

Reprise :
docker compose start server-dev
```

---

## Arrêter tous les services sans les supprimer

```powershell
docker compose stop
```

Puis les redémarrer :

```powershell
docker compose start
```

> ⚠️ Ces commandes concernent tous les services Compose, pas uniquement `server-dev`.

---

## Arrêter et supprimer les conteneurs et le réseau Compose

```powershell
docker compose down
```

Après cette commande, le conteneur n'existe plus.

Donc ceci ne suffira plus :

```powershell
docker compose start server-dev
```

Il faudra recréer le conteneur avec :

```powershell
docker compose up -d server-dev
```

ou, si l'image doit aussi être reconstruite :

```powershell
docker compose up -d --build server-dev
```

---

# 3. Reconstruire l'image Docker

## Construire/reconstruire l'image puis démarrer `server-dev`

À utiliser après une modification qui affecte l'image Docker, par exemple :

- modification du `Dockerfile` ;
- changement de version de Node dans le `Dockerfile` ;
- modification d'une dépendance installée pendant le build ;
- modification d'une instruction `RUN`, `COPY`, `ENV`, etc.

```powershell
docker compose up -d --build server-dev
```

Cette commande :

1. reconstruit l'image ;
2. crée ou recrée le conteneur si nécessaire ;
3. démarre `server-dev` en arrière-plan.

---

## Reconstruire sans utiliser le cache Docker

À utiliser seulement si l'on soupçonne un problème de cache ou si l'on veut forcer une reconstruction complète.

```powershell
docker compose build --no-cache server-dev
```

Puis :

```powershell
docker compose up -d server-dev
```

---

## Quand un rebuild n'est-il PAS nécessaire ?

Un nouveau build n'est généralement pas nécessaire après :

- une simple modification d'un fichier source utilisé directement grâce au volume de développement ;
- une modification de `.gitignore` ;
- un simple arrêt/redémarrage du conteneur ;
- une modification qui n'affecte pas la construction de l'image Docker.

### Exemple

Après une simple modification de `.gitignore`, si `server-dev` avait été arrêté avec :

```powershell
docker compose stop server-dev
```

il suffit ensuite de faire :

```powershell
docker compose start server-dev
```

Il n'est pas nécessaire de reconstruire l'image.

---

## Quand faut-il refaire un build ?

Un rebuild est généralement nécessaire lorsque l'on modifie :

- le `Dockerfile` ;
- la version de Node utilisée dans l'image ;
- une dépendance qui doit être installée dans l'image ;
- certaines instructions de construction Docker.

Exemple : lorsque le projet passera de Node 18 à Node 22 dans le `Dockerfile` :

```powershell
docker compose up -d --build server-dev
```

---

# 4. Redémarrer un conteneur

## Redémarrer `server-dev`

```powershell
docker compose restart server-dev
```

Cette commande arrête puis redémarre le conteneur existant.

Elle ne reconstruit pas l'image.

À utiliser par exemple si le serveur semble bloqué mais qu'aucun changement Docker ne nécessite de rebuild.

---

# 5. Vérifier l'état du projet

## Voir les services en cours d'exécution

```powershell
docker compose ps
```

## Voir également les conteneurs arrêtés

```powershell
docker compose ps -a
```

---

# 6. Consulter les logs

## Afficher les logs existants

```powershell
docker compose logs server-dev
```

## Suivre les logs en temps réel

```powershell
docker compose logs -f server-dev
```

Quitter le suivi des logs avec :

```text
Ctrl + C
```

Cela n'arrête pas le conteneur.

---

# 7. Travailler à l'intérieur du conteneur

## Vérifier la version de Node utilisée dans Docker

```powershell
docker compose exec server-dev node -v
```

Cette version est indépendante de la version de Node installée sur Windows avec NVM.

---

## Ouvrir un shell dans `server-dev`

L'image utilise Alpine Linux, donc le shell disponible est généralement `sh` :

```powershell
docker compose exec server-dev sh
```

Pour quitter :

```text
exit
```

---

# 8. Service de production local

## Démarrer `server-prod`

```powershell
docker compose up -d server-prod
```

Le service est accessible sur :

```text
http://localhost:5001
```

---

## Construire puis démarrer `server-prod`

```powershell
docker compose up -d --build server-prod
```

---

## Arrêter `server-prod`

```powershell
docker compose stop server-prod
```

---

# 9. Commandes concernant tous les services

## Créer et démarrer tous les services

```powershell
docker compose up -d
```

Dans ce projet, cela peut démarrer à la fois `server-dev` et `server-prod`.

En développement courant, préférer :

```powershell
docker compose up -d server-dev
```

---

## Construire puis démarrer tous les services

```powershell
docker compose up -d --build
```

À utiliser uniquement si l'on veut réellement reconstruire et démarrer tous les services définis dans `compose.yaml`.

---

# 10. Suppression de conteneurs et volumes

## Supprimer uniquement le conteneur `server-dev` arrêté

```powershell
docker compose rm -f server-dev
```

Il faudra ensuite le recréer avec :

```powershell
docker compose up -d server-dev
```

---

## Supprimer les conteneurs et les volumes Compose

```powershell
docker compose down --volumes
```

> ⚠️ **À utiliser avec prudence.**
>
> Cette commande supprime également les volumes gérés par Docker Compose et peut donc supprimer des données persistantes si une base de données ou d'autres volumes sont ajoutés au projet.

---

# 11. Résumé ultra-rapide

## Les 4 commandes à retenir au quotidien

```powershell
# Reprendre après un simple stop
docker compose start server-dev

# Arrêter sans supprimer
docker compose stop server-dev

# Recréer/démarrer si nécessaire
docker compose up -d server-dev

# Reconstruire l'image puis démarrer
docker compose up -d --build server-dev
```

## Vérification

```powershell
docker compose ps
```

## Logs

```powershell
docker compose logs -f server-dev
```

---

# 12. La règle simple à retenir

```text
STOP  -> START
DOWN  -> UP
Modification Docker -> UP --BUILD
Problème de cache -> BUILD --NO-CACHE puis UP
```

En pratique :

```text
J'arrête le soir avec :
docker compose stop server-dev

Je reprends le lendemain avec :
docker compose start server-dev
```

C'est le workflow le plus simple pour le développement courant de ce projet.
