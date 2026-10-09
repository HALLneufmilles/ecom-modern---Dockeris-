#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const MAX_FILES_PER_REQUEST = 10
const MAX_FILE_SIZE_BYTES = 1024 * 1024

const usage = `Usage:
  node scripts/upload-catalog-media.mjs <image-directory> [--endpoint <url>] [--output <csv-path>] [--retry-pending]

Authentication (choose one):
  MEDUSA_ADMIN_TOKEN             Existing Medusa Admin bearer token.
  MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD
                                 Credentials used only to request a bearer token from
                                 POST /auth/user/emailpass.
`

const fail = (message) => {
  throw new Error(message)
}

const parseArgs = (args) => {
  const options = {
    directory: undefined,
    endpoint: process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000",
    output: undefined,
    retryPending: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === "--help" || argument === "-h") {
      console.log(usage)
      process.exit(0)
    }

    if (argument === "--retry-pending") {
      options.retryPending = true
      continue
    }

    if (argument === "--endpoint" || argument === "--output") {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) {
        fail(`Missing value for ${argument}.`)
      }
      options[argument.slice(2)] = value
      index += 1
      continue
    }

    if (argument.startsWith("--")) {
      fail(`Unknown option: ${argument}`)
    }

    if (options.directory) {
      fail("Only one image directory can be provided.")
    }
    options.directory = argument
  }

  if (!options.directory) {
    fail("An image directory is required.\n\n" + usage)
  }

  return options
}

const csvEscape = (value) => `"${String(value).replaceAll('"', '""')}"`

const serializeCsv = (records) => [
  "fichier,file_id,url",
  ...records.map((record) => [record.file, record.fileId, record.url]
    .map(csvEscape)
    .join(",")),
  "",
].join("\n")

const parseCsv = (content) => {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]

    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === ",") {
      row.push(field)
      field = ""
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""))
      if (row.some((value) => value.length > 0)) {
        rows.push(row)
      }
      row = []
      field = ""
    } else {
      field += character
    }
  }

  if (quoted) {
    fail("The existing CSV has an unterminated quoted field.")
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

const readCsvRecords = async (csvPath) => {
  try {
    const rows = parseCsv(await readFile(csvPath, "utf8"))
    if (!rows.length) {
      return []
    }

    const [header, ...dataRows] = rows
    if (header.join(",") !== "fichier,file_id,url") {
      fail(`Unexpected CSV header in ${csvPath}. Expected fichier,file_id,url.`)
    }

    const records = dataRows.map((row, rowIndex) => {
      if (row.length !== 3 || row.some((value) => !value)) {
        fail(`Invalid CSV row ${rowIndex + 2} in ${csvPath}.`)
      }
      return { file: row[0], fileId: row[1], url: row[2] }
    })

    const duplicate = records.find((record, index) => (
      records.findIndex(({ file }) => file === record.file) !== index
    ))
    if (duplicate) {
      fail(`Duplicate local filename in ${csvPath}: ${duplicate.file}`)
    }

    return records
  } catch (error) {
    if (error?.code === "ENOENT") {
      return []
    }
    throw error
  }
}

const writeCsvRecords = async (csvPath, records) => {
  await mkdir(path.dirname(csvPath), { recursive: true })
  const temporaryPath = `${csvPath}.tmp`
  await writeFile(temporaryPath, serializeCsv(records), "utf8")
  await rename(temporaryPath, csvPath)
}

const discoverWebpFiles = async (directory) => {
  const files = []
  let subdirectories = 0

  const visitDirectory = async (currentDirectory) => {
    const entries = await readdir(currentDirectory, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        subdirectories += 1
        await visitDirectory(entryPath)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".webp")) {
        files.push({ name: entry.name, path: entryPath })
      }
    }
  }

  await visitDirectory(directory)
  files.sort((left, right) => left.name.localeCompare(right.name))

  const filesByName = new Map()
  for (const file of files) {
    const existing = filesByName.get(file.name)
    if (existing) {
      fail(`Duplicate local filename detected: ${file.name} in ${existing} and ${file.path}.`)
    }
    filesByName.set(file.name, file.path)
  }

  for (const file of files) {
    const details = await stat(file.path)
    if (details.size > MAX_FILE_SIZE_BYTES) {
      fail(`${file.name} exceeds the F-19 limit of 1 MiB.`)
    }
  }

  return { files, subdirectories }
}

const authenticate = async (endpoint) => {
  if (process.env.MEDUSA_ADMIN_TOKEN) {
    return process.env.MEDUSA_ADMIN_TOKEN
  }

  const email = process.env.MEDUSA_ADMIN_EMAIL
  const password = process.env.MEDUSA_ADMIN_PASSWORD
  if (!email || !password) {
    fail("Set MEDUSA_ADMIN_TOKEN, or both MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD.")
  }

  const response = await fetch(new URL("/auth/user/emailpass", endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => undefined)

  if (!response.ok || !body || typeof body.token !== "string") {
    fail(`Admin authentication failed (${response.status}).`)
  }

  return body.token
}

const uploadBatch = async ({ endpoint, token, batch }) => {
  const form = new FormData()

  for (const file of batch) {
    const content = await readFile(file.path)
    form.append("files", new Blob([content], { type: "image/webp" }), file.name)
  }

  const response = await fetch(new URL("/admin/uploads", endpoint), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const body = await response.json().catch(() => undefined)

  if (!response.ok) {
    const message = body?.message || body?.type || "Unknown Medusa error"
    fail(`Upload failed (${response.status}): ${message}`)
  }

  if (!body || !Array.isArray(body.files) || body.files.length !== batch.length) {
    fail("Medusa returned an invalid upload response: the returned file count does not match the batch.")
  }

  return body.files.map((file, index) => {
    if (!file || typeof file.id !== "string" || typeof file.url !== "string") {
      fail(`Medusa returned an invalid upload entry for ${batch[index].name}.`)
    }
    return {
      file: batch[index].name,
      fileId: file.id,
      url: file.url,
    }
  })
}

const writePendingJournal = async (journalPath, batch, endpoint) => {
  await writeFile(journalPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    endpoint,
    files: batch.map(({ name }) => name),
  }, null, 2) + "\n", "utf8")
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const directory = path.resolve(options.directory)
  const outputPath = path.resolve(options.output || path.join(directory, "medusa-upload-map.csv"))
  const journalPath = `${outputPath}.pending.json`
  const summary = { detected: 0, uploaded: 0, alreadyProcessed: 0, errors: 0 }

  try {
    const directoryDetails = await stat(directory)
    if (!directoryDetails.isDirectory()) {
      fail(`${directory} is not a directory.`)
    }

    try {
      await stat(journalPath)
      if (!options.retryPending) {
        fail(`An unresolved upload journal exists at ${journalPath}. Its last batch may have reached Medusa; inspect it and rerun explicitly with --retry-pending only if retrying is acceptable.`)
      }
      console.warn(`Retrying the unresolved batch recorded in ${journalPath}.`)
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error
      }
    }

    const { files, subdirectories } = await discoverWebpFiles(directory)
    summary.detected = files.length
    console.log(`WebP files detected: ${files.length}`)
    console.log(`Subdirectories traversed: ${subdirectories}`)
    if (!files.length) {
      fail(`No WebP files found in ${directory} or its subdirectories.`)
    }

    const records = await readCsvRecords(outputPath)
    const recordedFiles = new Set(records.map(({ file }) => file))
    const pendingFiles = files.filter((file) => !recordedFiles.has(file.name))
    summary.alreadyProcessed = files.length - pendingFiles.length

    if (!pendingFiles.length) {
      await writeCsvRecords(outputPath, records)
      return { outputPath, summary }
    }

    const token = await authenticate(options.endpoint)
    for (let start = 0; start < pendingFiles.length; start += MAX_FILES_PER_REQUEST) {
      const batch = pendingFiles.slice(start, start + MAX_FILES_PER_REQUEST)
      await writePendingJournal(journalPath, batch, options.endpoint)
      const uploadedRecords = await uploadBatch({ endpoint: options.endpoint, token, batch })
      records.push(...uploadedRecords)
      await writeCsvRecords(outputPath, records)
      await rm(journalPath)
      summary.uploaded += uploadedRecords.length
      console.log(`Uploaded ${summary.uploaded}/${pendingFiles.length} pending files.`)
    }

    return { outputPath, summary }
  } catch (error) {
    summary.errors += 1
    console.error(`Upload batch failed: ${error.message}`)
    process.exitCode = 1
    return { outputPath, summary }
  } finally {
    console.log("\nSummary")
    console.log(`- Files detected: ${summary.detected}`)
    console.log(`- Files uploaded: ${summary.uploaded}`)
    console.log(`- Files already processed: ${summary.alreadyProcessed}`)
    console.log(`- Errors: ${summary.errors}`)
    console.log(`- CSV: ${outputPath}`)
  }
}

await main()
