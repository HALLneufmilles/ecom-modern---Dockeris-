import { readFile } from "node:fs/promises"
import path from "node:path"
import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

type Target = Record<string, unknown> & { handle: string, grammage_g_m2: number | null }
const source = path.join(process.cwd(), "import-data", "catalog-product-metadata.json")
const seeds = new Set(["t-shirt", "shorts", "sweatshirt", "sweatpants"])
const keys = ["brand", "audience", "composition", "fit", "grammage_g_m2", "season", "care", "manufacture", "characteristics", "seo_title", "meta_description"]
const mode = () => {
  const args = process.argv.slice(2).filter((value) => value.startsWith("--") && value !== "--")
  if (args.length !== 1 || !["--dry-run", "--execute"].includes(args[0])) throw new Error("Use exactly one of --dry-run or --execute.")
  return args[0]
}
const split = (value: unknown) => typeof value === "string" && value.includes(";") ? value.split(";").map((item) => item.trim()).filter(Boolean) : value

export default async function applyImportedProductMetadata({ container }: { container: MedusaContainer }) {
  const executionMode = mode()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const targets = JSON.parse(await readFile(source, "utf8")) as Target[]
  if (targets.length !== 30 || new Set(targets.map(({ handle }) => handle)).size !== 30 || targets.some(({ handle }) => !handle || seeds.has(handle))) throw new Error("Invalid source targets: expected 30 unique non-seed handles.")
  for (const target of targets) if (keys.some((key) => key !== "grammage_g_m2" && (typeof target[key] !== "string" || !target[key]))) throw new Error(`Invalid metadata source for ${target.handle}.`)
  const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata"], filters: { handle: targets.map(({ handle }) => handle) } })
  const byHandle = new Map<string, any[]>()
  for (const product of data as any[]) byHandle.set(product.handle, [...(byHandle.get(product.handle) || []), product])
  const bad = targets.filter(({ handle }) => byHandle.get(handle)?.length !== 1)
  if (bad.length || data.length !== 30) throw new Error(`Expected exactly 30 unambiguous products. Invalid handles: ${bad.map(({ handle }) => handle).join(", ")}`)
  let add = 0, update = 0, unchanged = 0, conflicts = 0
  const changes: any[] = []
  for (const target of targets) {
    const product = byHandle.get(target.handle)![0]
    if (seeds.has(product.handle)) throw new Error(`Refusing seed ${product.handle}.`)
    const targetMetadata: Record<string, unknown> = Object.fromEntries(keys.filter((key) => target[key] !== null).map((key) => [key, ["audience", "characteristics"].includes(key) ? split(target[key]) : target[key]]))
    const current = product.metadata || {}
    const different = Object.keys(targetMetadata).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(targetMetadata[key]))
    const existingDifferent = different.filter((key) => current[key] !== undefined)
    const action = !different.length ? "inchangé" : existingDifferent.length ? "conflit" : "ajouter"
    logger.info(`handle=${target.handle} | product_id=${product.id} | metadata actuelles=${JSON.stringify(current)} | metadata cibles=${JSON.stringify(targetMetadata)} | action prévue=${action}`)
    if (action === "inchangé") { unchanged++; continue }
    if (action === "conflit") { conflicts++; continue }
    add++; changes.push({ id: product.id, metadata: { ...current, ...targetMetadata } })
  }
  logger.info(`Summary: products found=30, enrich=${add}, update=0, unchanged=${unchanged}, conflicts=${conflicts}, errors=0.`)
  if (executionMode === "--dry-run") return logger.info("Dry run completed without Medusa data changes.")
  if (conflicts) throw new Error("Refusing execution while metadata conflicts exist.")
  if (changes.length) await updateProductsWorkflow(container).run({ input: { products: changes } })
}
