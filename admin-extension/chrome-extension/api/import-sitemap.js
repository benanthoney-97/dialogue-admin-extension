const { doImport } = require("./seeder-functions/api-core/import-sitemap-core");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }
  const body = await req.json().catch(() => ({}));
  const indexUrl = body?.indexUrl || req.query?.indexUrl;
  const providerIdValue = body?.providerId ?? req.query?.providerId;
  const providerId = providerIdValue ? Number(providerIdValue) : null;
  console.log("[import-sitemap] providerId parameter:", providerIdValue, providerId);
  try {
    const result = await doImport(indexUrl, providerId);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({ error: error.message || "Import failed" });
  }
}
