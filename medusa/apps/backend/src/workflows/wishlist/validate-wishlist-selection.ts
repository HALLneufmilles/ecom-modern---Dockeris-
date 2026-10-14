import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export type WishlistSelectedOptions = Record<string, string>

const isWishlistSelectedOptions = (value: unknown): value is WishlistSelectedOptions => (
  Boolean(value)
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.values(value as Record<string, unknown>).every(
    (optionValue) => typeof optionValue === "string" && optionValue.length > 0
  )
)

export const normalizeWishlistSelectedOptions = (value: unknown): WishlistSelectedOptions | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (!isWishlistSelectedOptions(value) || !Object.keys(value).length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "selected_options must contain option values")
  }

  return value
}

type ProductOption = {
  id: string
  values?: { value?: string | null }[]
}

export const validateWishlistSelectedOptions = async (
  container: { resolve: (key: string) => any },
  productId: string,
  selectedOptions: WishlistSelectedOptions | null
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "options.id", "options.values.value"],
    filters: { id: productId },
  })
  const product = products[0] as { options?: ProductOption[] } | undefined

  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
  }

  if (!selectedOptions) {
    return null
  }

  for (const [optionId, selectedValue] of Object.entries(selectedOptions)) {
    const option = product.options?.find((candidate) => candidate.id === optionId)
    if (!option?.values?.some((candidate) => candidate.value === selectedValue)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Selected option does not belong to product")
    }
  }

  return selectedOptions
}
