/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiVoice, VoiceStyle, TextPreset } from "./types";

export const GEMINI_VOICES: GeminiVoice[] = [
  {
    id: "Kore",
    name: "Kore",
    gender: "Female",
    description: "Warm, expressive, and friendly. Great for storytelling and casual audio.",
    language: "English / Neutral",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "Male",
    description: "Gentle, soothing, and approachable. Excellent for podcasts and conversations.",
    language: "English / Neutral",
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "Male",
    description: "Deep, professional, and authoritative. Perfect for news, narration, and formal content.",
    language: "English / Neutral",
  },
  {
    id: "Puck",
    name: "Puck",
    gender: "Female",
    description: "Playful, bright, and highly dynamic. Ideal for lighthearted or animated text.",
    language: "English / Neutral",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "Male",
    description: "Rich, resonant, and cinematic. Lends gravity and dramatic force to any speech.",
    language: "English / Neutral",
  },
  {
    id: "Kore-Hindi",
    name: "Kore (Hindi Female)",
    gender: "Female",
    description: "Warm, sweet, and expressive. Optimized for beautiful Indian Hindi storytelling and casual conversation.",
    language: "Indian Hindi (हिन्दी)",
  },
  {
    id: "Zephyr-Hindi",
    name: "Zephyr (Hindi Male)",
    gender: "Male",
    description: "Gentle, clear, and polite. Ideal for natural podcasts and informative narration in Indian Hindi.",
    language: "Indian Hindi (हिन्दी)",
  },
];

export const VOICE_STYLES: VoiceStyle[] = [
  { id: "default", name: "Default Neutral", description: "Standard natural narration style." },
  { id: "cheerfully", name: "Cheerful", description: "Bright, positive, and enthusiastic." },
  { id: "dramatically", name: "Dramatic", description: "Emotionally intense and deliberate." },
  { id: "whisper", name: "Whispered", description: "Quiet, intimate, and close." },
  { id: "sarcastically", name: "Sarcastic", description: "Ironical, witty, and cynical." },
  { id: "excitedly", name: "Excited", description: "Energetic, fast-paced, and thrilled." },
  { id: "professionally", name: "Professional", description: "Polished, steady, and clear." },
  { id: "calmly", name: "Calm", description: "Peaceful, soft, and comforting." },
];

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "speech-dream",
    label: "I Have a Dream",
    category: "Speeches",
    text: "I have a dream that one day this nation will rise up and live out the true meaning of its creed: We hold these truths to be self-evident, that all men are created equal.",
  },
  {
    id: "story-space",
    label: "Sci-Fi Opening",
    category: "Storytelling",
    text: "The engine hummed a low, vibrating chord through the deck plates of the Star Chaser. Beyond the panoramic screen, the rings of Saturn glowed like a cosmic halo of gold and dust. Pilot Vance checked the dials, took a deep breath, and prepared to jump into the unknown.",
  },
  {
    id: "twister-wood",
    label: "Woodchuck Twister",
    category: "Tongue Twisters",
    text: "How much wood would a woodchuck chuck if a woodchuck could chuck wood? He would chuck, he would, as much as he could, and chuck as much wood as a woodchuck would if a woodchuck could chuck wood.",
  },
  {
    id: "twister-sea",
    label: "Seashells Twister",
    category: "Tongue Twisters",
    text: "She sells seashells by the seashore. The seashells she sells are seashells, she is sure. So if she sells seashells by the seashore, then I am sure she sells seashore shells.",
  },
  {
    id: "announcement-flight",
    label: "Airport Announcement",
    category: "Announcements",
    text: "Good afternoon, passengers. This is the pre-boarding announcement for Star Flight 402 with non-stop service to Tokyo. Please have your boarding passes and passports ready at gate 15B. We will begin boarding shortly.",
  },
  {
    id: "joke-programmer",
    label: "Programmer Wisdom",
    category: "Humor",
    text: "There are 10 types of people in this world: those who understand binary, and those who don't. And those who didn't expect a base 3 joke.",
  },
  {
    id: "hindi-welcome",
    label: "औपचारिक स्वागत (Formal Welcome)",
    category: "Hindi हिन्दी",
    text: "नमस्कार देवियों और सज्जनों, वॉयस स्टूडियो में आपका हार्दिक स्वागत है। आज हम अत्याधुनिक एआई तकनीक की मदद से हिंदी भाषा में उच्च गुणवत्ता वाली और अत्यंत मधुर ध्वनि उत्पन्न कर रहे हैं।",
  },
  {
    id: "hindi-story",
    label: "सुंदर कहानी (Hindi Story)",
    category: "Hindi हिन्दी",
    text: "एक समय की बात है, एक शांत और सुंदर गाँव में राम नाम का एक किसान रहता था। उसके पास एक छोटा सा खेत था, जहाँ वह पूरी मेहनत और ईमानदारी से काम करता था। एक दिन उसे अपने खेत में सोने के सिक्कों से भरा एक पुराना मटका मिला। राम ने उस धन का उपयोग गाँव के स्कूल को बेहतर बनाने के लिए किया।",
  },
];
