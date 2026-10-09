import { readFile } from "node:fs/promises"
import path from "node:path"

import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

type Mode = "dry-run" | "execute"

type CatalogTarget = { handle: string }

type ImageRecord = {
  id: string
  url: string
}

type ProductRecord = {
  id: string
  handle: string
  metadata?: Record<string, unknown>
  images?: ImageRecord[]
  options?: {
    title: string
    values?: { value: string }[]
  }[]
}

type MediaByColor = Record<string, { image_ids: string[] }>

const source = path.join(process.cwd(), "import-data", "catalog-product-metadata.json")
const seedHandles = new Set(["t-shirt", "shorts", "sweatshirt", "sweatpants"])
const primaryRoleOrder = ["lifestyle-primary", "lifestyle-secondary", "product-front", "product-back"]
const additionalRoleOrder = ["product-main", "detail-angle"]
const roleOrder = [...primaryRoleOrder, ...additionalRoleOrder]
const manifestColorAliases: Record<string, string[]> = {
  brown: ["brun-tabac"],
  navy: ["bleu-marine"],
}
const allowedArguments = new Set(["--dry-run", "--execute"])

const parseMode = (): Mode => {
  const argumentsFromCli = process.argv.slice(2).filter((argument) => argument.startsWith("--") && argument !== "--")
  const unknownArguments = argumentsFromCli.filter((argument) => !allowedArguments.has(argument))

  if (unknownArguments.length) throw new Error(`Unsupported arguments: ${unknownArguments.join(", ")}.`)

  const isDryRun = argumentsFromCli.includes("--dry-run")
  const isExecute = argumentsFromCli.includes("--execute")
  if (isDryRun === isExecute) throw new Error("Use exactly one of --dry-run or --execute.")

  return isExecute ? "execute" : "dry-run"
}

const normalizeForComparison = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[\s_–—-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")

const getFilenameStem = (url: string) => {
  const filename = decodeURIComponent(new URL(url).pathname.split("/").pop() || "")
  const withoutExtension = filename.replace(/\.webp$/i, "")

  // Medusa's upload provider adds a ULID after the original MANIFEST filename.
  return { filename, stem: withoutExtension.replace(/-[A-Z0-9]{26}$/i, "") }
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

const readTargetHandles = async () => {
  const targets = JSON.parse(await readFile(source, "utf8")) as CatalogTarget[]
  const handles = targets.map(({ handle }) => handle)
  if (targets.length !== 30 || new Set(handles).size !== 30 || handles.some((handle) => !handle || seedHandles.has(handle))) {
    throw new Error("Invalid source targets: expected 30 unique non-seed handles.")
  }
  return handles
}

const getColorValues = (product: ProductRecord) => {
  const colorOptions = (product.options || []).filter((option) => ["color", "couleur"].includes(option.title.toLowerCase()))
  if (colorOptions.length > 1) throw new Error(`Multiple Color options found for ${product.handle}.`)
  return colorOptions[0]?.values?.map(({ value }) => value).filter(Boolean) || []
}

const buildMediaByColor = (product: ProductRecord, colors: string[]) => {
  const handleKey = normalizeForComparison(product.handle)
  const colorsByKey = new Map<string, string[]>()
  const galleryEntries = new Map<string, Map<string, ImageRecord>>()
  const unresolved: string[] = []

  for (const color of colors) {
    const colorKey = normalizeForComparison(color)
    colorsByKey.set(colorKey, [...(colorsByKey.get(colorKey) || []), color])
    galleryEntries.set(color, new Map())
  }

  const normalizedColors = [...colorsByKey.entries()]
    .map(([key, values]) => ({ key, values }))
    .sort((left, right) => right.key.length - left.key.length || left.key.localeCompare(right.key))

  for (const image of product.images || []) {
    const { filename, stem } = getFilenameStem(image.url)
    const prefix = `${handleKey}-`
    if (!stem.startsWith(prefix)) {
      unresolved.push(`${filename}: le handle MANIFEST ne correspond pas à ${product.handle}`)
      continue
    }

    const remainder = stem.slice(prefix.length)
    let candidates = normalizedColors.filter(({ key }) => remainder.startsWith(`${key}-`))
    if (!candidates.length) {
      const aliasKeys = Object.entries(manifestColorAliases)
        .filter(([alias]) => remainder.startsWith(`${alias}-`))
        .map(([alias]) => alias)
      candidates = aliasKeys.flatMap((alias) => {
        const targetColorKeys = new Set(manifestColorAliases[alias])
        return normalizedColors
          .filter(({ key }) => targetColorKeys.has(key))
          .map((candidate) => ({ ...candidate, key: alias }))
      })
    }
    if (!candidates.length) {
      unresolved.push(`${filename}: aucune valeur Couleur Medusa ne correspond`)
      continue
    }

    const longestLength = candidates[0].key.length
    const candidateValues = candidates.filter(({ key }) => key.length === longestLength).flatMap(({ values }) => values)
    if (candidateValues.length !== 1) {
      unresolved.push(`${filename}: correspondance Couleur ambiguë (${candidateValues.join(", ")})`)
      continue
    }

    const color = candidateValues[0]
    const role = remainder.slice(longestLength + 1)
    if (!roleOrder.includes(role)) {
      unresolved.push(`${filename}: rôle MANIFEST inconnu (${role || "absent"})`)
      continue
    }

    const gallery = galleryEntries.get(color)!
    if (gallery.has(role)) {
      unresolved.push(`${filename}: rôle ${role} dupliqué pour la couleur ${color}`)
      continue
    }
    gallery.set(role, image)
  }

  const mediaByColor: MediaByColor = {}
  const colorsWithoutGallery: string[] = []
  const partialGalleries: string[] = []

  for (const color of colors) {
    const images = roleOrder.flatMap((role) => galleryEntries.get(color)!.get(role) || [])
    if (!images.length) {
      colorsWithoutGallery.push(color)
      continue
    }
    if (images.length < primaryRoleOrder.length) partialGalleries.push(`${color} (${images.length} image(s))`)
    mediaByColor[color] = { image_ids: images.map(({ id }) => id) }
  }

  return { mediaByColor, unresolved, colorsWithoutGallery, partialGalleries }
}

export default async function buildProductMediaByColor({ container }: { container: MedusaContainer }) {
  const mode = parseMode()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const handles = await readTargetHandles()
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata", "images.id", "images.url", "options.title", "options.values.value"],
    filters: { handle: handles },
  })
  const productsByHandle = new Map<string, ProductRecord[]>()
  for (const product of data as ProductRecord[]) {
    productsByHandle.set(product.handle, [...(productsByHandle.get(product.handle) || []), product])
  }

  const invalidHandles = handles.filter((handle) => productsByHandle.get(handle)?.length !== 1)
  if (invalidHandles.length || data.length !== handles.length) {
    throw new Error(`Expected exactly 30 unambiguous catalog products. Invalid handles: ${invalidHandles.join(", ")}`)
  }

  const changes: { id: string, metadata: Record<string, unknown> }[] = []
  let unchanged = 0
  let conflicts = 0
  let colorProducts = 0
  let galleryCount = 0
  const unresolvedReports: string[] = []
  const colorsWithoutGallery: string[] = []
  const partialGalleries: string[] = []

  for (const handle of handles) {
    const product = productsByHandle.get(handle)![0]
    const colors = getColorValues(product)
    if (!colors.length) {
      logger.info(`handle=${handle} | aucune option Couleur | action prévue=ignorer`)
      continue
    }

    colorProducts += 1
    const report = buildMediaByColor(product, colors)
    galleryCount += Object.keys(report.mediaByColor).length
    unresolvedReports.push(...report.unresolved.map((entry) => `handle=${handle} | image=${entry}`))
    colorsWithoutGallery.push(...report.colorsWithoutGallery.map((color) => `handle=${handle} | couleur=${color}`))
    partialGalleries.push(...report.partialGalleries.map((entry) => `handle=${handle} | galerie partielle=${entry}`))

    const current = product.metadata || {}
    const currentMediaByColor = current.media_by_color
    const isUnchanged = stableJson(currentMediaByColor) === stableJson(report.mediaByColor)
    const isConflict = currentMediaByColor !== undefined && !isUnchanged
    const action = isUnchanged ? "inchangé" : isConflict ? "conflit" : "ajouter"
    logger.info(`handle=${handle} | galeries=${JSON.stringify(report.mediaByColor)} | action prévue=${action}`)

    if (isUnchanged) unchanged += 1
    else if (isConflict) conflicts += 1
    else changes.push({ id: product.id, metadata: { ...current, media_by_color: report.mediaByColor } })
  }

  for (const report of unresolvedReports) logger.warn(`Image non résolue: ${report}`)
  for (const report of colorsWithoutGallery) logger.warn(`Couleur sans galerie: ${report}`)
  for (const report of partialGalleries) logger.warn(`Galerie partielle: ${report}`)
  logger.info(`Summary: products found=30, products with Color=${colorProducts}, galleries=${galleryCount}, add=${changes.length}, unchanged=${unchanged}, conflicts=${conflicts}, unresolved images=${unresolvedReports.length}, colors without gallery=${colorsWithoutGallery.length}, partial galleries=${partialGalleries.length}.`)

  if (mode === "dry-run") {
    logger.info("Dry run completed without Medusa data changes.")
    return
  }
  if (conflicts) throw new Error("Refusing execution while existing media_by_color metadata conflicts exist.")
  if (changes.length) await updateProductsWorkflow(container).run({ input: { products: changes } })
  logger.info(`Execution completed: ${changes.length} product metadata records updated.`)
}
