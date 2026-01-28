const fs = require("fs").promises
const path = require("path")

const STATIC_DIR = path.resolve("public/static")
const TARGET_PLATFORMS = ["chrome-mv3-dev", "chrome-mv3-prod"]

const copyStaticFiles = async () => {
  let entries
  try {
    entries = await fs.readdir(STATIC_DIR)
  } catch (error) {
    console.warn("[copy-static] no static directory to copy", STATIC_DIR, error)
    return
  }
  for (const platform of TARGET_PLATFORMS) {
    const targetDir = path.resolve("build", platform, "static")
    await fs.mkdir(targetDir, { recursive: true })
    for (const entry of entries) {
      const sourcePath = path.join(STATIC_DIR, entry)
      const targetPath = path.join(targetDir, entry)
      const stat = await fs.stat(sourcePath)
      if (!stat.isFile()) continue
      await fs.copyFile(sourcePath, targetPath)
    }
  }
}

copyStaticFiles().catch((error) => {
  console.error("[copy-static] failed to copy static assets", error)
})
