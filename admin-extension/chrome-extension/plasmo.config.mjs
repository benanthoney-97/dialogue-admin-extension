import { promises as fs } from "fs"
import path from "path"

export default {
  onGenerateBundle: async ({ buildDir }) => {
    const sourceDir = path.resolve("public/static")
    const targetDir = path.join(buildDir, "static")
    await fs.mkdir(targetDir, { recursive: true })
    let entries
    try {
      entries = await fs.readdir(sourceDir)
    } catch (error) {
      console.warn("[plasmo] static source directory missing", sourceDir, error)
      return
    }
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry)
      const targetPath = path.join(targetDir, entry)
      const stat = await fs.stat(sourcePath)
      if (stat.isDirectory()) continue
      await fs.copyFile(sourcePath, targetPath)
    }
  },
}
