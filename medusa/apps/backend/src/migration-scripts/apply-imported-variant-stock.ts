import { readFile } from "node:fs/promises"
import path from "node:path"

import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { batchInventoryItemLevelsWorkflow } from "@medusajs/medusa/core-flows"

type Mode = "dry-run" | "execute"

type StockTarget = {
  sku: string
  stock: number
}

type VariantRecord = {
  id: string
  sku: string
  product?: { handle: string }
  inventory_items?: { inventory_item_id: string }[]
}

type InventoryLevel = {
  id: string
  location_id: string
  stocked_quantity: number | string
}

type InventoryItemRecord = {
  id: string
  location_levels?: InventoryLevel[]
}

type StockLocationRecord = {
  id: string
  name: string
}

const stockMappingPath = path.join(
  process.cwd(),
  "import-data",
  "catalog-stock-mapping.csv"
)

const warehouseName = "European Warehouse"
const seedProductHandles = new Set(["t-shirt", "shorts", "sweatshirt", "sweatpants"])
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

const readStockTargets = async (): Promise<StockTarget[]> => {
  const csv = await readFile(stockMappingPath, "utf8")
  const rows = csv.split(/\r?\n/).filter(Boolean)

  if (rows.shift() !== "sku,stock") {
    throw new Error("Invalid stock mapping header. Expected sku,stock.")
  }

  const targets = rows.map((row) => {
    const [sku, rawStock, ...extraColumns] = row.split(",")
    if (!sku || !rawStock || extraColumns.length || !/^\d+$/.test(rawStock)) {
      throw new Error(`Invalid stock mapping row: ${row}`)
    }

    const stock = Number(rawStock)
    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new Error(`Invalid non-negative integer stock for SKU ${sku}.`)
    }

    return { sku, stock }
  })

  const duplicateSkus = [...new Set(targets.map(({ sku }) => sku))]
  if (targets.length !== 210 || duplicateSkus.length !== targets.length) {
    throw new Error("The stock mapping must contain exactly 210 unique SKU rows.")
  }

  return targets
}

export default async function applyImportedVariantStock({
  container,
}: {
  container: MedusaContainer
}) {
  const mode = parseMode()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const targets = await readStockTargets()
  const targetSkus = targets.map(({ sku }) => sku)

  const { data: warehouseData } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: warehouseName },
  })
  const warehouses = warehouseData as StockLocationRecord[]
  if (warehouses.length !== 1 || warehouses[0].name !== warehouseName) {
    throw new Error(`Expected exactly one stock location named ${warehouseName}; found ${warehouses.length}.`)
  }
  const warehouse = warehouses[0]

  const { data: variantData } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "product.handle", "inventory_items.inventory_item_id"],
    filters: { sku: targetSkus },
  })
  const variantsBySku = new Map<string, VariantRecord[]>()
  for (const variant of variantData as VariantRecord[]) {
    const matches = variantsBySku.get(variant.sku) || []
    matches.push(variant)
    variantsBySku.set(variant.sku, matches)
  }

  const missingSkus = targetSkus.filter((sku) => !variantsBySku.has(sku))
  const ambiguousSkus = targetSkus.filter((sku) => (variantsBySku.get(sku)?.length || 0) !== 1)
  if (missingSkus.length || ambiguousSkus.length || variantData.length !== targets.length) {
    throw new Error([
      `Expected exactly 210 catalog variants; found ${variantData.length}.`,
      missingSkus.length ? `Missing SKU: ${missingSkus.join(", ")}.` : "",
      ambiguousSkus.length ? `Ambiguous SKU: ${ambiguousSkus.join(", ")}.` : "",
    ].filter(Boolean).join(" "))
  }

  const seedVariants = (variantData as VariantRecord[]).filter((variant) => (
    seedProductHandles.has(variant.product?.handle || "")
  ))
  if (seedVariants.length) {
    throw new Error(`Refusing to modify seed variants: ${seedVariants.map(({ sku }) => sku).join(", ")}.`)
  }

  const inventoryItemBySku = new Map<string, string>()
  for (const target of targets) {
    const variant = variantsBySku.get(target.sku)![0]
    const inventoryItems = variant.inventory_items || []
    if (inventoryItems.length !== 1 || !inventoryItems[0].inventory_item_id) {
      throw new Error(`Expected exactly one inventory item for SKU ${target.sku}; found ${inventoryItems.length}.`)
    }
    inventoryItemBySku.set(target.sku, inventoryItems[0].inventory_item_id)
  }

  const inventoryItemIds = [...inventoryItemBySku.values()]
  const { data: inventoryItemData } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.id", "location_levels.location_id", "location_levels.stocked_quantity"],
    filters: { id: inventoryItemIds },
  })
  if (inventoryItemData.length !== inventoryItemIds.length) {
    throw new Error(`Expected ${inventoryItemIds.length} inventory items; found ${inventoryItemData.length}.`)
  }
  const inventoryItemsById = new Map((inventoryItemData as InventoryItemRecord[]).map((item) => [item.id, item]))

  const create: { inventory_item_id: string, location_id: string, stocked_quantity: number }[] = []
  const update: { id: string, inventory_item_id: string, location_id: string, stocked_quantity: number }[] = []
  let unchanged = 0

  for (const target of targets) {
    const variant = variantsBySku.get(target.sku)![0]
    const inventoryItemId = inventoryItemBySku.get(target.sku)!
    const inventoryItem = inventoryItemsById.get(inventoryItemId)
    if (!inventoryItem) {
      throw new Error(`Inventory item ${inventoryItemId} for SKU ${target.sku} was not found.`)
    }

    const matchingLevels = (inventoryItem.location_levels || []).filter((level) => level.location_id === warehouse.id)
    if (matchingLevels.length > 1) {
      throw new Error(`Multiple inventory levels found for SKU ${target.sku} at ${warehouseName}.`)
    }

    const existingLevel = matchingLevels[0]
    const currentStock = existingLevel ? Number(existingLevel.stocked_quantity) : null
    if (existingLevel && (!Number.isSafeInteger(currentStock) || currentStock < 0)) {
      throw new Error(`Invalid existing stock level for SKU ${target.sku}.`)
    }

    const action = !existingLevel
      ? "créer"
      : currentStock === target.stock
        ? "inchangé"
        : "mettre à jour"
    const currentState = existingLevel ? `stock=${currentStock}` : "aucun niveau"
    logger.info([
      `SKU=${target.sku}`,
      `variant_id=${variant.id}`,
      `inventory_item_id=${inventoryItemId}`,
      `stock cible=${target.stock}`,
      `état actuel=${currentState}`,
      `action prévue=${action}`,
    ].join(" | "))

    if (action === "créer") {
      create.push({ inventory_item_id: inventoryItemId, location_id: warehouse.id, stocked_quantity: target.stock })
    } else if (action === "mettre à jour") {
      update.push({ id: existingLevel!.id, inventory_item_id: inventoryItemId, location_id: warehouse.id, stocked_quantity: target.stock })
    } else {
      unchanged += 1
    }
  }

  logger.info(`Summary: variants found=${targets.length}, create=${create.length}, update=${update.length}, unchanged=${unchanged}, errors=0.`)

  if (mode === "dry-run") {
    logger.info("Dry run completed without Medusa data changes.")
    return
  }

  await batchInventoryItemLevelsWorkflow(container).run({
    input: { create, update, delete: [] },
  })
  logger.info(`Execution completed: ${create.length} levels created, ${update.length} levels updated.`)
}
