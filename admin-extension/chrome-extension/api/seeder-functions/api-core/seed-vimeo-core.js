const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const ytdlp = require("yt-dlp-exec");

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
const embedModel = process.env.SEED_VIMEO_EMBED_MODEL || "text-embedding-3-small";
const AUDIO_BASE_DIR = path.join(os.tmpdir(), "dialogue-seed-vimeo");
const CHUNK_THRESHOLD = Number(process.env.SEED_VIMEO_CHUNK_SIZE || 1000);

if (!fs.existsSync(AUDIO_BASE_DIR)) {
  fs.mkdirSync(AUDIO_BASE_DIR, { recursive: true });
}

const fetchPendingDocument = async () => {
  const { data, error } = await supabase
    .from("provider_documents")
    .select("id, provider_id, source_url, title")
    .eq("is_active", false)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data || null;
};

const markDocumentActive = async (documentId) => {
  await supabase.from("provider_documents").update({ is_active: true }).eq("id", documentId);
};

const downloadAudio = async (videoUrl) => {
  const sessionDir = path.join(AUDIO_BASE_DIR, crypto.randomUUID());
  fs.mkdirSync(sessionDir, { recursive: true });
  const outputPattern = path.join(sessionDir, "%(id)s.%(ext)s");
  await ytdlp(videoUrl, {
    output: outputPattern,
    extractAudio: true,
    audioFormat: "mp3",
    audioQuality: 32,
    cookiesFromBrowser: "chrome",
    noProgress: true,
    noPlaylist: true,
    quiet: true,
    ffmpegLocation: process.env.FFMPEG_PATH,
  });

  const mp3Files = fs.readdirSync(sessionDir).filter((file) => file.endsWith(".mp3"));
  if (!mp3Files.length) {
    throw new Error("yt-dlp did not produce an MP3");
  }
  return { audioPath: path.join(sessionDir, mp3Files[0]), sessionDir };
};

const transcribeAudio = async (audioPath) => {
  const stream = fs.createReadStream(audioPath);
  const transcript = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: stream,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });
  return transcript.segments || [];
};

const chunkSegments = (segments = []) => {
  const chunks = [];
  let buffer = "";
  let timestampStart = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const text = (segment.text ?? segment["text"] ?? "").trim();
    const start = Number(segment.start ?? segment["start"] ?? 0);
    const end = Number(segment.end ?? segment["end"] ?? start);
    if (!text) continue;
    if (!buffer) {
      timestampStart = start;
    }
    buffer += `${text} `;
    const atEnd = i === segments.length - 1;
    if (buffer.length >= CHUNK_THRESHOLD || atEnd) {
      chunks.push({
        text: buffer.trim(),
        timestampStart: Math.floor(timestampStart),
        timestampEnd: Math.floor(end),
      });
      buffer = "";
    }
  }
  return chunks;
};

const embedChunks = async (chunks) => {
  if (!chunks.length) return [];
  const embeddings = [];
  const batchSize = 16;
  const chunkTexts = chunks.map((chunk) => chunk.text);
  for (let i = 0; i < chunkTexts.length; i += batchSize) {
    const batch = chunkTexts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: embedModel,
      input: batch,
    });
    embeddings.push(...response.data.map((item) => item.embedding));
  }
  return embeddings;
};

const cleanUpSession = (sessionDir) => {
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch (error) {
    console.warn("[seed-vimeo-core] cleanup failed", error.message);
  }
};

const insertKnowledge = async (document, chunks, embeddings) => {
  if (!chunks.length || !embeddings.length) return [];
  const payload = chunks.map((chunk, idx) => ({
    provider_id: document.provider_id,
    document_id: document.id,
    content: chunk.text,
    embedding: embeddings[idx],
    chunk_index: idx,
    metadata: {
      source: document.source_url,
      timestampStart: chunk.timestampStart,
      timestampEnd: chunk.timestampEnd,
    },
  }));
  const { data, error } = await supabase.from("provider_knowledge").insert(payload).select("id,chunk_index");
  if (error) {
    throw error;
  }
  return data || [];
};

const runNextVideo = async () => {
  const pending = await fetchPendingDocument();
  if (!pending) {
    return { ok: false, message: "No pending documents" };
  }
  let session;
  try {
    session = await downloadAudio(pending.source_url);
    const segments = await transcribeAudio(session.audioPath);
    if (!segments.length) {
      throw new Error("No transcript segments returned");
    }
    const chunks = chunkSegments(segments);
    if (!chunks.length) {
      throw new Error("No chunks generated");
    }
    const embeddings = await embedChunks(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding mismatch");
    }
    const inserted = await insertKnowledge(pending, chunks, embeddings);
    await markDocumentActive(pending.id);
    return {
      ok: true,
      inserted: inserted.length,
      document: pending,
    };
  } finally {
    if (session) {
      cleanUpSession(session.sessionDir);
    }
  }
};

module.exports = {
  runNextVideo,
  fetchPendingDocument,
};
