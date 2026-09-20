# Socle e-commerce MVDW v1

## Table des matières

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

- le navigateur conserve actuellement un unique `medusa_cart_id` ;
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
- le serveur conserve l'identité `Customer` dans un cookie `HttpOnly` ;
- `customer.metadata` ne contient actuellement que `active_cart_id` ;
- aucun rôle `vendor` ou `seller` n'est stocké dans `customer.metadata` ;
- Medusa Admin utilise son authentification native et reste séparé des comptes `Customer` ;
- aucun `Vendor`, `VendorAdmin`, module `Vendor` ou permission `Vendor` personnalisée n'existe actuellement dans Medusa ;
- cette séparation permet plus tard d'introduire un `VendorAdmin` distinct sans transformer `Customer` ou Admin.

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

La wishlist actuelle, fondée sur `localStorage` et Firestore, est legacy.

Lors de F-17, elle devra devenir une fonction optionnelle MVDW persistante liée au `Customer` et aux `Product` Medusa. Le modèle de données exact sera défini lors de cette étude et n'est pas décidé maintenant.

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
