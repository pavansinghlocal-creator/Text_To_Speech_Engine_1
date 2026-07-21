import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini client lazily to avoid crashing on startup if the key is missing.
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it via the Secrets panel in Settings.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// API Routes
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice, style } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required and must be a string." });
    }

    let ttsVoice = voice || "Kore"; // Puck, Charon, Kore, Fenrir, Zephyr
    if (ttsVoice === "Kore-Hindi") {
      ttsVoice = "Kore";
    } else if (ttsVoice === "Zephyr-Hindi") {
      ttsVoice = "Zephyr";
    }
    const ttsStyle = style || "default"; // cheerful, dramatic, calm, whisper, sarcastic, etc.

    // Format prompt to instruct Gemini's TTS engine regarding vocal style/emotion
    let formattedText = text;
    if (ttsStyle !== "default") {
      formattedText = `Say ${ttsStyle}: ${text}`;
    }

    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: formattedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: ttsVoice },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.[0];
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
      console.error("Gemini TTS empty response:", JSON.stringify(response));
      throw new Error("No audio data was returned from the Gemini TTS model.");
    }

    // Return the base64 audio and metadata
    res.json({
      audio: base64Audio,
      format: "pcm",
      sampleRate: 24000,
    });
  } catch (error: any) {
    console.error("Error in /api/tts endpoint:", error);
    res.status(500).json({
      error: error.message || "An unexpected error occurred during TTS audio generation.",
    });
  }
});

app.post("/api/generate-text", async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required and must be a string." });
    }

    const client = getGeminiClient();
    
    // Set a specialized system instruction for optimal vocal reading
    let systemInstruction = "You are an expert copywriter. Write clean, natural, and highly engaging text optimized for being read aloud by a text-to-speech engine. Avoid emojis, special formatting, markdown symbols, and unpronounceable characters. Keep the text under 150 words unless explicitly requested otherwise.";
    
    if (type === "speech") {
      systemInstruction += " Structure it as an eloquent, captivating public speech with natural pauses and elegant flow.";
    } else if (type === "dialogue") {
      systemInstruction += " Structure it as an engaging conversation or narrative monologue.";
    } else if (type === "story") {
      systemInstruction += " Structure it as a short, vivid, and descriptive story with high acoustic imagery.";
    }

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text content returned from the Gemini AI model.");
    }

    res.json({ text: text.trim() });
  } catch (error: any) {
    console.error("Error in /api/generate-text endpoint:", error);
    res.status(500).json({
      error: error.message || "An unexpected error occurred during AI text generation.",
    });
  }
});

// Start the full-stack server
async function startServer() {
  const PORT = 3000;
  const distPath = path.join(process.cwd(), "dist");

  // Vite development middleware vs Static Production files
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
