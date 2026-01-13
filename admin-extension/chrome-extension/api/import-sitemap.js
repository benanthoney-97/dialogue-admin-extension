const { doImport } = require("./seeder-functions/api-core/import-sitemap-core");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }
  const indexUrl = req.body?.indexUrl || req.query?.indexUrl;
  const providerIdValue = req.body?.providerId ?? req.query?.providerId;
  const providerId = providerIdValue ? Number(providerIdValue) : null;
  try {
    const result = await doImport(indexUrl, providerId);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({ error: error.message || "Import failed" });
  }
}
