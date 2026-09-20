# Socle e-commerce MVDW v1

## Table des matières

- [Objectif](#objectif)
- [Multi-vendeur](#multi-vendeur)
- [Core obligatoire — première définition](#core-obligatoire--première-définition)
- [Modules / options activables](#modules--options-activables)
- [Providers remplaçables](#providers-remplaçables)
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

## Modules / options activables

Exemples déjà identifiés :

- wishlist ;
- fidélité ;
- retours ;
- consentement ;
- newsletter / marketing ;
- autres fonctions spécifiques selon les boutiques.

Ces fonctions ne doivent pas obligatoirement faire partie du Core.

## Providers remplaçables

Le socle doit éviter de dépendre inutilement d'un fournisseur particulier.

Les domaines concernés comprennent notamment :

- paiement ;
- stockage de fichiers ;
- email ;
- livraison / fulfillment.

Le besoin fonctionnel peut appartenir au Core alors que le fournisseur concret doit rester remplaçable.

## Principe d'architecture

À chaque décision technique importante, vérifier :

« Ce choix fonctionne-t-il aujourd'hui avec un vendeur tout en permettant d'en avoir jusqu'à trois demain sans réécrire le cœur ? »

Ne pas construire maintenant des fonctions marketplace qui ne sont pas nécessaires.

Ne pas non plus introduire d'hypothèses mono-vendeur artificielles dans le storefront, le serveur ou les modules personnalisés si Medusa possède déjà une abstraction plus générale.

## État de la conception

Première décision validée :

- pas de Marketplace Module maintenant ;
- architecture Medusa native conservée ;
- compatibilité future 1 → 3 vendeurs à surveiller pendant toute la conception.

Prochaine étude :

- `Product`
- `ProductVariant`
- `InventoryItem`
- `InventoryLevel`
- `StockLocation`
- `SalesChannel`

L'objectif de cette prochaine étude sera de vérifier si l'implémentation actuelle du projet respecte déjà correctement le modèle natif Medusa et si elle contient des hypothèses mono-vendeur à corriger.
