import { readFile } from "node:fs/promises"
import path from "node:path"

import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchLinkProductsToCategoryWorkflow } from "@medusajs/medusa/core-flows"

type Mode = "dry-run" | "execute"

type ProductTarget = {
  handle: string
  category: string
}

type ProductRecord = {
  id: string
  handle: string
  categories?: { id: string }[]
}

type CategoryRecord = {
  id: string
  name: string
}

const mappingPath = path.join(
  process.cwd(),
  "import-data",
  "catalog-reference-mapping.csv"
)

const productTargets: ProductTarget[] = [
  { handle: "atlantic-logo-tee", category: "T-shirts" },
  { handle: "atlantic-tote", category: "Sacs" },
  { handle: "alpine-cargo-short", category: "Shorts" },
  { handle: "block-hoodie", category: "Hoodies" },
  { handle: "break-cap", category: "Casquettes" },
  { handle: "canvas-chore-pant", category: "Pantalons" },
  { handle: "cargo-deck-pant", category: "Pantalons" },
  { handle: "coast-cargo-short", category: "Shorts" },
  { handle: "core-oversize-tee", category: "T-shirts" },
  { handle: "district-wide-pant", category: "Pantalons" },
  { handle: "dockyard-overshirt", category: "Surchemises" },
  { handle: "ds-five-panel-cap", category: "Casquettes" },
  { handle: "harbor-crew-sweat", category: "Sweats" },
  { handle: "harbor-tee", category: "T-shirts" },
  { handle: "low-tide-long-sleeve", category: "T-shirts" },
  { handle: "metro-zip-hoodie", category: "Hoodies" },
  { handle: "minimal-coach-jacket", category: "Vestes" },
  { handle: "north-shell-jacket", category: "Vestes" },
  { handle: "ridge-technical-tee", category: "T-shirts" },
  { handle: "rivet-heavy-tee", category: "T-shirts" },
  { handle: "shoreline-coach-jacket", category: "Vestes" },
  { handle: "summit-fleece", category: "Polaires" },
  { handle: "sunset-crewneck", category: "Sweats" },
  { handle: "swell-hoodie", category: "Hoodies" },
  { handle: "trail-pack-18l", category: "Sacs" },
  { handle: "transit-windbreaker", category: "Vestes" },
  { handle: "urban-trail-pant", category: "Pantalons" },
  { handle: "utility-city-cargo", category: "Pantalons" },
  { handle: "watch-cap", category: "Bonnets" },
  { handle: "wharf-worker-jacket", category: "Vestes" },
]

const seedHandles = new Set(["t-shirt", "shorts", "sweatshirt", "sweatpants"])
const allowedArguments = new Set(["--dry-run", "--execute"])

const parseMode = (): Mode => {
  const argumentsFromCli = process.argv.slice(2).filter((argument) => (
    argument.startsWith("--") && argument !== "--"
  ))
  const unknownArguments = argumentsFromCli.filter((argument) => !allowedArguments.has(argument))

  if (unknownArguments.length) {
    throw new Error(`Unsupported arguments: ${unknownArguments.join(", ")}`)
  }

  const isDryRun = argumentsFromCli.includes("--dry-run")
  const isExecute = argumentsFromCli.includes("--execute")

  if (isDryRun === isExecute) {
    throw new Error("Use exactly one of --dry-run or --execute.")
  }

  return isExecute ? "execute" : "dry-run"
}

const parseCsvLine = (line: string) => {
  const values: string[] = []
  let value = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (character === "," && !inQuotes) {
      values.push(value)
      value = ""
    } else {
      value += character
    }
  }

  if (inQuotes) {
    throw new Error(`Invalid CSV row: unmatched quote in ${line}`)
  }

  values.push(value)
  return values
}

const readCategoryIds = async () => {
  const csv = await readFile(mappingPath, "utf8")
  const categoryIds = new Map<string, string>()

  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line) {
      continue
    }

    const [type, name, id] = parseCsvLine(line)
    if (type !== "category") {
      continue
    }

    if (!name || !id || categoryIds.has(name)) {
      throw new Error(`Invalid or duplicate category mapping for ${name || "unknown category"}.`)
    }
    categoryIds.set(name, id)
  }

  return categoryIds
}

const assertUniqueHandles = () => {
  const handles = productTargets.map(({ handle }) => handle)
  const uniqueHandles = new Set(handles)

  if (handles.length !== 30 || uniqueHandles.size !== handles.length) {
    throw new Error("The imported catalog must contain exactly 30 unique target handles.")
  }

  const seedsTargeted = handles.filter((handle) => seedHandles.has(handle))
  if (seedsTargeted.length) {
    throw new Error(`Refusing to target seed products: ${seedsTargeted.join(", ")}.`)
  }
}

export default async function linkImportedProductsToCategories({
  container,
}: {
  container: MedusaContainer
}) {
  const mode = parseMode()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  assertUniqueHandles()

  const categoryIds = await readCategoryIds()
  const targetCategoryNames = [...new Set(productTargets.map(({ category }) => category))]
  const missingMappedCategories = targetCategoryNames.filter((name) => !categoryIds.has(name))
  if (missingMappedCategories.length) {
    throw new Error(`Missing category IDs in mapping: ${missingMappedCategories.join(", ")}.`)
  }

  const { data: categoryData } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { id: targetCategoryNames.map((name) => categoryIds.get(name)!) },
  })
  const categoriesById = new Map((categoryData as CategoryRecord[]).map((category) => [category.id, category]))
  const missingCategories = targetCategoryNames.filter((name) => {
    const id = categoryIds.get(name)!
    return categoriesById.get(id)?.name !== name
  })
  if (missingCategories.length) {
    throw new Error(`Mapped Medusa categories missing or mismatched: ${missingCategories.join(", ")}.`)
  }

  const targetHandles = productTargets.map(({ handle }) => handle)
  const { data: productData } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "categories.id"],
    filters: { handle: targetHandles },
  })
  const productsByHandle = new Map<string, ProductRecord[]>()
  for (const product of productData as ProductRecord[]) {
    const matchingProducts = productsByHandle.get(product.handle) || []
    matchingProducts.push(product)
    productsByHandle.set(product.handle, matchingProducts)
  }

  const missingHandles = targetHandles.filter((handle) => !productsByHandle.has(handle))
  const ambiguousHandles = targetHandles.filter((handle) => (productsByHandle.get(handle)?.length || 0) !== 1)
  if (missingHandles.length || ambiguousHandles.length || productData.length !== productTargets.length) {
    throw new Error([
      `Expected exactly 30 catalog products; found ${productData.length}.`,
      missingHandles.length ? `Missing handles: ${missingHandles.join(", ")}.` : "",
      ambiguousHandles.length ? `Ambiguous handles: ${ambiguousHandles.join(", ")}.` : "",
    ].filter(Boolean).join(" "))
  }

  const seedProductsFound = (productData as ProductRecord[])
    .filter((product) => seedHandles.has(product.handle))
    .map((product) => product.handle)
  if (seedProductsFound.length) {
    throw new Error(`Refusing to modify seed products: ${seedProductsFound.join(", ")}.`)
  }

  const pendingByCategoryId = new Map<string, string[]>()
  let alreadyAssociated = 0

  for (const target of productTargets) {
    const product = productsByHandle.get(target.handle)![0]
    const categoryId = categoryIds.get(target.category)!
    const isAlreadyAssociated = product.categories?.some((category) => category.id === categoryId) || false

    logger.info([
      `handle=${target.handle}`,
      `catégorie cible=${target.category}`,
      `product_id=${product.id}`,
      `category_id=${categoryId}`,
      `état actuel=${isAlreadyAssociated ? "déjà associé" : "à associer"}`,
    ].join(" | "))

    if (isAlreadyAssociated) {
      alreadyAssociated += 1
      continue
    }

    const productIds = pendingByCategoryId.get(categoryId) || []
    productIds.push(product.id)
    pendingByCategoryId.set(categoryId, productIds)
  }

  const toAssociate = productTargets.length - alreadyAssociated
  logger.info(`Summary: ${alreadyAssociated} already associated, ${toAssociate} to associate.`)

  if (mode === "dry-run") {
    logger.info("Dry run completed without Medusa data changes.")
    return
  }

  for (const [categoryId, productIds] of pendingByCategoryId) {
    await batchLinkProductsToCategoryWorkflow(container).run({
      input: {
        id: categoryId,
        add: productIds,
      },
    })
  }

  logger.info(`Execution completed: ${toAssociate} product-category links added.`)
}
