import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteFilesWorkflow } from "@medusajs/medusa/core-flows"
import {
  MANAGED_MEDIA_MODULE,
} from "../modules/managed-media"
import {
  MANAGED_MEDIA_STATUS,
  type ManagedMediaRecord,
} from "../modules/managed-media/lifecycle"
import type ManagedMediaModuleService from "../modules/managed-media/service"

const confirmedTestMedia = [
  {
    id: "mmedia_01M3SGEKGHQ8Q4KHB4MQ1R1WBB",
    fileId: "uploads/low-tide-long-sleeve-blanc-casse-lifestyle-primary-01M3SGEK33F09PYEWDEENQFX4G.webp",
  },
  {
    id: "mmedia_01M3SGEKGJTDQWKKRHZ4R46TDG",
    fileId: "uploads/low-tide-long-sleeve-blanc-casse-lifestyle-secondary-01M3SGEK3GA7982HMDBARXCEWH.webp",
  },
] as const

const allowedArguments = new Set(["--dry-run", "--execute"])

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

  if (isDryRun && isExecute) {
    throw new Error("Use either --dry-run or --execute, not both.")
  }

  if (!isDryRun && !isExecute) {
    throw new Error("An explicit --dry-run or --execute argument is required.")
  }

  return isExecute ? "execute" : "dry-run"
}

const assertTargetIsSafe = (
  record: ManagedMediaRecord,
  expectedFileId: string
) => {
  if (record.file_id !== expectedFileId) {
    throw new Error(`Refusing ${record.id}: its file_id differs from the fixed allowlist.`)
  }

  if (record.product_id || record.product_image_id) {
    throw new Error(`Refusing ${record.id}: it is linked to a Product or Product image.`)
  }

  if (record.status !== MANAGED_MEDIA_STATUS.PENDING) {
    throw new Error(`Refusing ${record.id}: only pending test uploads are eligible, not ${record.status}.`)
  }
}

export default async function cleanupConfirmedTestManagedMedia({
  container,
}: {
  container: MedusaContainer
}) {
  const mode = getMode()
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const managedMediaService = container.resolve(
    MANAGED_MEDIA_MODULE
  ) as ManagedMediaModuleService
  const expectedById = new Map(
    confirmedTestMedia.map((media) => [media.id, media])
  )
  const records = await managedMediaService.listManagedMedias({
    id: confirmedTestMedia.map(({ id }) => id),
  }) as ManagedMediaRecord[]

  if (records.length !== confirmedTestMedia.length) {
    throw new Error("Refusing cleanup: not every allowlisted managed_media record was found.")
  }

  for (const record of records) {
    const expected = expectedById.get(record.id)
    if (!expected) {
      throw new Error(`Refusing cleanup: ${record.id} is not allowlisted.`)
    }
    assertTargetIsSafe(record, expected.fileId)
  }

  if (mode === "dry-run") {
    logger.info(`Dry run succeeded: ${records.length} pending, unassociated allowlisted test media records are eligible.`)
    for (const record of records) {
      logger.info(`Would delete file ${record.file_id} and then soft-delete managed_media ${record.id}.`)
    }
    return
  }

  for (const record of records) {
    await managedMediaService.updateManagedMedias({
      selector: { id: record.id },
      data: {
        status: MANAGED_MEDIA_STATUS.DELETION_PENDING,
        deletion_attempts: record.deletion_attempts + 1,
        last_error: null,
      },
    })

    try {
      await deleteFilesWorkflow(container).run({
        input: { ids: [record.file_id] },
      })
    } catch (error) {
      await managedMediaService.updateManagedMedias({
        selector: { id: record.id },
        data: {
          status: MANAGED_MEDIA_STATUS.DELETE_FAILED,
          last_error: "File Module deletion failed",
        },
      })
      throw error
    }

    try {
      await managedMediaService.deleteManagedMedias([record.id])
    } catch (error) {
      await managedMediaService.updateManagedMedias({
        selector: { id: record.id },
        data: {
          status: MANAGED_MEDIA_STATUS.DELETION_REQUESTED,
          last_error: "Managed media cleanup failed after File Module deletion",
        },
      })
      throw error
    }
    logger.info(`Deleted allowlisted test file and soft-deleted managed_media ${record.id}.`)
  }
}
