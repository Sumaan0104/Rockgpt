import "dotenv/config";

async function testGemini() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const models = [
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash"
  ];

  console.log("=== TESTING GEMINI CANDIDATES ===");
  for (const m of models) {
    const t0 = Date.now();
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Say hi" }] }] }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const data = await resp.json();
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(
        m.padEnd(26),
        `Status: ${resp.status}`,
        `Time: ${(Date.now() - t0).toString().padStart(4)}ms`,
        `Reply: ${txt ? txt.trim().slice(0, 30) : (data.error?.message || "none")}`
      );
    } catch (e) {
      console.log(m.padEnd(26), "Error:", e.message);
    }
  }
}

testGemini();
