const { doImport } = require("../local_functions/import-sitemap-core");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }
  const indexUrl = req.body?.indexUrl || req.query?.indexUrl;
  if (!indexUrl) {
    res.status(400).json({ error: "Missing indexUrl parameter" });
    return;
  }
  try {
    await doImport(indexUrl);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({ error: error.message || "Import failed" });
  }
}
