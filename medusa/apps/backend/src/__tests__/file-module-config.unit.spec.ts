describe("R2 File Module configuration", () => {
  const requiredEnvironment = {
    R2_FILE_URL: "https://images.example.test",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_BUCKET: "test-media",
    R2_ENDPOINT: "https://test-account.r2.cloudflarestorage.com",
  }

  beforeEach(() => {
    jest.resetModules()
    Object.assign(process.env, requiredEnvironment)
  })

  it("registers the Medusa S3 provider for R2 without S3 ACLs", () => {
    const config = require("../../medusa-config")
    const fileModule = Object.values(config.modules).find(
      (module: { resolve: string }) => module.resolve === "@medusajs/medusa/file"
    )

    expect(fileModule).toEqual({
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: requiredEnvironment.R2_FILE_URL,
              access_key_id: requiredEnvironment.R2_ACCESS_KEY_ID,
              secret_access_key: requiredEnvironment.R2_SECRET_ACCESS_KEY,
              region: "auto",
              bucket: requiredEnvironment.R2_BUCKET,
              endpoint: requiredEnvironment.R2_ENDPOINT,
              prefix: "uploads/",
              cache_control: "public, max-age=31536000, immutable",
              acl: false,
            },
          },
        ],
      },
    })
  })
})

import {
  MAX_ADMIN_IMAGE_SIZE_BYTES,
  MAX_ADMIN_IMAGE_UPLOADS,
  validateAdminImageUpload,
} from "../api/middlewares"

describe("Admin image upload policy", () => {
  const response = {} as any

  const validate = (files: { mimetype: string; size: number }[]) => {
    const next = jest.fn()
    validateAdminImageUpload({ files } as any, response, next)
    return next
  }

  it("accepts JPEG, PNG, and WebP images within the configured limit", () => {
    const next = validate([
      { mimetype: "image/jpeg", size: MAX_ADMIN_IMAGE_SIZE_BYTES },
      { mimetype: "image/png", size: 1024 },
      { mimetype: "image/webp", size: 1024 },
    ])

    expect(next).toHaveBeenCalledWith()
  })

  it("rejects unsupported image types", () => {
    const next = validate([{ mimetype: "image/gif", size: 1024 }])

    expect(next.mock.calls[0][0].message).toBe("Only JPEG, PNG, and WebP images can be uploaded.")
  })

  it("rejects files over 1 MB", () => {
    const next = validate([{ mimetype: "image/png", size: MAX_ADMIN_IMAGE_SIZE_BYTES + 1 }])

    expect(next.mock.calls[0][0].message).toBe("Each image must be 1 MB or smaller.")
  })

  it("rejects batches over ten files", () => {
    const next = validate(Array.from({ length: MAX_ADMIN_IMAGE_UPLOADS + 1 }, () => ({
      mimetype: "image/png",
      size: 1024,
    })))

    expect(next.mock.calls[0][0].message).toBe("A maximum of 10 images can be uploaded at once.")
  })
})
