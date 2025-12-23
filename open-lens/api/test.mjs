// api/test.mjs
export default function handler(req, res) {
  res.status(200).json({ status: "Alive", message: "Vercel is executing code!" });
}