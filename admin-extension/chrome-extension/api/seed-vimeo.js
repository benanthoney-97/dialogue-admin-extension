const { spawn } = require("child_process");
const path = require("path");

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const SEED_VIMEO_SCRIPT = path.join(__dirname, "..", "..", "document-seeder", "local_functions", "seed-vimeo.py");

async function runPythonSeeder() {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [SEED_VIMEO_SCRIPT], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`seed-vimeo exited ${code}\n${stderr}`));
      }
    });
    child.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }
  try {
    const result = await runPythonSeeder();
    res.status(200).json({
      ok: true,
      message: "seed-vimeo.py completed",
      output: result.stdout,
    });
  } catch (error) {
    console.error("[seed-vimeo] failed", error);
    res.status(500).json({
      error: error.message,
    });
  }
}
