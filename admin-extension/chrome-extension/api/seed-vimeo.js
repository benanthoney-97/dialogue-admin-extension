const { runNextVideo } = require("./seeder-functions/api-core/seed-vimeo-core");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }
  try {
    const result = await runNextVideo();
    if (!result.ok) {
      res.status(200).json(result);
      return;
    }
    res.status(200).json({
      ok: true,
      inserted: result.inserted,
      document: result.document,
    });
  } catch (error) {
    console.error("[seed-vimeo] failed", error);
    res.status(500).json({
      error: error.message || "seed-vimeo failed",
    });
  }
}
