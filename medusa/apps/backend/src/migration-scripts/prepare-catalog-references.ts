import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductTagsWorkflow,
  createProductTypesWorkflow,
} from "@medusajs/medusa/core-flows"
import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"

type CategoryDefinition = {
  name: string
  parent: string | null
}

type Reference = {
  id: string
  value: string
}

type CategoryReference = Reference & {
  parentId: string | null
}

const mappingPath = path.join(
  process.cwd(),
  "import-data",
  "catalog-reference-mapping.csv"
)

const collections = [
  "Atlantic Coast",
  "City Series",
  "Core",
  "Everyday Utility",
  "Harbour Workwear",
  "Summer Sessions",
  "Trail",
  "Urban Outdoor",
]

const productTypes = [
  "Bonnet",
  "Casquette",
  "Casquette five-panel",
  "Coach jacket",
  "Coupe-vent",
  "Hoodie zippé",
  "Hoodie à enfiler",
  "Pantalon cargo",
  "Pantalon large",
  "Pantalon technique",
  "Pantalon workwear",
  "Polaire",
  "Sac à dos",
  "Short cargo",
  "Surchemise workwear",
  "Sweat col rond",
  "T-shirt classique",
  "T-shirt graphique",
  "T-shirt manches longues",
  "T-shirt oversize",
  "T-shirt technique",
  "T-shirt épais",
  "Tote bag",
  "Veste de travail",
  "Veste shell",
]

const productTags = [
  "côtier",
  "décontracté",
  "graphique",
  "minimaliste",
  "outdoor",
  "oversize",
  "streetwear",
  "surf",
  "technique",
  "urbain",
  "utilitaire",
  "workwear",
]

const categories: CategoryDefinition[] = [
  { name: "Vêtements", parent: null },
  { name: "Hauts", parent: "Vêtements" },
  { name: "T-shirts", parent: "Hauts" },
  { name: "Sweats", parent: "Hauts" },
  { name: "Hoodies", parent: "Hauts" },
  { name: "Polaires", parent: "Hauts" },
  { name: "Surchemises", parent: "Hauts" },
  { name: "Vestes", parent: "Vêtements" },
  { name: "Bas", parent: "Vêtements" },
  { name: "Pantalons", parent: "Bas" },
  { name: "Shorts", parent: "Bas" },
  { name: "Accessoires", parent: null },
  { name: "Casquettes", parent: "Accessoires" },
  { name: "Bonnets", parent: "Accessoires" },
  { name: "Sacs", parent: "Accessoires" },
]

const allowedArguments = new Set(["--dry-run", "--execute"])

const normalize = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("fr")

const getMode = () => {
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

const indexReferences = (references: Reference[], label: string) => {
  const byValue = new Map<string, Reference>()

  for (const reference of references) {
    const key = normalize(reference.value)
    if (byValue.has(key)) {
      throw new Error(`Refusing to continue: duplicate existing ${label} value ${reference.value}.`)
    }
    byValue.set(key, reference)
  }

  return byValue
}

const formatNames = (values: string[]) => values.length ? values.join(", ") : "none"

const csvEscape = (value: string) => `"${value.replaceAll('"', '""')}"`

const writeMapping = async (references: {
  collections: Reference[]
  productTypes: Reference[]
  productTags: Reference[]
  categories: CategoryReference[]
}) => {
  const rows = ["type,nom,id,parent"]

  for (const collection of references.collections) {
    rows.push(["collection", collection.value, collection.id, ""].map(csvEscape).join(","))
  }
  for (const productType of references.productTypes) {
    rows.push(["product_type", productType.value, productType.id, ""].map(csvEscape).join(","))
  }
  for (const productTag of references.productTags) {
    rows.push(["tag", productTag.value, productTag.id, ""].map(csvEscape).join(","))
  }
  for (const category of references.categories) {
    rows.push([
      "category",
      category.value,
      category.id,
      category.parentId || "",
    ].map(csvEscape).join(","))
  }

  await mkdir(path.dirname(mappingPath), { recursive: true })
  const temporaryPath = `${mappingPath}.tmp`
  await writeFile(temporaryPath, `${rows.join("\n")}\n`, "utf8")
  await rename(temporaryPath, mappingPath)
}

export default async function prepareCatalogReferences({
  container,
}: {
  container: MedusaContainer
}) {
  const mode = getMode()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existingCollectionsData } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title"],
  })
  const { data: existingTypesData } = await query.graph({
    entity: "product_type",
    fields: ["id", "value"],
  })
  const { data: existingTagsData } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
  })
  const { data: existingCategoriesData } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "parent_category_id"],
  })

  const existingCollections = existingCollectionsData as Reference[]
  const existingTypes = existingTypesData as Reference[]
  const existingTags = existingTagsData as Reference[]
  const existingCategories = existingCategoriesData.map((category: {
    id: string
    name: string
    parent_category_id: string | null
  }) => ({
    id: category.id,
    value: category.name,
    parentId: category.parent_category_id,
  })) as CategoryReference[]

  const collectionsByValue = indexReferences(existingCollections, "collection")
  const typesByValue = indexReferences(existingTypes, "product type")
  const tagsByValue = indexReferences(existingTags, "product tag")
  const categoriesByName = indexReferences(existingCategories, "product category") as Map<string, CategoryReference>

  const missingCollections = collections.filter((value) => !collectionsByValue.has(normalize(value)))
  const missingTypes = productTypes.filter((value) => !typesByValue.has(normalize(value)))
  const missingTags = productTags.filter((value) => !tagsByValue.has(normalize(value)))
  const missingCategories: CategoryDefinition[] = []

  for (const category of categories) {
    const existing = categoriesByName.get(normalize(category.name))
    const expectedParent = category.parent
      ? categoriesByName.get(normalize(category.parent))?.id
      : null

    if (existing && category.parent && !expectedParent) {
      throw new Error(`Refusing category ${category.name}: its existing parent ${category.parent} is unavailable.`)
    }

    if (existing && existing.parentId !== expectedParent) {
      throw new Error(`Refusing category ${category.name}: an existing category has a different parent.`)
    }

    if (!existing) {
      missingCategories.push(category)
    }
  }

  const existingCollectionNames = collections.filter((value) => collectionsByValue.has(normalize(value)))
  const existingTypeNames = productTypes.filter((value) => typesByValue.has(normalize(value)))
  const existingTagNames = productTags.filter((value) => tagsByValue.has(normalize(value)))
  const existingCategoryNames = categories
    .filter(({ name }) => categoriesByName.has(normalize(name)))
    .map(({ name }) => name)
  const preservedSeedCategoryNames = existingCategories
    .filter(({ value }) => ["Shirts", "Sweatshirts", "Pants", "Merch"].includes(value))
    .map(({ value }) => value)

  logger.info(`Existing collections: ${formatNames(existingCollectionNames)}`)
  logger.info(`Existing product types: ${formatNames(existingTypeNames)}`)
  logger.info(`Existing product tags: ${formatNames(existingTagNames)}`)
  logger.info(`Existing requested categories: ${formatNames(existingCategoryNames)}`)
  logger.info(`Preserved seed categories: ${formatNames(preservedSeedCategoryNames)}`)
  logger.info(`Collections to create: ${formatNames(missingCollections)}`)
  logger.info(`Product types to create: ${formatNames(missingTypes)}`)
  logger.info(`Product tags to create: ${formatNames(missingTags)}`)
  logger.info("Category hierarchy:")
  for (const category of categories) {
    const depth = category.parent === null ? 0 : category.parent === "Vêtements" || category.parent === "Accessoires" ? 1 : 2
    const status = categoriesByName.has(normalize(category.name)) ? "existing" : "create"
    logger.info(`${"  ".repeat(depth)}- ${category.name} (${status})`)
  }

  if (mode === "dry-run") {
    logger.info("Dry run completed without database changes.")
    return
  }

  if (missingCollections.length) {
    const { result } = await createCollectionsWorkflow(container).run({
      input: { collections: missingCollections.map((title) => ({ title })) },
    })
    for (const collection of result) {
      collectionsByValue.set(normalize(collection.title), { id: collection.id, value: collection.title })
    }
  }

  if (missingTypes.length) {
    const { result } = await createProductTypesWorkflow(container).run({
      input: { product_types: missingTypes.map((value) => ({ value })) },
    })
    for (const productType of result) {
      typesByValue.set(normalize(productType.value), { id: productType.id, value: productType.value })
    }
  }

  if (missingTags.length) {
    const { result } = await createProductTagsWorkflow(container).run({
      input: { product_tags: missingTags.map((value) => ({ value })) },
    })
    for (const productTag of result) {
      tagsByValue.set(normalize(productTag.value), { id: productTag.id, value: productTag.value })
    }
  }

  for (const category of missingCategories) {
    const parentId = category.parent
      ? categoriesByName.get(normalize(category.parent))?.id
      : null
    if (category.parent && !parentId) {
      throw new Error(`Refusing category ${category.name}: its parent ${category.parent} is unavailable.`)
    }

    const { result: [createdCategory] } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [{
          name: category.name,
          is_active: true,
          parent_category_id: parentId,
        }],
      },
    })
    categoriesByName.set(normalize(createdCategory.name), {
      id: createdCategory.id,
      value: createdCategory.name,
      parentId,
    })
  }

  await writeMapping({
    collections: collections.map((value) => collectionsByValue.get(normalize(value))!),
    productTypes: productTypes.map((value) => typesByValue.get(normalize(value))!),
    productTags: productTags.map((value) => tagsByValue.get(normalize(value))!),
    categories: categories.map(({ name }) => categoriesByName.get(normalize(name))!),
  })
  logger.info(`Catalog reference mapping written to ${mappingPath}.`)
}
