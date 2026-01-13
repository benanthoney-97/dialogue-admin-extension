const { doVimeoSync } = require("./seeder-functions/api-core/vimeo-sync-core");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }
  try {
    await doVimeoSync();
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Vimeo sync failed:", error);
    res.status(500).json({ error: error.message || "Sync failed" });
  }
}
