import {
  getUploadedFilesFromResponse,
  MANAGED_MEDIA_STATUS,
  reconcileManagedProductMedia,
  registerManagedUploads,
  registerManagedUploadsWithCompensation,
  type ManagedMediaRecord,
  type ManagedMediaService,
} from "../lifecycle"

const record = (
  overrides: Partial<ManagedMediaRecord> = {}
): ManagedMediaRecord => ({
  id: "mmedia_1",
  file_id: "uploads/old-file.webp",
  url: "https://media.example.test/uploads/old-file.webp",
  status: MANAGED_MEDIA_STATUS.ASSOCIATED,
  product_id: "prod_1",
  product_image_id: "img_1",
  last_error: null,
  deletion_attempts: 0,
  ...overrides,
})

const createService = ({
  pending = [],
  associated = [],
}: {
  pending?: ManagedMediaRecord[]
  associated?: ManagedMediaRecord[]
} = {}) => ({
  createManagedMedias: jest.fn().mockResolvedValue([]),
  listManagedMedias: jest.fn().mockImplementation((filters) => (
    filters.status === MANAGED_MEDIA_STATUS.PENDING
      ? Promise.resolve(pending)
      : Promise.resolve(associated)
  )),
  updateManagedMedias: jest.fn().mockResolvedValue([]),
}) as jest.Mocked<ManagedMediaService>

describe("managed media lifecycle", () => {
  it("extracts only valid File Module results from the native upload response", () => {
    expect(getUploadedFilesFromResponse({
      files: [
        { id: "uploads/image.webp", url: "https://media.example/image.webp" },
        { id: 42, url: "invalid" },
      ],
    })).toEqual([
      { id: "uploads/image.webp", url: "https://media.example/image.webp" },
    ])
  })

  it("registers the File Module id without parsing the URL", async () => {
    const service = createService()

    await registerManagedUploads(service, [{
      id: "uploads/image.webp",
      url: "https://media.example/image.webp",
    }])

    expect(service.createManagedMedias).toHaveBeenCalledWith([{
      file_id: "uploads/image.webp",
      url: "https://media.example/image.webp",
      status: MANAGED_MEDIA_STATUS.PENDING,
    }])
  })

  it("compensates an upload when its pending registry entry cannot be stored", async () => {
    const service = createService()
    service.createManagedMedias.mockRejectedValueOnce(new Error("database failure"))
    const deleteFiles = jest.fn().mockResolvedValue(undefined)
    const files = [{
      id: "uploads/orphan.webp",
      url: "https://media.example/orphan.webp",
    }]

    await expect(registerManagedUploadsWithCompensation(
      service,
      files,
      deleteFiles
    )).rejects.toThrow("database failure")

    expect(deleteFiles).toHaveBeenCalledWith(["uploads/orphan.webp"])
  })

  it("associates a pending upload after the Product save event", async () => {
    const pending = record({
      status: MANAGED_MEDIA_STATUS.PENDING,
      product_id: null,
      product_image_id: null,
    })
    const service = createService({ pending: [pending] })

    await reconcileManagedProductMedia({
      productId: "prod_1",
      references: [{ url: pending.url, productImageId: "img_new" }],
      service,
      isStillReferenced: jest.fn(),
      deleteFiles: jest.fn(),
    })

    expect(service.updateManagedMedias).toHaveBeenCalledWith({
      selector: { id: pending.id },
      data: expect.objectContaining({
        status: MANAGED_MEDIA_STATUS.ASSOCIATED,
        product_id: "prod_1",
        product_image_id: "img_new",
      }),
    })
  })

  it("deletes a dissociated managed file only after reconciliation", async () => {
    const associated = record()
    const service = createService({ associated: [associated] })
    const deleteFiles = jest.fn().mockResolvedValue(undefined)

    await reconcileManagedProductMedia({
      productId: "prod_1",
      references: [],
      service,
      isStillReferenced: jest.fn().mockResolvedValue(false),
      deleteFiles,
    })

    expect(deleteFiles).toHaveBeenCalledWith([associated.file_id])
    expect(service.updateManagedMedias).toHaveBeenLastCalledWith({
      selector: { id: associated.id },
      data: expect.objectContaining({
        status: MANAGED_MEDIA_STATUS.DELETION_REQUESTED,
      }),
    })
  })

  it("never deletes a file that another Product still references", async () => {
    const associated = record()
    const service = createService({ associated: [associated] })
    const deleteFiles = jest.fn()

    await reconcileManagedProductMedia({
      productId: "prod_1",
      references: [],
      service,
      isStillReferenced: jest.fn().mockResolvedValue(true),
      deleteFiles,
    })

    expect(deleteFiles).not.toHaveBeenCalled()
    expect(service.updateManagedMedias).toHaveBeenCalledWith({
      selector: { id: associated.id },
      data: expect.objectContaining({
        status: MANAGED_MEDIA_STATUS.RETAINED_REFERENCED,
      }),
    })
  })

  it("keeps a failed deletion identifiable and retryable", async () => {
    const associated = record()
    const service = createService({ associated: [associated] })

    await reconcileManagedProductMedia({
      productId: "prod_1",
      references: [],
      service,
      isStillReferenced: jest.fn().mockResolvedValue(false),
      deleteFiles: jest.fn().mockRejectedValue(new Error("provider failure")),
    })

    expect(service.updateManagedMedias).toHaveBeenLastCalledWith({
      selector: { id: associated.id },
      data: expect.objectContaining({
        status: MANAGED_MEDIA_STATUS.DELETE_FAILED,
        last_error: "File Module deletion failed",
      }),
    })
  })
})
