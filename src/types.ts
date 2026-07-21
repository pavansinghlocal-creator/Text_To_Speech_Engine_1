/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TtsEngine = "gemini" | "browser";

export interface GeminiVoice {
  id: string;
  name: string;
  gender: "Male" | "Female";
  description: string;
  language?: string;
}

export interface BrowserVoice {
  name: string;
  lang: string;
  voiceURI: string;
}

export interface VoiceStyle {
  id: string;
  name: string;
  description: string;
}

export interface HistoryItem {
  id: string;
  text: string;
  engine: TtsEngine;
  voiceName: string;
  styleName?: string;
  timestamp: string;
  duration?: string; // e.g., "0:04"
  audioBase64?: string; // Cached audio base64 for Gemini TTS if fits, or WAV object URL (temporary in-memory)
}

export interface TextPreset {
  id: string;
  label: string;
  category: string;
  text: string;
}
