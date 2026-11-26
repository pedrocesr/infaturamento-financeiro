import { validateSummary, generateReport } from "../../server/ai.mjs";

let busy = false;
const calls: number[] = [];

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido."
    });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;

  if (origin && origin !== `https://${host}` &&
      origin !== `http://${host}`) {
    return res.status(403).json({
      error: "Origem não permitida."
    });
  }

  if (!req.headers["content-type"]?.startsWith("application/json")) {
    return res.status(415).json({
      error: "Formato inválido."
    });
  }

  if (busy) {
    return res.status(429).json({
      error: "Já existe uma análise em andamento."
    });
  }

  while (calls.length && calls[0] < Date.now() - 3600000) {
    calls.shift();
  }

  if (calls.length >= 10) {
    return res.status(429).json({
      error: "Limite de análises atingido. Tente novamente mais tarde."
    });
  }

  try {
    const raw = typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {});

    if (Buffer.byteLength(raw) > 16000) {
      return res.status(413).json({
        error: "Resumo acima do tamanho permitido."
      });
    }

    const summary = validateSummary(JSON.parse(raw));

    if (!summary.expenseCents) {
      return res.status(400).json({
        error: "Registre despesas antes de solicitar dicas."
      });
    }

    busy = true;
    calls.push(Date.now());

    try {
      const report = await generateReport(summary, {
        apiKey: process.env.GEMINI_API_KEY || "",
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"
      });

      return res.status(200).json(report);
    } finally {
      busy = false;
    }

  } catch (error: any) {
    return res.status(error.status || 502).json({
      error: error.status
        ? error.message
        : "Não foi possível gerar a análise. Tente novamente."
    });
  }
}