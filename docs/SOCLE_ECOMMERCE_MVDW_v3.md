# Socle e-commerce MVDW v3

## Table des matières

- [Suivi des modifications](#suivi-des-modifications)
- [Objectif](#objectif)
- [Multi-vendeur](#multi-vendeur)
- [Core obligatoire — première définition](#core-obligatoire--première-définition)
- [Catalogue / Variantes / Inventaire / Stock](#catalogue--variantes--inventaire--stock)
- [Cart / Payment / Order / Fulfillment](#cart--payment--order--fulfillment)
- [Customer / Auth / Administration](#customer--auth--administration)
- [Modules / options activables](#modules--options-activables)
- [Providers remplaçables](#providers-remplaçables)
- [Configuration des fonctions optionnelles](#configuration-des-fonctions-optionnelles)
- [Signification de OFF](#signification-de-off)
- [Séparation Features / Providers](#séparation-features--providers)
- [Classification actuelle](#classification-actuelle)
- [Wishlist](#wishlist)
- [Médias](#médias)
- [Multi-vendeur comme capacité optionnelle future](#multi-vendeur-comme-capacité-optionnelle-future)
- [Principe d'architecture](#principe-darchitecture)
- [État de la conception](#état-de-la-conception)

## Suivi des modifications

| Version | Date de publication | Modification                                                                                                                                                                                                                                                                                 | Chapitre / paragraphe concerné                                                                   |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| v3      | 12/10/2026          | Consolidation du cycle d’authentification Customer : connexion persistante 7 jours, restauration de session côté serveur, distinction entre cookie HttpOnly, jeton Customer Medusa et cache UI, règles de login/logout et gestion des expirations.                                           | `Customer / Auth / Administration` — `Authentification Customer : login, restauration et logout` |
| v3      | 12/10/2026          | Sécurisation du cycle de vie des paniers invité et Customer : preuve d’accès serveur, partage multi-onglets, absence de fusion automatique au login, rattachement contrôlé au signup et gestion de `cart_unavailable`.                                                                       | `Cart / Payment / Order / Fulfillment` — `Panier invité et panier Customer`                      |
| v3      | 12/10/2026          | Refonte fonctionnelle F-17 Wishlist : doublons autorisés, `variant_id` optionnel, sélection partielle persistée dans `selected_options`, actions ciblées par `wishlist_item.id`, restauration du contexte et règles d’image/Cart.                                                            | `Wishlist`                                                                                       |
| v2      | 07/10/2026          | Décision fonctionnelle F-17 initiale : la wishlist est au niveau du Product Medusa, sans référence métier à une ProductVariant ; ajout autorisé indépendamment de la sélection ou de la disponibilité d'une variante. Cette décision est remplacée par les règles F-17 consolidées de la v3. | `Wishlist`                                                                                       |

## Objectif

Construire une architecture e-commerce réutilisable pour les futurs projets MVDW.

La boutique actuelle sert de projet pilote permettant de construire et valider progressivement ce socle.

Le socle doit distinguer :

- le Core obligatoire ;
- les modules/options activables ;
- les providers remplaçables ;
- les éléments nécessaires pour permettre une évolution future vers plusieurs vendeurs.

## Multi-vendeur

Situation actuelle :

- boutique mono-vendeur ;
- aucun module Marketplace/Vendor à développer pour l'instant.

Évolution anticipée :

- permettre ultérieurement l'ajout de 1 ou 2 vendeurs supplémentaires ;
- cette évolution ne doit pas nécessiter de reconstruire le cœur de la boutique.

Principes déjà décidés :

- utiliser les concepts natifs Medusa autant que possible ;
- ne pas détourner `SalesChannel`, `StockLocation`, un champ produit personnalisé ou une autre entité Medusa pour représenter artificiellement un vendeur ;
- ne pas créer maintenant de module Marketplace inutile ;
- lorsqu'un besoin multi-vendeur réel apparaîtra, envisager un Marketplace Module basé sur les concepts `Vendor` et `VendorAdmin` ;
- prévoir alors notamment les liens `Vendor ↔ Product` et `Vendor ↔ Order` ;
- un lien `Vendor ↔ StockLocation` pourra être ajouté si nécessaire ;
- un vendeur et un emplacement de stock doivent rester deux concepts distincts.

## Core obligatoire — première définition

Le Core doit s'appuyer autant que possible sur les modules natifs Medusa pour :

- Product ;
- ProductVariant ;
- Pricing ;
- Inventory ;
- StockLocation ;
- Customer / Auth ;
- Cart ;
- Checkout ;
- Payment ;
- Order ;
- Fulfillment ;
- fichiers / médias ;
- administration.

Cette liste est encore en cours d'étude et pourra évoluer pendant la conception.

## Catalogue / Variantes / Inventaire / Stock

### État validé

- `Product` et `ProductVariant` utilisent les modules natifs Medusa ;
- les variantes gèrent leur inventaire avec `manage_inventory` ;
- chaque variante actuelle est reliée à un `InventoryItem` ;
- les quantités et réservations sont gérées par `InventoryLevel` ;
- `InventoryItem` et `StockLocation` restent deux concepts séparés ;
- `Product` et `StockLocation` utilisent les relations natives avec `SalesChannel` ;
- `SalesChannel` ne représente pas un vendeur ;
- `StockLocation` ne représente pas un vendeur ;
- le storefront utilise la disponibilité Medusa et le Cart Medusa effectue le contrôle final du stock ;
- aucune métadonnée `vendor` ni aucun mécanisme personnalisé ne détourne actuellement le modèle natif Medusa.

### Décision pour le Socle MVDW v1

Cette partie du cœur Medusa est considérée comme compatible avec une future évolution de 1 à 3 vendeurs.

Ne pas créer de modèle spécifique MVDW pour remplacer `Product`, `ProductVariant`, `InventoryItem`, `InventoryLevel` ou `StockLocation`.

Un futur `Vendor` devra rester une notion indépendante pouvant être reliée ultérieurement à `Product` et, si le besoin métier le justifie, à `StockLocation`.

### Éléments pouvant rester tels quels actuellement

- un seul `StockLocation` tant qu'un seul emplacement réel suffit ;
- un seul `SalesChannel` tant qu'un seul canal commercial suffit ;
- modèle `Product` / `ProductVariant` ;
- options taille et couleur ;
- gestion native de l'inventaire ;
- disponibilité agrégée par le canal ;
- absence de `Vendor` et de Marketplace Module.

### Points de vigilance / préparation différée

1. Le seed actuel est un seed de démonstration pour une base mono-boutique. Il récupère globalement les `InventoryItem` et les rattache au `StockLocation` European Warehouse. Ce comportement ne devra pas être réutilisé tel quel comme mécanisme générique du futur socle lorsqu'il existera plusieurs emplacements ou vendeurs. Aucune modification du seed n'est nécessaire maintenant.
2. Le catalogue vendeur Firestore legacy utilise encore un stock global, des tailles simples et une propriété vendeur par e-mail. Ce modèle est destiné à disparaître progressivement. Il ne doit jamais être utilisé comme modèle de migration vers un futur `Vendor` Medusa.
3. Ne pas migrer `email`, `seller`, `tagsSeller` ou `stock` legacy vers des métadonnées `Product` destinées à simuler un vendeur.
4. Un futur lien `Vendor ↔ Product` doit rester indépendant des relations `Product ↔ SalesChannel`.
5. Un futur lien `Vendor ↔ StockLocation` ne devra être créé que si le besoin métier impose réellement qu'un vendeur possède ou contrôle un emplacement.

## Cart / Payment / Order / Fulfillment

### État validé

- le `Cart` et ses Line Items utilisent les modèles natifs Medusa ;
- les Line Items restent liés aux véritables `ProductVariant` ;
- les prix, promotions, taxes, livraison et totaux sont calculés par Medusa ;
- une `Payment Collection` native est créée pour le `Cart` ;
- une `Payment Session` native utilise le provider Stripe Checkout du projet ;
- Medusa reste l'autorité sur le montant à payer ;
- le paiement confirmé permet la complétion du `Cart` en `Order` ;
- l'`Order` conserve correctement ses Line Items, ses variantes, sa `Payment Collection` et sa `Shipping Method` ;
- le modèle `Fulfillment` Medusa existe nativement, même si aucun `Fulfillment` n'est encore créé opérationnellement ;
- le provider Stripe Checkout actuel reste un provider Medusa remplaçable.

### Panier invité et panier Customer

Le storefront distingue désormais deux situations métier différentes :

1. **Panier invité** : panier utilisé sans Customer authentifié.
2. **Panier Customer** : panier privé associé au Customer authentifié, notamment via `customer.metadata.active_cart_id`.

Un simple identifiant de Cart connu dans le navigateur ne constitue jamais une preuve suffisante d'accès. Le serveur doit vérifier le contexte autorisé avant de lire ou modifier le Cart.

#### Analogie simple : numéro de casier et ticket de consigne

Le `cartId` peut être comparé au **numéro inscrit sur un casier**. Connaître ce numéro ne prouve pas que le casier nous appartient.

La preuve serveur associée au panier invité joue le rôle du **ticket de consigne signé** : le serveur vérifie ce ticket avant d'autoriser l'accès au panier. Pour un panier Customer, c'est l'identité Customer authentifiée qui fait foi.

Cette distinction évite qu'un ancien `cartId`, copié ou conservé dans le navigateur, donne accès à un panier privé.

#### Panier invité

- le panier invité est temporaire ;
- son accès est protégé par une preuve côté serveur portée dans un cookie `HttpOnly` signé de session ;
- cette preuve possède un plafond cryptographique de 7 jours ;
- `sessionStorage` peut servir de cache d'interface, mais n'est pas une source de vérité ;
- plusieurs onglets successifs du même navigateur peuvent retrouver le même panier invité grâce au stockage navigateur partagé et à la preuve serveur ;
- une concurrence lors de la toute première création simultanée depuis plusieurs onglets n'est pas garantie comme un cas atomique ;
- la disparition de la preuve navigateur n'impose pas de supprimer immédiatement le Cart PostgreSQL : la sécurité repose sur l'autorisation d'accès, pas sur une suppression instantanée de la donnée.

#### Login d'un Customer existant

Lorsqu'un Customer existant se connecte :

- le serveur authentifie d'abord le Customer auprès de Medusa ;
- le panier actif du Customer est restauré depuis le contexte Customer autorisé ;
- un éventuel panier invité présent dans le navigateur **n'est pas fusionné automatiquement** avec le panier Customer ;
- le Customer retrouve donc son panier de compte, sans addition silencieuse des quantités provenant d'un panier invité.

Cette règle évite les ambiguïtés et les conflits de stock observés avec l'ancienne fusion automatique.

#### Signup d'un nouveau Customer

Lors de la création d'un nouveau compte :

- un panier invité peut être conservé ;
- il ne peut être rattaché au nouveau Customer que s'il est réellement reconnu et autorisé comme panier invité ;
- un simple `cartId` fourni par le navigateur ne suffit pas ;
- le rattachement sert à préserver le panier construit avant l'inscription, sans exposer le panier d'un autre Customer.

#### Logout et retour au mode invité

Après logout :

- les données Customer ne doivent plus être exposées au storefront anonyme ;
- un ancien `cartId` Customer ne doit jamais être présenté comme un panier invité ;
- le storefront revient à un contexte invité uniquement si une preuve invitée valide existe ou si un nouveau panier invité est créé.

#### Cas `cart_unavailable`

Une indisponibilité du Cart ne doit pas être interprétée de la même manière selon sa cause :

- si Medusa indique qu'une session Customer n'est plus valide (`401`), le cookie Customer peut être nettoyé puis le storefront peut revenir vers un panier invité **uniquement si ce panier invité est lui-même prouvé et autorisé** ;
- en cas de timeout, d'erreur réseau ou de `5xx`, il ne faut pas basculer silencieusement en mode invité : une panne serveur n'est pas une déconnexion fonctionnelle ;
- le serveur doit conserver une distinction explicite entre « Customer non authentifié » et « service momentanément indisponible ».

### Décision pour le Socle MVDW v1

Cette partie du cœur Medusa est considérée comme compatible avec une future évolution de 1 à 3 vendeurs, mais avec préparation différée ciblée.

Aucune modification immédiate du flux mono-vendeur n'est nécessaire.

### Hypothèses mono-vendeur actuelles

Ces hypothèses doivent être conservées comme dette connue et non comme architecture cible :

- un `Cart` produit actuellement une seule `Order` ;
- la page de confirmation attend une seule `Order` ;
- `active_cart_id` est effacé dès le premier événement `order.placed` ;
- une seule `Shipping Option` est choisie pour l'ensemble du `Cart` ;
- un seul paiement Stripe couvre actuellement le total complet du `Cart` ;
- aucune ventilation financière par vendeur n'existe ;
- aucune commission ni reversement vendeur n'existe ;
- aucun `Fulfillment` vendeur n'est créé.

Ces limitations sont acceptables tant que la boutique reste mono-vendeur.

### Ne pas introduire maintenant

- un `Vendor` artificiel dans les metadata du `Cart` ou de l'`Order` ;
- une association définitive `Cart = Vendor` ;
- une association `ShippingOption = Vendor` ;
- une association `StockLocation = Vendor` ;
- une logique de commission ou de reversement dans le provider Stripe ;
- une architecture de sous-commandes vendeur avant qu'un besoin multi-vendeur réel existe.

### Décisions structurantes différées

Lors de l'introduction future du module `Vendor`, les décisions structurantes suivantes devront être prises :

1. conserver ou non une `Order` commerciale parent ;
2. créer des sous-commandes ou commandes vendeur ;
3. répartir les Line Items selon `Vendor` ;
4. permettre éventuellement plusieurs `Shipping Methods` / `Fulfillments` ;
5. décider entre paiement client unique avec ventilation interne et paiements séparés ;
6. déterminer quand le `Cart` parent est entièrement traité ;
7. définir la vue de commande présentée au client ;
8. définir le modèle de commissions et reversements.

Ces décisions ne doivent pas être prises pendant la phase mono-vendeur actuelle.

### Éléments pouvant rester tels quels

- un `Cart` Medusa unique ;
- les `variant_id` natifs dans les Line Items ;
- les totaux calculés par Medusa ;
- `Payment Collection` et `Payment Session` natives ;
- le provider Stripe Checkout actuel ;
- le paiement global du `Cart` ;
- la création native de l'`Order` ;
- les `Shipping Options` actuelles ;
- l'absence actuelle de `Fulfillment` opérationnel ;
- l'absence de `Vendor`, commission et reversement.

## Customer / Auth / Administration

### État validé

- `Customer` Medusa et `User` Admin Medusa sont deux concepts distincts ;
- l'authentification `Customer` actuelle utilise le provider `emailpass` de Medusa ;
- le serveur conserve l'identité Customer dans un cookie `HttpOnly` persistant, prévu pour une durée maximale de 7 jours ;
- `customer.metadata` contient notamment `active_cart_id` pour restaurer le panier privé du Customer ;
- aucun rôle `vendor` ou `seller` n'est stocké dans `customer.metadata` ;
- Medusa Admin utilise son authentification native et reste séparé des comptes `Customer` ;
- aucun `Vendor`, `VendorAdmin`, module `Vendor` ou permission `Vendor` personnalisée n'existe actuellement dans Medusa ;
- cette séparation permet plus tard d'introduire un `VendorAdmin` distinct sans transformer `Customer` ou Admin.

### Authentification Customer : login, restauration et logout

L'authentification doit être comprise comme une chaîne de confiance entre le navigateur, le serveur Express/BFF et Medusa.

#### Les trois éléments à ne pas confondre

1. **Le cookie `HttpOnly` dans le navigateur**
   Il sert de moyen de transport persistant pour la session Customer. Le navigateur l'envoie automatiquement au serveur. Le JavaScript du storefront ne doit pas pouvoir le lire directement.

2. **Le jeton Customer Medusa**
   C'est le justificatif réellement compris par Medusa. Le serveur l'utilise pour demander à Medusa : « ce Customer est-il encore authentifié ? ».

3. **L'état d'interface, par exemple `sessionStorage.user`**
   Il peut accélérer l'affichage de l'interface, mais il ne prouve rien. Il peut disparaître à la fermeture du navigateur alors que le cookie `HttpOnly` existe encore.

#### Analogie : enveloppe scellée, badge et pense-bête

On peut imaginer :

- le cookie `HttpOnly` comme une **enveloppe scellée** que le navigateur transporte automatiquement ;
- le jeton Medusa comme le **badge d'accès** contenu ou représenté par cette enveloppe ;
- Medusa comme le **poste de sécurité** qui décide si le badge est encore valable ;
- `sessionStorage.user` comme un **pense-bête posé sur le bureau** pour afficher rapidement « connecté ».

Fermer le navigateur peut faire disparaître le pense-bête, mais pas forcément l'enveloppe.

Inversement, le fait que l'enveloppe soit encore présente ne garantit pas que le badge qu'elle représente soit encore accepté par Medusa.

C'est pour cette raison que **la présence d'un cookie ou d'un token côté navigateur ne suffit jamais à déclarer le Customer connecté**.

#### Connexion persistante pendant 7 jours

La règle fonctionnelle validée est une connexion persistante pendant 7 jours au maximum.

Au redémarrage du navigateur :

1. le storefront peut avoir perdu son cache `sessionStorage` ;
2. le cookie `HttpOnly` peut encore être présent ;
3. le storefront doit demander au serveur de restaurer la session ;
4. le serveur vérifie réellement le Customer auprès de Medusa ;
5. si Medusa accepte le jeton, l'état connecté est restauré ;
6. si Medusa refuse le jeton parce qu'il est expiré, invalide ou révoqué, le storefront doit repasser en état déconnecté.

**Point important :** un cookie encore présent et situé dans sa fenêtre maximale de 7 jours ne garantit pas que le jeton Medusa soit encore valable.

Autrement dit :

```text
Cookie encore présent
≠ connexion garantie

Jeton Customer accepté par Medusa
= connexion réellement valide
```

Cette nuance est essentielle : le navigateur ne décide pas seul de l'authentification.

#### Login

Lors d'un login explicite :

1. le navigateur envoie les identifiants au BFF ;
2. le BFF les transmet au provider Medusa `emailpass` ;
3. Medusa authentifie ou refuse le Customer ;
4. si l'authentification réussit, le BFF établit la session Customer côté navigateur ;
5. le panier Customer autorisé est restauré séparément.

Une erreur métier ou de stock sur un Cart ne doit pas transformer artificiellement une authentification Customer réussie en erreur de login.

Le login d'un Customer existant ne fusionne pas automatiquement un panier invité avec son panier Customer.

#### Restauration automatique

La restauration automatique ne doit pas se baser sur `sessionStorage.user`.

Le bon raisonnement est :

```text
Le navigateur pense peut-être connaître le Customer
→ le serveur vérifie
→ Medusa confirme ou refuse
→ l'interface s'aligne sur cette réponse
```

Cela évite deux incohérences :

- afficher « déconnecté » alors qu'une session Medusa valide existe encore ;
- afficher « connecté » alors que le jeton Medusa a expiré.

#### Logout

Le logout doit supprimer ou neutraliser le contexte Customer côté navigateur et empêcher toute nouvelle utilisation des ressources privées du Customer.

Après logout :

- le storefront ne doit plus considérer le Customer comme authentifié ;
- les caches d'interface liés au Customer doivent être nettoyés ;
- un ancien `cartId` Customer ne doit pas devenir un panier invité par simple conservation dans le navigateur ;
- toute réutilisation d'une ressource Customer doit repasser par une authentification valide.

Le logout ne doit pas être confondu avec la suppression des données Customer : les données persistantes du compte, de la Wishlist et du panier Customer restent côté serveur selon leurs propres règles de cycle de vie.

### Décision pour le Socle MVDW v1

Cette partie du cœur est considérée comme : « Compatible avec préparation différée ciblée. »

Conserver trois domaines d'identité distincts :

```text
Customer
→ client acheteur

Admin Medusa / MVDW
→ administration globale de la boutique

VendorAdmin futur
→ identité et permissions propres à un Vendor
```

Ne jamais transformer `Customer` en `Vendor` ou `VendorAdmin`.

Ne jamais utiliser `customer.metadata` pour stocker un rôle `Vendor` ou une appartenance `Vendor`.

### Legacy seller temporaire et non autoritatif

Le legacy `seller` doit être considéré explicitement comme temporaire et non autoritatif :

- `users.seller` ;
- collection `sellers` ;
- `tagsSeller` ;
- propriété des produits par e-mail ;
- page et parcours `seller` legacy ;
- pseudo `authToken` généré côté navigateur ;
- `seller` stocké dans l'état navigateur ;
- routes legacy faisant confiance à des informations fournies par le navigateur ;
- fallback Firestore encore utilisé pendant la migration de certains comptes.

Ce système ne doit jamais servir de fondation au futur modèle `Vendor`.

Le pseudo `authToken` legacy ne constitue pas une authentification fiable et ne doit pas être étendu.

Les routes et données `seller` Firestore doivent disparaître progressivement avec Firestore.

### Point de vigilance sécurité

Avant d'exposer publiquement un véritable parcours vendeur, le legacy `seller` devra avoir été supprimé ou neutralisé.

S'il reste accessible dans un environnement de production avant sa suppression, son exposition devra être traitée comme un sujet de sécurité distinct et non comme une fonctionnalité `Vendor` temporaire.

### Éléments pouvant rester tels quels

- `Customer` / Auth Medusa `emailpass` ;
- cookie `Customer` `HttpOnly` géré par Express ;
- séparation `Customer` / Admin ;
- `customer.metadata.active_cart_id` ;
- Medusa Admin réservé à l'administration globale MVDW ;
- absence actuelle de `Vendor` et `VendorAdmin`.

### Décisions structurantes différées

Lors de l'introduction future de `Vendor`, les décisions structurantes suivantes devront être prises :

1. modèle d'identité `VendorAdmin` distinct de `Customer` et de l'Admin global ;
2. relation `VendorAdmin ↔ Vendor` ;
3. APIs dédiées au dashboard vendeur ;
4. `Vendor` déterminé côté serveur à partir de l'identité authentifiée ;
5. permissions par `Vendor` sur `Product`, `Order`, `Inventory` et éventuellement `StockLocation` ;
6. stratégie de session, révocation et administration des accès ;
7. conception d'un dashboard vendeur distinct de Medusa Admin si nécessaire.

Ces décisions ne doivent pas être prises pendant la phase mono-vendeur actuelle.

## Modules / options activables

Les modules et fonctions optionnelles identifiés sont :

- wishlist ;
- fidélité ;
- retours / RMA storefront ;
- newsletter / marketing ;
- recherche avancée ;
- recommandations ;
- panier abandonné ;
- multi-vendeur futur.

Le consentement est une capacité conditionnelle liée aux services réellement utilisés, notamment le marketing, et ne doit pas être traité comme une simple option décorative.

Ces fonctions ne doivent pas obligatoirement faire partie du Core.

## Providers remplaçables

Le socle doit éviter de dépendre inutilement d'un fournisseur particulier.

Les domaines concernés comprennent notamment :

- paiement ;
- stockage de fichiers ;
- email ;
- livraison / fulfillment.

Le besoin fonctionnel peut appartenir au Core alors que le fournisseur concret doit rester remplaçable.

## Configuration des fonctions optionnelles

Pour le Socle MVDW v1, les fonctions optionnelles sont configurées par boutique ou déploiement dans une configuration explicite et versionnée.

Aucune interface Medusa Admin d'activation ou de désactivation dynamique n'est à construire actuellement. Une administration dynamique pourra être étudiée plus tard si un besoin réel apparaît.

Le principe conceptuel est :

```text
features
├── wishlist
├── loyalty
├── returns
├── marketing
├── advancedSearch
├── recommendations
├── abandonedCart
└── multiVendor
```

Cette liste pourra évoluer pendant la conception. Aucun fichier de configuration n'est créé à ce stade : seul le principe est documenté.

## Signification de OFF

Une fonction optionnelle désactivée doit, selon sa nature :

- ne pas être proposée dans l'interface utilisateur ;
- ne pas exposer ses routes ou API propres lorsque cela est pertinent ;
- ne pas exécuter ses workflows, subscribers ou traitements spécifiques ;
- ne pas nécessiter son provider externe lorsqu'il est utilisé uniquement par cette fonction.

Les données historiques d'une fonction désactivée sont conservées par défaut. Désactiver une fonction ne signifie pas supprimer ses données ; une réactivation ultérieure doit rester possible sauf décision explicite de suppression ou de migration.

Tout le code d'une fonction OFF ne doit pas nécessairement être physiquement absent ou non chargé. Pour une petite fonction, il peut rester présent tant que la fonction est inaccessible, qu'aucune logique métier inutile n'est exécutée et qu'aucune dépendance externe inutile n'est imposée. Pour un module backend ou provider indépendant, le non-chargement ou le non-enregistrement est préférable lorsque cela reste simple.

## Séparation Features / Providers

Les features représentent des capacités métier activables ou désactivables. Les providers fournissent une implémentation remplaçable d'une capacité du Core ou d'un module.

Exemples :

- paiement : capacité Core ; Stripe : provider actuel ;
- fichiers et médias : capacité Core ; Cloudflare R2 : stockage/provider cible ;
- email et notifications : capacité nécessaire selon les fonctions utilisées ; provider email concret : choix remplaçable ;
- livraison et Fulfillment : capacité Core ; provider transport : implémentation remplaçable.

## Classification actuelle

### Core obligatoire

- catalogue ;
- `Product` / `ProductVariant` ;
- `Pricing` ;
- `Inventory` / `StockLocation` ;
- `Customer` / Auth ;
- `Cart` ;
- checkout ;
- `Payment` ;
- `Order` ;
- Shipping / Fulfillment ;
- fichiers / médias ;
- administration.

### Modules / fonctions optionnelles

- wishlist ;
- fidélité ;
- retours / RMA storefront ;
- newsletter / marketing ;
- recherche avancée ;
- recommandations ;
- panier abandonné ;
- multi-vendeur futur.

## Wishlist

La Wishlist F-17 est une fonction optionnelle MVDW persistante liée au `Customer`, avec PostgreSQL et Medusa comme source de vérité.

Elle ne doit plus reposer sur `localStorage` ou Firestore pour stocker la vérité métier.

### Principe métier : une liste libre, pas un ensemble dédupliqué

La Wishlist est volontairement une liste librement gérée par l'utilisateur.

Un même Product peut apparaître plusieurs fois.

Une même ProductVariant peut apparaître plusieurs fois.

Des lignes génériques identiques peuvent également coexister.

Exemple valide :

```text
Hoodie
Hoodie
Hoodie — Gris / M
Hoodie — Gris / M
Hoodie — Noir / L
```

Cette règle permet notamment à l'utilisateur de conserver deux intentions différentes pour une même variante, par exemple en acheter une aujourd'hui et en garder une autre dans sa Wishlist pour un achat prévu plus tard.

Il ne faut donc imposer aucune unicité métier sur `product_id`, `variant_id` ou leur combinaison.

Chaque ligne est indépendante et son identité métier est portée par son propre `wishlist_item.id`.

### Structure d'un WishlistItem

Un WishlistItem peut contenir :

- `product_id` : Product Medusa concerné ;
- `variant_id` : référence optionnelle vers une ProductVariant complète ;
- `selected_options` : sélection partielle optionnelle stockée en JSON ;
- l'identifiant propre de la ligne `wishlist_item.id`.

Le prix, le titre, l'image, le stock et les autres données catalogue ne doivent pas être dupliqués dans la Wishlist. Ils restent dérivés du catalogue Medusa.

### Trois états fonctionnels possibles

#### 1. Ligne générique

Aucun choix utilisateur significatif n'a été enregistré.

```text
variant_id = null
selected_options = null
```

Exemple :

```text
Shoreline Coach Jacket
[ Choisir les options ]
```

La carte utilise la présentation par défaut du Product.

#### 2. Ligne avec sélection partielle

L'utilisateur a exprimé une préférence, mais pas suffisamment pour résoudre une ProductVariant complète.

Exemple :

```text
Couleur = Noir
Taille = non choisie
```

Stockage conceptuel :

```json
{
  "variant_id": null,
  "selected_options": {
    "option_couleur_medusa": "Noir"
  }
}
```

`selected_options` reste générique : il mappe un identifiant de `ProductOption` Medusa vers la valeur choisie. Il ne doit pas être limité à la couleur ; d'autres options comme matière, finition ou longueur pourraient utiliser le même mécanisme.

Cette sélection partielle est persistante : elle doit survivre au reload et être restaurée lors du retour sur la fiche produit.

#### 3. Ligne avec ProductVariant complète

Lorsque toutes les options nécessaires permettent de déterminer une ProductVariant :

```text
variant_id = <id ProductVariant>
selected_options = null
```

La ProductVariant devient alors la représentation canonique de la sélection.

### Image d'une ligne Wishlist

Aucune URL d'image ne doit être copiée dans WishlistItem.

L'image est dérivée du catalogue au moment de la lecture :

1. variante complète : utiliser la présentation correspondant à la ProductVariant ;
2. sélection partielle contenant une couleur : utiliser `mediaByColor` pour cette couleur ;
3. aucune sélection : utiliser la présentation par défaut du Product ;
4. fallback : image principale du Product.

Exemple :

- Bleu est la couleur par défaut ;
- l'utilisateur clique explicitement sur Noir sans choisir de taille ;
- la Wishlist doit afficher l'image Noir ;
- après reload, l'image Noir doit rester ;
- `Choisir les options` doit rouvrir la fiche sur Noir, avec la taille toujours non sélectionnée.

### Restauration d'une sélection sur la fiche produit

Lorsqu'une fiche est ouverte depuis la Wishlist, le contexte doit rester attaché à la ligne précise grâce à `wishlistItemId`.

Le navigateur ne doit pas transporter la sélection métier complète dans l'URL comme source de vérité.

Le serveur relit le WishlistItem autorisé puis restaure :

- l'état par défaut pour une ligne générique ;
- les `selected_options` pour une sélection partielle ;
- la ProductVariant exacte pour une ligne complète.

Une valeur restaurée peut être appliquée avec un état équivalent à `explicit: false`.

Cela signifie uniquement :

> cette valeur vient d'être restaurée automatiquement depuis la Wishlist pendant cette visite.

Cela ne signifie pas que l'utilisateur ne l'avait jamais choisie.

Exemple :

1. l'utilisateur choisit Noir ;
2. Noir est sauvegardé dans `selected_options` ;
3. plus tard, la fiche est rouverte depuis cette ligne ;
4. Noir est restauré automatiquement ;
5. si l'utilisateur ne change rien et clique `Ajouter à la Wishlist`, le message est `Produit déjà en Wishlist.` ;
6. s'il clique Bleu puis sauvegarde, la ligne est mise à jour et le message devient `Produit mis à jour.`.

La comparaison doit donc porter sur **l'état enregistré d'origine** et **l'état courant**, pas uniquement sur le fait qu'un bouton a été cliqué pendant la visite courante.

### Parcours depuis une fiche produit ouverte normalement

Une fiche ouverte depuis le catalogue, la recherche, les recommandations ou une navigation normale n'est rattachée à aucune ligne Wishlist précise.

Dans ce contexte :

- `Ajouter à la Wishlist` crée toujours un nouveau WishlistItem, même si un Product ou une ProductVariant identique existe déjà ;
- `Ajouter au panier` n'efface aucune ligne Wishlist.

Cette règle évite de supprimer arbitrairement une ligne lorsqu'il existe plusieurs doublons volontaires.

### Parcours depuis une ligne générique ou partielle

Une ligne sans ProductVariant complète affiche `Choisir les options`.

Pour une ligne générique :

- image, nom et description ne sont pas des liens de navigation actifs ;
- seul `Choisir les options` ouvre la fiche.

Pour une ligne partielle :

- le même principe s'applique tant qu'aucune ProductVariant complète n'existe ;
- la fiche restaure les options mémorisées.

Une ligne générique ou partielle ne peut pas être ajoutée directement au Cart.

Depuis la fiche ouverte avec son `wishlistItemId` :

- `Ajouter au panier` ajoute la variante courante si elle est devenue complète puis supprime uniquement cette ligne Wishlist après succès ;
- `Ajouter à la Wishlist` met à jour cette ligne si son état a changé ;
- si rien n'a changé, aucune nouvelle ligne n'est créée et le message est `Produit déjà en Wishlist.` ;
- si l'état a changé, le message est `Produit mis à jour.`.

### Parcours depuis une ligne avec variante

Pour une ligne portant une ProductVariant :

- image, nom et description sont cliquables ;
- la fiche s'ouvre sur la variante exacte de cette ligne ;
- `wishlistItemId` identifie la ligne d'origine.

Depuis cette fiche :

- `Ajouter au panier` supprime uniquement cette ligne après réussite de l'ajout Cart ;
- si l'utilisateur conserve la même variante puis clique `Ajouter à la Wishlist`, rien n'est dupliqué et le message est `Produit déjà en Wishlist.` ;
- s'il change de variante puis clique `Ajouter à la Wishlist`, seule cette ligne est mise à jour et le message est `Produit mis à jour.` ;
- si une autre ligne possède déjà la même variante, ce doublon reste autorisé.

### Suppression et sécurité

Toute suppression ou mise à jour ciblée doit utiliser le `wishlist_item.id` de la ligne concernée.

Le backend doit vérifier :

- le Customer authentifié ;
- la Wishlist appartenant à ce Customer ;
- le WishlistItem appartenant à cette Wishlist ;
- la cohérence du Product ;
- la cohérence éventuelle de la ProductVariant ;
- la validité des `selected_options`.

Un Customer ne doit jamais pouvoir lire, modifier, supprimer ou transférer une ligne Wishlist appartenant à un autre Customer.

Lorsqu'une ligne est transférée vers le Cart :

- la suppression intervient uniquement après succès de l'ajout Cart ;
- en cas d'échec Cart, la ligne Wishlist reste intacte.

### Validation de `selected_options`

Le backend ne doit pas accepter aveuglément le JSON fourni par le navigateur.

Pour chaque paire `ProductOption.id → valeur` :

- l'option doit appartenir au Product ;
- la valeur doit exister réellement pour cette option ;
- une sélection incohérente doit être refusée explicitement.

### Feature flag

La Wishlist reste une fonction optionnelle configurée par boutique ou déploiement.

Lorsqu'elle est désactivée :

- son interface n'est pas proposée ;
- ses routes/workflows propres sont inactifs selon la configuration prévue ;
- les données existantes sont conservées pour permettre une réactivation ultérieure.

Cette conception ne doit introduire ni module `Vendor` ni dépendance à un vendeur, afin de rester compatible avec une évolution future de 1 à 3 vendeurs.

## Médias

La gestion des fichiers et médias appartient au Core, mais son fournisseur de stockage doit rester remplaçable.

La cible déjà décidée est :

```text
Medusa File Module
→ provider compatible S3
→ Cloudflare R2
```

L'ancien accès AWS S3 direct est legacy et doit disparaître lors de la migration correspondante.

## Multi-vendeur comme capacité optionnelle future

`multiVendor` est conceptuellement OFF aujourd'hui. Aucun module `Vendor` ne doit être créé maintenant.

Lorsque le besoin réel apparaîtra, cette option pourra correspondre à l'activation d'une véritable couche `Vendor` / `VendorAdmin` et de ses workflows, dans le respect des décisions déjà documentées. L'ancien seller Firestore n'est pas une version du module multi-vendeur et ne doit jamais devenir une feature optionnelle du socle : il constitue une dette de migration destinée à disparaître.

## Principe d'architecture

À chaque décision technique importante, vérifier :

« Ce choix fonctionne-t-il aujourd'hui avec un vendeur tout en permettant d'en avoir jusqu'à trois demain sans réécrire le cœur ? »

Ne pas construire maintenant des fonctions marketplace qui ne sont pas nécessaires.

Ne pas non plus introduire d'hypothèses mono-vendeur artificielles dans le storefront, le serveur ou les modules personnalisés si Medusa possède déjà une abstraction plus générale.

Le principe général du socle est :

```text
Socle MVDW
+ configuration de la boutique
+ providers choisis
= boutique client
```

Le but est de conserver un socle simple et réutilisable. Il ne faut pas construire maintenant une plateforme générique de feature flags, un package indépendant pour chaque fonction, une administration dynamique des options ou des abstractions dont aucun projet actuel n'a besoin.

## État de la conception

Première décision validée :

- pas de Marketplace Module maintenant ;
- architecture Medusa native conservée ;
- compatibilité future 1 → 3 vendeurs à surveiller pendant toute la conception.

Première étude terminée et validée :

- périmètre : `Product`, `ProductVariant`, `InventoryItem`, `InventoryLevel`, `StockLocation` et `SalesChannel` ;
- statut : « Compatible avec préparation différée ciblée. »

Les conclusions permanentes et les points de vigilance de cette étude sont consignés dans la section « Catalogue / Variantes / Inventaire / Stock ».

Deuxième étude terminée et validée :

- périmètre : `Cart`, `Payment`, `Order` et `Fulfillment` ;
- statut : « Compatible avec préparation différée ciblée. »

Les conclusions permanentes, les hypothèses mono-vendeur et les décisions différées de cette étude sont consignées dans la section « Cart / Payment / Order / Fulfillment ».

Troisième étude terminée et validée :

- périmètre : `Customer`, Auth et Administration ;
- statut : « Compatible avec préparation différée ciblée. »

Les conclusions permanentes, le point de vigilance sécurité et les décisions différées de cette étude sont consignés dans la section « Customer / Auth / Administration ».

Quatrième étude terminée et validée :

- périmètre : `Core`, modules, providers et fonctions activables ;
- statut : « Principes d'architecture validés. »

Les décisions de configuration, de désactivation et de séparation entre features et providers sont consignées dans les sections correspondantes.

Cinquième étude consolidée et validée :

- périmètre : authentification Customer, persistance de session, login/logout et séparation panier invité / panier Customer ;
- statut : « Règles fonctionnelles et de sécurité validées. »

Les principes permanents de restauration de session, de validation du jeton Medusa, de panier invité prouvé côté serveur et d'absence de fusion automatique au login sont consignés dans les sections « Customer / Auth / Administration » et « Cart / Payment / Order / Fulfillment ».

Sixième étude consolidée et validée :

- périmètre : F-17 Wishlist persistante ;
- statut : « Modèle métier consolidé. »

La Wishlist supporte désormais les doublons volontaires, les lignes génériques, les sélections partielles via `selected_options`, les ProductVariant complètes et les actions ciblées par `wishlist_item.id`. Les règles permanentes sont consignées dans la section « Wishlist ».
