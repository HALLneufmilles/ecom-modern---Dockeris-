import { defineMiddlewares, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { deleteFilesWorkflow } from "@medusajs/medusa/core-flows"
import {
  getUploadedFilesFromResponse,
  registerManagedUploadsWithCompensation,
} from "../modules/managed-media/lifecycle"
import {
  MANAGED_MEDIA_MODULE,
} from "../modules/managed-media"
import type ManagedMediaModuleService from "../modules/managed-media/service"

export const MAX_ADMIN_IMAGE_UPLOADS = 10
export const MAX_ADMIN_IMAGE_SIZE_BYTES = 1024 * 1024

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

type UploadedFile = {
  mimetype: string
  size: number
}

export const validateAdminImageUpload = (
  req: MedusaRequest & { files?: UploadedFile[] },
  _: MedusaResponse,
  next: (error?: Error) => void
) => {
  const files = req.files

  if (!Array.isArray(files)) {
    return next()
  }

  if (files.length > MAX_ADMIN_IMAGE_UPLOADS) {
    return next(new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `A maximum of ${MAX_ADMIN_IMAGE_UPLOADS} images can be uploaded at once.`
    ))
  }

  for (const file of files) {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      return next(new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Only JPEG, PNG, and WebP images can be uploaded."
      ))
    }

    if (file.size > MAX_ADMIN_IMAGE_SIZE_BYTES) {
      return next(new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Each image must be 1 MB or smaller."
      ))
    }
  }

  return next()
}

export const trackAdminImageUploads = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: (error?: unknown) => void
) => {
  const originalJson = res.json.bind(res)

  res.json = ((body: unknown) => {
    const files = res.statusCode < 400
      ? getUploadedFilesFromResponse(body)
      : []

    if (!files.length) {
      return originalJson(body)
    }

    const managedMediaService = req.scope.resolve(
      MANAGED_MEDIA_MODULE
    ) as ManagedMediaModuleService

    void registerManagedUploadsWithCompensation(
      managedMediaService,
      files,
      async (fileIds) => {
        await deleteFilesWorkflow(req.scope).run({
          input: { ids: fileIds },
        })
      }
    )
      .then(() => originalJson(body))
      .catch((error) => next(error))

    return res
  }) as typeof res.json

  return next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/hooks/stripe-checkout",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
    {
      matcher: "/admin/uploads",
      method: "POST",
      middlewares: [validateAdminImageUpload, trackAdminImageUploads],
    },
  ],
})
