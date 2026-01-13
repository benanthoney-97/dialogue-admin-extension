const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { OpenAI } = require("openai");
const dotenv = require("dotenv");

const dotenvPath = path.resolve(__dirname, "../../../../.env");
dotenv.config({ path: dotenvPath });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PLASMO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
  throw new Error("Missing Supabase or OpenAI credentials for Vimeo seeder");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const YTDLP_PATH = require.resolve("@yt-dlp/yt-dlp");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const OUTPUT_DIR = path.resolve(path.dirname(YTDLP_PATH), "../../audio_cache");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const embedModel = "text-embedding-3-small";

const fetchPendingDocument = async () => {
  const { data, error } = await supabase
    .from("provider_documents")
    .select("id,title,source_url")
    .eq("is_active", false)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const markDocumentActive = async (documentId) => {
  await supabase.from("provider_documents").update({ is_active: true }).eq("id", documentId);
};

const downloadAudio = (url, outputPath) =>
  new Promise((resolve, reject) => {
    const args = ["-x", "--audio-format", "mp3", "--audio-quality", "32", "--cookies-from-browser", "chrome", "-o", outputPath, url];
    const child = spawn("yt-dlp", args, { stdio: "inherit" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("yt-dlp failed"))));
    child.on("error", reject);
  });

const embedText = async (text) => {
  const response = await openai.embeddings.create({
    model: embedModel,
    input: [text],
  });
  return response.data[0].embedding;
};

const insertChunks = async (documentId, videoUrl, chunks) => {
  if (!chunks.length) return [];
  const { data, error } = await supabase
    .from("provider_knowledge")
    .insert(
      chunks.map((chunk, index) => ({
        provider_id: chunk.provider_id,
        document_id: documentId,
        content: chunk.text,
        embedding: chunk.embedding,
        metadata: { source: videoUrl, chunk_index: index },
      }))
    )
    .select("id");
  if (error) throw error;
  return data || [];
};

module.exports = {
  fetchPendingDocument,
  markDocumentActive,
  downloadAudio,
  embedText,
  insertChunks,
};
