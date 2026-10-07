import "dotenv/config";
import OpenAI from "openai";

async function run() {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const groq = new OpenAI({
    apiKey: groqKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const groqModels = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
  console.log("=== BENCHMARKING GROQ MODELS (STREAMING) ===");
  for (const m of groqModels) {
    const t0 = Date.now();
    let ttft = null;
    let tokens = 0;
    try {
      const stream = await groq.chat.completions.create({
        model: m,
        messages: [{ role: "user", content: "Say hello in 3 words" }],
        stream: true,
        max_tokens: 50,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text && ttft === null) ttft = Date.now() - t0;
        if (text) tokens++;
      }
      const total = Date.now() - t0;
      console.log(`Model: ${m.padEnd(22)} | TTFT: ${String(ttft).padStart(4)}ms | Total: ${String(total).padStart(4)}ms | Tokens: ${tokens} | Status: OK`);
    } catch (e) {
      console.log(`Model: ${m.padEnd(22)} | FAILED: ${e.message}`);
    }
  }

  console.log("\n=== BENCHMARKING GEMINI MODELS (STREAMING) ===");
  const geminiModels = ["gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-3.8-flash"];
  for (const m of geminiModels) {
    const t0 = Date.now();
    let ttft = null;
    let tokens = 0;
    try {
      const payload = {
        contents: [{ role: "user", parts: [{ text: "Say hello in 3 words" }] }],
        generationConfig: { maxOutputTokens: 50 }
      };
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000)
      });
      if (!resp.ok) {
        console.log(`Model: ${m.padEnd(26)} | FAILED: HTTP ${resp.status}`);
        continue;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const l of lines) {
          if (l.trim().startsWith("data:")) {
            const str = l.trim().slice(5).trim();
            if (str && str !== "[DONE]") {
              try {
                const parsed = JSON.parse(str);
                const txt = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (txt && ttft === null) ttft = Date.now() - t0;
                if (txt) tokens++;
              } catch {}
            }
          }
        }
      }
      const total = Date.now() - t0;
      console.log(`Model: ${m.padEnd(26)} | TTFT: ${String(ttft).padStart(4)}ms | Total: ${String(total).padStart(4)}ms | Chunks: ${tokens} | Status: OK`);
    } catch (e) {
      console.log(`Model: ${m.padEnd(26)} | FAILED: ${e.message}`);
    }
  }
}

run();
