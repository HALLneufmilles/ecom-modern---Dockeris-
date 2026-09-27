export const MANAGED_MEDIA_STATUS = {
  PENDING: "pending",
  ASSOCIATED: "associated",
  DELETION_PENDING: "deletion_pending",
  DELETION_REQUESTED: "deletion_requested",
  DELETE_FAILED: "delete_failed",
  RETAINED_REFERENCED: "retained_referenced",
} as const

export type UploadedFile = {
  id: string
  url: string
}

export type ProductMediaReference = {
  url: string
  productImageId: string | null
}

export type ManagedMediaRecord = {
  id: string
  file_id: string
  url: string
  status: string
  product_id: string | null
  product_image_id: string | null
  last_error: string | null
  deletion_attempts: number
}

export type ManagedMediaService = {
  createManagedMedias: (data: Array<{
    file_id: string
    url: string
    status: string
  }>) => Promise<unknown>
  listManagedMedias: (
    filters?: Record<string, unknown>
  ) => Promise<ManagedMediaRecord[]>
  updateManagedMedias: (data: {
    selector: { id: string }
    data: Record<string, unknown>
  }) => Promise<unknown>
}

export type ReconcileManagedMediaInput = {
  productId: string
  references: ProductMediaReference[]
  service: ManagedMediaService
  isStillReferenced: (url: string) => Promise<boolean>
  deleteFiles: (fileIds: string[]) => Promise<void>
}

export const getUploadedFilesFromResponse = (body: unknown): UploadedFile[] => {
  if (!body || typeof body !== "object" || !("files" in body)) {
    return []
  }

  const files = (body as { files?: unknown }).files
  if (!Array.isArray(files)) {
    return []
  }

  return files.filter((file): file is UploadedFile => (
    !!file &&
    typeof file === "object" &&
    typeof (file as UploadedFile).id === "string" &&
    typeof (file as UploadedFile).url === "string"
  ))
}

export const registerManagedUploads = async (
  service: ManagedMediaService,
  files: UploadedFile[]
) => {
  if (!files.length) {
    return
  }

  await service.createManagedMedias(files.map((file) => ({
    file_id: file.id,
    url: file.url,
    status: MANAGED_MEDIA_STATUS.PENDING,
  })))
}

export const registerManagedUploadsWithCompensation = async (
  service: ManagedMediaService,
  files: UploadedFile[],
  deleteFiles: (fileIds: string[]) => Promise<void>
) => {
  try {
    await registerManagedUploads(service, files)
  } catch (error) {
    try {
      await deleteFiles(files.map((file) => file.id))
    } catch {
      // The original registration error is the actionable failure. The File
      // Module provider is responsible for logging a failed compensation.
    }
    throw error
  }
}

export const reconcileManagedProductMedia = async ({
  productId,
  references,
  service,
  isStillReferenced,
  deleteFiles,
}: ReconcileManagedMediaInput) => {
  const referencesByUrl = new Map(
    references.map((reference) => [reference.url, reference])
  )

  const [pendingRecords, productRecords] = await Promise.all([
    references.length
      ? service.listManagedMedias({
          status: MANAGED_MEDIA_STATUS.PENDING,
          url: [...referencesByUrl.keys()],
        })
      : Promise.resolve([]),
    service.listManagedMedias({ product_id: productId }),
  ])

  for (const record of pendingRecords) {
    const reference = referencesByUrl.get(record.url)
    if (!reference) {
      continue
    }

    await service.updateManagedMedias({
      selector: { id: record.id },
      data: {
        status: MANAGED_MEDIA_STATUS.ASSOCIATED,
        product_id: productId,
        product_image_id: reference.productImageId,
        last_error: null,
      },
    })
  }

  const retryableStatuses = new Set<string>([
    MANAGED_MEDIA_STATUS.ASSOCIATED,
    MANAGED_MEDIA_STATUS.DELETION_PENDING,
    MANAGED_MEDIA_STATUS.DELETE_FAILED,
  ])

  for (const record of productRecords) {
    if (
      referencesByUrl.has(record.url) ||
      !retryableStatuses.has(record.status)
    ) {
      continue
    }

    if (await isStillReferenced(record.url)) {
      await service.updateManagedMedias({
        selector: { id: record.id },
        data: {
          status: MANAGED_MEDIA_STATUS.RETAINED_REFERENCED,
          last_error: null,
        },
      })
      continue
    }

    const deletionAttempts = record.deletion_attempts + 1
    await service.updateManagedMedias({
      selector: { id: record.id },
      data: {
        status: MANAGED_MEDIA_STATUS.DELETION_PENDING,
        deletion_attempts: deletionAttempts,
        last_error: null,
      },
    })

    try {
      await deleteFiles([record.file_id])
      await service.updateManagedMedias({
        selector: { id: record.id },
        data: {
          status: MANAGED_MEDIA_STATUS.DELETION_REQUESTED,
          product_image_id: null,
          last_error: null,
        },
      })
    } catch {
      await service.updateManagedMedias({
        selector: { id: record.id },
        data: {
          status: MANAGED_MEDIA_STATUS.DELETE_FAILED,
          last_error: "File Module deletion failed",
        },
      })
    }
  }
}
