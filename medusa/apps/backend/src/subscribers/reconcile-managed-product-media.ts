import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { deleteFilesWorkflow } from "@medusajs/medusa/core-flows"
import {
  reconcileManagedProductMedia,
} from "../modules/managed-media/lifecycle"
import {
  MANAGED_MEDIA_MODULE,
} from "../modules/managed-media"
import type ManagedMediaModuleService from "../modules/managed-media/service"

type ProductMediaEvent = {
  id: string
}

type ProductImage = {
  id: string
  url: string
}

type ProductModuleMediaLookup = {
  listProductImages: (
    filters: { url: string },
    config: { select: string[] }
  ) => Promise<ProductImage[]>
  listProducts: (
    filters: { thumbnail: string },
    config: { select: string[] }
  ) => Promise<Array<{ id: string; thumbnail: string | null }>>
}

export default async function reconcileManagedProductMediaSubscriber({
  event: { data },
  container,
}: SubscriberArgs<ProductMediaEvent>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const managedMediaService = container.resolve(
    MANAGED_MEDIA_MODULE
  ) as ManagedMediaModuleService
  const productModuleService = container.resolve(
    Modules.PRODUCT
  ) as unknown as ProductModuleMediaLookup

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.id", "images.url"],
    filters: { id: data.id },
  })
  const product = products[0] as {
    id: string
    thumbnail?: string | null
    images?: ProductImage[]
  } | undefined

  if (!product) {
    return
  }

  const references = new Map<string, string | null>()
  for (const image of product.images ?? []) {
    references.set(image.url, image.id)
  }
  if (product.thumbnail && !references.has(product.thumbnail)) {
    references.set(product.thumbnail, null)
  }

  await reconcileManagedProductMedia({
    productId: product.id,
    references: [...references].map(([url, productImageId]) => ({
      url,
      productImageId,
    })),
    service: managedMediaService,
    isStillReferenced: async (url) => {
      const [images, productsUsingThumbnail] = await Promise.all([
        productModuleService.listProductImages(
          { url },
          { select: ["id", "url"] }
        ),
        productModuleService.listProducts(
          { thumbnail: url },
          { select: ["id", "thumbnail"] }
        ),
      ])

      return images.length > 0 || productsUsingThumbnail.length > 0
    },
    deleteFiles: async (fileIds) => {
      await deleteFilesWorkflow(container).run({
        input: { ids: fileIds },
      })
    },
  })
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
  context: {
    subscriberId: "managed-product-media-lifecycle",
  },
}
