/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Play,
  Pause,
  Square,
  Download,
  Sparkles,
  History,
  Settings2,
  Trash2,
  Plus,
  RefreshCw,
  Check,
  AlertCircle,
  FileText,
  Copy,
  VolumeX,
  ChevronRight,
  Info,
  Sun,
  Moon
} from "lucide-react";
import { TtsEngine, BrowserVoice, HistoryItem } from "./types";
import { GEMINI_VOICES, VOICE_STYLES, TEXT_PRESETS } from "./data";
import { base64ToPcm, pcmToFloat32, pcmToWavBlob, pcmToMp3Blob } from "./lib/audioHelper";

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem("vox-artisan-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Main states
  const [text, setText] = useState<string>("Welcome to the Voice Studio. Type any text here, select your preferred engine on the right, choose a signature voice, and experience premium speech synthesis.");
  const [engine, setEngine] = useState<TtsEngine>("gemini");
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>("Kore");
  const [selectedGeminiLang, setSelectedGeminiLang] = useState<string>("All");
  const [selectedStyle, setSelectedStyle] = useState<string>("default");
  const [tonePreset, setTonePreset] = useState<string>("flat"); // "flat" | "bass" | "treble" | "warmth" | "radio"

  // Browser TTS specific states
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoiceURI, setSelectedBrowserVoiceURI] = useState<string>("");
  const [browserRate, setBrowserRate] = useState<number>(1.0);
  const [browserPitch, setBrowserPitch] = useState<number>(1.0);
  const [browserVolume, setBrowserVolume] = useState<number>(1.0);

  // AI Text Generator states
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiType, setAiType] = useState<string>("story");
  const [isGeneratingText, setIsGeneratingText] = useState<boolean>(false);
  const [showAiHelper, setShowAiHelper] = useState<boolean>(false);

  // Synthesis and Playback states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBrowserSpeaking, setIsBrowserSpeaking] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [reassuringMessage, setReassuringMessage] = useState<string>("");

  // Playback tracking
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [currentPcmSamples, setCurrentPcmSamples] = useState<Int16Array | null>(null);

  // UI States
  const [copied, setCopied] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>("All");

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Loading message arrays
  const loadingMessages = [
    "Contacting Gemini audio neural network...",
    "Synthesizing high-fidelity audio waves...",
    "Applying semantic vocal emotional style...",
    "Assembling acoustic voice parameters...",
    "Buffering 24kHz raw audio vectors..."
  ];

  // Load browser voices & history from localStorage
  useEffect(() => {
    // History initialization
    try {
      const storedHistory = localStorage.getItem("voice_studio_history");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load synthesis history:", e);
    }

    // Web Speech API voices loading
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setBrowserVoices(voices);
        
        // Try to pre-select a high-quality default local voice
        if (voices.length > 0 && !selectedBrowserVoiceURI) {
          const googleVoice = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"));
          const englishVoice = voices.find(v => v.lang.startsWith("en"));
          const defaultVoice = googleVoice || englishVoice || voices[0];
          setSelectedBrowserVoiceURI(defaultVoice.voiceURI);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Update canvas resting state on mount
  useEffect(() => {
    drawRestingCanvas();
  }, []);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Save history helper
  const saveToHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("voice_studio_history", JSON.stringify(newHistory));
    } catch (e) {
      console.warn("Storage quota exceeded, pruning history cache to fit...", e);
      // Create a copy of the history to prune
      let prunedHistory = [...newHistory];
      let success = false;
      
      // First try: prune audioBase64 from older items one by one
      for (let i = prunedHistory.length - 1; i >= 0; i--) {
        if (prunedHistory[i].audioBase64) {
          prunedHistory[i] = { ...prunedHistory[i], audioBase64: undefined };
          try {
            localStorage.setItem("voice_studio_history", JSON.stringify(prunedHistory));
            success = true;
            setHistory(prunedHistory);
            break;
          } catch (err) {
            // still failing, continue pruning
          }
        }
      }

      // Second try: if still failing, remove older items entirely
      if (!success) {
        while (prunedHistory.length > 0 && !success) {
          prunedHistory.shift(); // remove the oldest item
          try {
            localStorage.setItem("voice_studio_history", JSON.stringify(prunedHistory));
            success = true;
            setHistory(prunedHistory);
          } catch (err) {
            // still failing, continue removing
          }
        }
      }
    }
  };

  // Clear history
  const clearHistory = () => {
    saveToHistory([]);
  };

  // Lazy initialize AudioContext
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Periodic message rotator while loading Gemini AI TTS
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      let idx = 0;
      setReassuringMessage(loadingMessages[0]);
      interval = setInterval(() => {
        idx = (idx + 1) % loadingMessages.length;
        setReassuringMessage(loadingMessages[idx]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Stop currently playing sounds
  const stopPlayback = () => {
    // 1. Stop Gemini Audio Node
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // 2. Stop Browser Native Speech Synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // 3. Clear visualizer frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsPlaying(false);
    setIsBrowserSpeaking(false);
    drawRestingCanvas();
  };

  // Draw smooth default resting flatline on canvas
  const drawRestingCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = "rgba(107, 114, 128, 0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  // Unified visualizer drawing loops
  const startCanvasVisualizer = (analyser: AnalyserNode | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let phase = 0;

    const draw = () => {
      if (!canvas || !ctx) return;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser) {
        // --- REAL SPECTRUM VISUALIZATION (Gemini Audio Node) ---
        analyser.getByteFrequencyData(dataArray);

        const barCount = bufferLength / 1.5;
        const barWidth = (width / barCount);
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          // Normalize height between 0 and 80% canvas height
          const sample = dataArray[i];
          const barHeight = (sample / 255) * (height * 0.85);

          // Sleek electric glow gradient
          const grad = ctx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, "rgba(212, 175, 55, 0.15)"); // gold-accent
          grad.addColorStop(0.5, "rgba(212, 175, 55, 0.75)"); // main gold
          grad.addColorStop(1, "rgba(255, 230, 150, 1)"); // bright gold

          ctx.fillStyle = grad;
          const y = (height - barHeight) / 2;
          
          // Draw rounded bars
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - 3, barHeight, 4);
          ctx.fill();

          x += barWidth;
        }
      } else {
        // --- ORGANIC SINE RIPPLE WAVE (Browser Local Speaking) ---
        phase += 0.085;
        ctx.lineCap = "round";

        // Draw three offset layered waves for rich density
        for (let w = 0; w < 3; w++) {
          ctx.beginPath();
          // Decrease amplitude and increase frequency for each layer
          const amplitude = (height * 0.35) / (w + 1);
          const frequency = 0.012 * (w + 1);
          const speed = phase * (1 - w * 0.18);

          for (let x = 0; x < width; x += 2) {
            const y = height / 2 + Math.sin(x * frequency + speed) * amplitude;
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          // Shift colors beautifully across layers
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          if (w === 0) {
            grad.addColorStop(0, "rgba(212, 175, 55, 0.2)");
            grad.addColorStop(0.5, "rgba(212, 175, 55, 0.85)");
            grad.addColorStop(1, "rgba(212, 175, 55, 0.2)");
            ctx.lineWidth = 3.5;
          } else if (w === 1) {
            grad.addColorStop(0, "rgba(212, 175, 55, 0.1)");
            grad.addColorStop(0.5, "rgba(212, 175, 55, 0.6)");
            grad.addColorStop(1, "rgba(212, 175, 55, 0.1)");
            ctx.lineWidth = 2.5;
          } else {
            grad.addColorStop(0, "rgba(212, 175, 55, 0.05)");
            grad.addColorStop(0.5, "rgba(212, 175, 55, 0.4)");
            grad.addColorStop(1, "rgba(212, 175, 55, 0.05)");
            ctx.lineWidth = 1.5;
          }

          ctx.strokeStyle = grad;
          ctx.stroke();
        }
      }

      // Loop visualizer while anything is actively sounding
      if (sourceNodeRef.current || window.speechSynthesis?.speaking) {
        animationFrameRef.current = requestAnimationFrame(draw);
      } else {
        drawRestingCanvas();
      }
    };

    draw();
  };

  // Speak using the custom backend Gemini model
  const handleGeminiTts = async () => {
    if (!text.trim()) {
      setErrorState("Please enter some text to synthesize first.");
      return;
    }

    stopPlayback();
    setIsGenerating(true);
    setErrorState(null);
    setCurrentPcmSamples(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          voice: selectedGeminiVoice,
          style: selectedStyle,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Synthesis failed with status ${response.status}`);
      }

      const data = await response.json();
      setIsGenerating(false);

      if (data.audio) {
        playGeminiAudio(data.audio);

        // Add to history list
        const voiceObj = GEMINI_VOICES.find(v => v.id === selectedGeminiVoice);
        const styleObj = VOICE_STYLES.find(s => s.id === selectedStyle);
        const newItem: HistoryItem = {
          id: Math.random().toString(36).substring(7),
          text: text.length > 80 ? text.substring(0, 80) + "..." : text,
          engine: "gemini",
          voiceName: voiceObj ? `${voiceObj.name} (${voiceObj.gender})` : "Kore",
          styleName: styleObj ? styleObj.name : "Default",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          audioBase64: data.audio,
        };
        saveToHistory([newItem, ...history.slice(0, 24)]);
      } else {
        throw new Error("No audio vector content received from the Voice Synthesis server.");
      }
    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
      setIsGenerating(false);
      setErrorState(err.message || "Unable to reach the Gemini Voice server. Falling back to browser local voice synthesis.");
      
      // Auto-fallback to local browser engine on error so the user has a fluid experience
      setEngine("browser");
    }
  };

  // Decode & Play raw 24kHz signed 16-bit PCM buffer on AudioContext
  const playGeminiAudio = (base64Audio: string) => {
    try {
      const pcmSamples = base64ToPcm(base64Audio);
      const floatSamples = pcmToFloat32(pcmSamples);

      const ctx = getAudioContext();
      const buffer = ctx.createBuffer(1, floatSamples.length, 24000);
      buffer.copyToChannel(floatSamples, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = browserRate; // Apply playback speed dynamically

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // standard detailed spectrum

      // Gain Node to regulate volume dynamically
      const gainNode = ctx.createGain();
      gainNode.gain.value = browserVolume;

      // Filter Node based on elected Tone Presets
      let lastNode: AudioNode = source;

      if (tonePreset !== "flat") {
        const filter = ctx.createBiquadFilter();
        if (tonePreset === "bass") {
          filter.type = "lowshelf";
          filter.frequency.value = 150;
          filter.gain.value = 10; // Boost lows beautifully
        } else if (tonePreset === "treble") {
          filter.type = "highshelf";
          filter.frequency.value = 3200;
          filter.gain.value = 8; // Boost crisp highs
        } else if (tonePreset === "warmth") {
          filter.type = "peaking";
          filter.frequency.value = 280;
          filter.Q.value = 1.0;
          filter.gain.value = 6; // Enhance mid richness
        } else if (tonePreset === "radio") {
          filter.type = "bandpass";
          filter.frequency.value = 1000;
          filter.Q.value = 1.2; // Telephone/AM transmission effect
        }
        source.connect(filter);
        lastNode = filter;
      }

      // Connect lastNode -> gainNode -> analyser -> sound outputs
      lastNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(ctx.destination);

      sourceNodeRef.current = source;
      analyserNodeRef.current = analyser;

      // Reset progress meters
      setIsPlaying(true);
      setAudioDuration(buffer.duration / browserRate);
      setAudioProgress(0);
      setCurrentPcmSamples(pcmSamples);

      const startTime = ctx.currentTime;
      const rate = browserRate;

      const trackProgress = () => {
        if (!sourceNodeRef.current) return;
        const elapsed = ctx.currentTime - startTime;
        const durationSeconds = buffer.duration / rate;
        if (elapsed >= durationSeconds) {
          setAudioProgress(durationSeconds);
          setIsPlaying(false);
          stopPlayback();
        } else {
          setAudioProgress(elapsed);
          animationFrameRef.current = requestAnimationFrame(trackProgress);
        }
      };

      source.start(0);
      animationFrameRef.current = requestAnimationFrame(trackProgress);

      // Trigger standard analyzer visualizer loops
      startCanvasVisualizer(analyser);

    } catch (e: any) {
      console.error("PCM Decoded Audio Playback crash:", e);
      setErrorState("Audio processing pipeline failed to decode synthesis buffers.");
    }
  };

  // Playback using standard client-side Web Speech Synthesis API
  const handleBrowserTts = (customText?: string) => {
    const textToSpeak = typeof customText === "string" ? customText : text;
    if (!textToSpeak.trim()) {
      setErrorState("Please enter some text to speak first.");
      return;
    }

    stopPlayback();
    setErrorState(null);

    if (typeof window === "undefined" || !window.speechSynthesis) {
      setErrorState("Your browser does not support local Speech Synthesis.");
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      if (selectedBrowserVoiceURI) {
        const matched = browserVoices.find(v => v.voiceURI === selectedBrowserVoiceURI);
        if (matched) {
          utterance.voice = matched;
        }
      }

      utterance.rate = browserRate;

      // Map tonePreset adjustments to pitch for local speech synthesis fallback
      let adjustedPitch = browserPitch;
      if (tonePreset === "bass") adjustedPitch = browserPitch * 0.75;
      else if (tonePreset === "treble") adjustedPitch = browserPitch * 1.25;
      else if (tonePreset === "warmth") adjustedPitch = browserPitch * 0.9;
      else if (tonePreset === "radio") adjustedPitch = browserPitch * 1.1;

      utterance.pitch = Math.max(0.5, Math.min(2.0, adjustedPitch));
      utterance.volume = browserVolume;

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsBrowserSpeaking(true);
        // Start procedural graphic sine wave
        startCanvasVisualizer(null);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsBrowserSpeaking(false);
        stopPlayback();
      };

      utterance.onerror = (e) => {
        console.error("Speech Synthesis Utterance error:", e);
        setIsPlaying(false);
        setIsBrowserSpeaking(false);
        stopPlayback();
      };

      window.speechSynthesis.speak(utterance);

      // Save to history log
      const voiceLabel = browserVoices.find(v => v.voiceURI === selectedBrowserVoiceURI)?.name || "Browser Voice";
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(7),
        text: text.length > 80 ? text.substring(0, 80) + "..." : text,
        engine: "browser",
        voiceName: `${voiceLabel}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      saveToHistory([newItem, ...history.slice(0, 24)]);

    } catch (err: any) {
      console.error("Browser native speech generation failed:", err);
      setErrorState("An unexpected error occurred inside your browser's Web Speech engine.");
    }
  };

  // Replay a specific item directly from history log
  const handleReplayHistory = (item: HistoryItem) => {
    stopPlayback();
    if (item.engine === "gemini" && item.audioBase64) {
      setEngine("gemini");
      playGeminiAudio(item.audioBase64);
    } else {
      setEngine("browser");
      // Find browser voice by name
      const matched = browserVoices.find(v => item.voiceName.includes(v.name));
      if (matched) {
        setSelectedBrowserVoiceURI(matched.voiceURI);
      }
      handleBrowserTts(item.text);
    }
  };

  // Generate a custom written text using the server-side Gemini 3.5-flash
  const handleGenerateText = async () => {
    if (!aiPrompt.trim()) return;

    setIsGeneratingText(true);
    setErrorState(null);

    try {
      const res = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          type: aiType,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to generate prompt text.");
      }

      const data = await res.json();
      if (data.text) {
        setText(data.text);
        setAiPrompt("");
        setShowAiHelper(false);
      }
    } catch (e: any) {
      console.error("AI Generation Error:", e);
      setErrorState(e.message || "Failed to generate text. Ensure you are connected online.");
    } finally {
      setIsGeneratingText(false);
    }
  };

  // Create downloadable file from loaded PCM buffer
  const downloadWav = () => {
    if (!currentPcmSamples) return;
    try {
      const blob = pcmToWavBlob(currentPcmSamples, 24000);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voice-studio-synthesis-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("WAV package rendering failed:", err);
    }
  };

  // Convert and download MP3 format from loaded PCM buffer
  const downloadMp3 = () => {
    if (!currentPcmSamples) return;
    try {
      const blob = pcmToMp3Blob(currentPcmSamples, 24000);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voice-studio-synthesis-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("MP3 compression rendering failed:", err);
      setErrorState("MP3 conversion failed. Please try downloading as WAV.");
    }
  };

  // Convert and download historical items as WAV
  const downloadHistoryWav = (item: HistoryItem) => {
    if (!item.audioBase64) return;
    try {
      const pcm = base64ToPcm(item.audioBase64);
      const blob = pcmToWavBlob(pcm, 24000);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voice-studio-history-${item.id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("WAV history export failed:", err);
    }
  };

  // Convert and download historical items as MP3
  const downloadHistoryMp3 = (item: HistoryItem) => {
    if (!item.audioBase64) return;
    try {
      const pcm = base64ToPcm(item.audioBase64);
      const blob = pcmToMp3Blob(pcm, 24000);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voice-studio-history-${item.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("MP3 history export failed:", err);
    }
  };

  // Copy text editor content to standard clipboard
  const copyTextToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Categories list for presets
  const presetCategories = ["All", "Speeches", "Storytelling", "Tongue Twisters", "Announcements", "Humor", "Hindi हिन्दी"];
  const filteredPresets = TEXT_PRESETS.filter(
    (preset) => selectedPresetCategory === "All" || preset.category === selectedPresetCategory
  );

  return (
    <div className={`min-h-screen font-sans selection:bg-[#D4AF37]/30 selection:text-white transition-colors duration-300 ${isDarkMode ? "dark bg-[#080808] text-[#E0E0D6]" : "light bg-[#FAF8F5] text-[#2B2A27]"}`}>
      {/* HEADER SECTION */}
      <header className="border-b border-[#1A1A1A] bg-[#0C0C0C] px-5 py-3 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-lg shadow-[#D4AF37]/10 shrink-0">
              <div className="w-4 h-4 border-2 border-[#080808] rounded-sm transform rotate-45 flex items-center justify-center">
                <Volume2 className="h-2 w-2 text-[#080808]" />
              </div>
            </div>
            <div>
              <h1 className="font-display text-xl tracking-[0.2em] font-light uppercase text-[#E0E0D6]">
                Vox Artisan <span className="text-[10px] tracking-normal px-2 py-0.5 ml-2 rounded bg-[#1A1A1A] border border-[#222] text-[#D4AF37] font-mono font-light">CONSOLE</span>
              </h1>
              <p className="text-xs text-gray-500 tracking-wide mt-1 font-display italic">
                Full-stack generative speech studio powered by Gemini AI and native acoustic neural voices
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 self-start md:self-auto">
            {/* Elegant Premium Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border border-[#D4AF37]/20 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 bg-[#1A1A1A] hover:bg-[#222]/80"
              aria-label="Toggle dark mode"
              id="theme-switch"
            >
              <span className="sr-only">Toggle Theme</span>
              <span
                className={`pointer-events-none relative inline-block h-6 w-6 mt-[3px] transform rounded-full bg-[#D4AF37] shadow-lg ring-0 transition duration-300 ease-in-out flex items-center justify-center ${
                  isDarkMode ? "translate-x-6.5" : "translate-x-1"
                }`}
              >
                {isDarkMode ? (
                  <Moon className="h-3 w-3 text-[#080808] fill-[#080808]" />
                ) : (
                  <Sun className="h-3 w-3 text-[#080808] fill-transparent" />
                )}
              </span>
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium font-mono bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/20 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse"></span>
              Studio Active
            </span>
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 py-3 md:py-4 lg:py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        
        {/* LEFT COLUMN: EDITING & WAVEFORMS */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Main Error state box */}
          {errorState && (
            <div className="rounded-xl border border-rose-950/40 bg-rose-950/10 p-4 text-sm text-rose-300 flex items-start gap-3 shadow-md">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">System Warning</p>
                <p className="mt-1 text-rose-300/90 leading-relaxed">{errorState}</p>
              </div>
            </div>
          )}

          {/* TEXT ENTRY AND WRITER CARD */}
          <section className="rounded-2xl border border-[#1A1A1A] bg-[#0C0C0C] p-4 md:p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#D4AF37]" />
                <h2 className="font-display text-xl font-light italic text-[#D4AF37]">Composition</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyTextToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1A1A1A] hover:bg-[#222] border border-[#222] text-gray-300 transition-colors"
                  title="Copy text to clipboard"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setShowAiHelper(!showAiHelper)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    showAiHelper
                      ? "bg-[#D4AF37] hover:bg-[#c29f2e] text-[#080808] shadow-md"
                      : "bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Writer
                </button>
              </div>
            </div>

            {/* AI Prompter Drawer */}
            {showAiHelper && (
              <div className="mb-3 p-3.5 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 animate-fadeIn">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-semibold text-[#E0E0D6]">Generate Custom Audio Script</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., A dramatic speech introducing a starship commander..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#080808] border border-[#222] text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleGenerateText();
                    }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={aiType}
                      onChange={(e) => setAiType(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg bg-[#080808] border border-[#222] text-gray-300 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                    >
                      <option value="story">Vivid Story</option>
                      <option value="speech">Eloquent Speech</option>
                      <option value="dialogue">Monologue</option>
                    </select>
                    <button
                      onClick={handleGenerateText}
                      disabled={isGeneratingText || !aiPrompt.trim()}
                      className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#c29f2e] disabled:bg-gray-800 disabled:text-gray-600 disabled:opacity-50 text-[#080808] font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      {isGeneratingText ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main script typing area */}
            <div className="relative">
              <div className="absolute -inset-0.5 bg-[#D4AF37] opacity-5 rounded-xl pointer-events-none"></div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={5000}
                className="relative w-full h-36 md:h-40 p-4 rounded-xl bg-[#080808] border border-[#222] text-[#BBB] placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/80 focus:ring-1 focus:ring-[#D4AF37]/40 resize-none leading-relaxed text-base font-display italic scrollbar-none"
                placeholder="Type the message you want to speak aloud..."
              />
              <div className="absolute bottom-3 right-4 text-[10px] font-mono text-gray-600 uppercase tracking-tighter">
                {text.length} / 5000 characters
              </div>
            </div>

            {/* PRESET FILTER AND CONTAINER */}
            <div className="mt-3.5 pt-3 border-t border-[#1A1A1A]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                <span className="text-[10px] uppercase tracking-[0.2em] opacity-40">Speed-Loading Presets</span>
                <div className="flex flex-wrap gap-1">
                  {presetCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedPresetCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest transition-colors ${
                        selectedPresetCategory === cat
                          ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30"
                          : "text-gray-500 hover:text-gray-300 bg-transparent border border-transparent"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      stopPlayback();
                      setText(preset.text);
                    }}
                    className="p-3 text-left rounded-lg bg-[#080808]/70 hover:bg-[#141414] border border-[#222]/60 hover:border-[#D4AF37]/30 text-xs text-gray-400 hover:text-[#D4AF37] transition-all truncate"
                    title={preset.text}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ACTIVE GRAPHIC WAVEFORM & PLAYER INTERFACE */}
          <section className="rounded-2xl border border-[#1A1A1A] bg-[#0C0C0C] p-4 md:p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-[#D4AF37]"></span>
                <h2 className="font-display text-xl font-light italic text-[#D4AF37]">Vocalizer Signal Deck</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-mono bg-[#080808] px-2.5 py-1 text-[10px] uppercase tracking-wider rounded border border-[#222]">
                  {engine === "gemini" ? "Gemini 24kHz Mono" : "Browser Native Mono"}
                </span>
              </div>
            </div>

            {/* WAVEFORM ANIMATION CONTAINER */}
            <div className="relative rounded-xl border border-[#222] bg-[#080808] p-4 flex flex-col items-center justify-center h-24 overflow-hidden shadow-inner">
              
              {/* Dynamic canvas visualizer */}
              <canvas
                ref={canvasRef}
                width={600}
                height={100}
                className="w-full h-16 block opacity-85"
              />

              {/* Loading modal layer */}
              {isGenerating && (
                <div className="absolute inset-0 bg-[#080808]/95 flex flex-col items-center justify-center gap-2">
                  <div className="flex gap-1.5 items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="h-2 w-2 rounded-full bg-[#D4AF37]/80 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="h-2 w-2 rounded-full bg-[#D4AF37]/50 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <p className="text-[10px] font-medium font-mono text-[#D4AF37] uppercase tracking-widest animate-pulse">
                    {reassuringMessage}
                  </p>
                </div>
              )}
            </div>

            {/* PROGRESS & AUDIO METADATA */}
            {engine === "gemini" && audioDuration > 0 && (
              <div className="mt-3.5 flex items-center justify-between gap-4 px-1">
                <div className="flex-grow flex items-center space-x-3 bg-[#111] border border-[#222] rounded-full px-3.5 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></div>
                  <div className="flex-grow h-1 bg-[#222] rounded-full relative">
                    <div
                      className="absolute left-0 top-0 h-full bg-[#D4AF37] rounded-full"
                      style={{ width: `${(audioProgress / audioDuration) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-mono opacity-50 shrink-0 select-none">
                  {audioProgress.toFixed(1)}s / {audioDuration.toFixed(1)}s
                </span>
              </div>
            )}

            {/* PLAYER CONTROLS PANEL */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-3.5 border-t border-[#1A1A1A]">
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-start">
                
                {/* ACTIVATE SPEECH BUTTON */}
                {engine === "gemini" ? (
                  <button
                    onClick={isPlaying ? stopPlayback : handleGeminiTts}
                    disabled={isGenerating}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2e] disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-50 text-[#080808] font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#D4AF37]/10 active:scale-95 transition-all cursor-pointer"
                  >
                    {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-[#080808]" />}
                    {isPlaying ? "Stop" : "Synthesize via Gemini"}
                  </button>
                ) : (
                  <button
                    onClick={isPlaying ? stopPlayback : handleBrowserTts}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37]/90 hover:bg-[#D4AF37] text-[#080808] font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#D4AF37]/10 active:scale-95 transition-all cursor-pointer"
                  >
                    {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-[#080808]" />}
                    {isPlaying ? "Stop Voice" : "Trigger Speech"}
                  </button>
                )}

                {/* STOP GENERAL BACKUP */}
                {isPlaying && (
                  <button
                    onClick={stopPlayback}
                    className="p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#222] border border-[#222] text-[#E0E0D6] transition-colors"
                    title="Mute Sound"
                  >
                    <VolumeX className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* DOWNLOAD COMPONENT */}
              {engine === "gemini" && currentPcmSamples && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={downloadWav}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-800 text-gray-400 rounded-xl text-xs uppercase tracking-widest hover:bg-[#111] hover:text-white transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export WAV
                  </button>
                  <button
                    onClick={downloadMp3}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#D4AF37]/40 text-[#D4AF37] rounded-xl text-xs uppercase tracking-widest hover:bg-[#D4AF37]/10 transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 animate-pulse" />
                    Export MP3
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: VOICE CONTROLS & HISTORICAL REGISTRY */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* VOICE CUSTOMIZATION BOARD */}
          <section className="rounded-2xl border border-[#1A1A1A] bg-[#0C0C0C] p-4 md:p-5 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1A1A1A] pb-3 mb-4">
              <Settings2 className="h-5 w-5 text-[#D4AF37]" />
              <h2 className="font-display text-xl font-light italic text-[#D4AF37]">Voice Architecture</h2>
            </div>

            {/* ENGINE TOGGLE CARDS */}
            <div className="space-y-2 mb-4">
              <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 block">Speech Synthesizer Engine</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    stopPlayback();
                    setEngine("gemini");
                  }}
                  className={`p-2.5 text-left rounded-xl border transition-all ${
                    engine === "gemini"
                      ? "border-[#D4AF37]/50 bg-[#D4AF37]/5 shadow-md text-white"
                      : "border-[#222] bg-[#080808]/50 text-gray-500 hover:border-[#1A1A1A] hover:text-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">Gemini AI Studio</div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-normal">High-fidelity, expressive, neural server voices.</div>
                </button>

                <button
                  onClick={() => {
                    stopPlayback();
                    setEngine("browser");
                  }}
                  className={`p-2.5 text-left rounded-xl border transition-all ${
                    engine === "browser"
                      ? "border-[#D4AF37]/50 bg-[#D4AF37]/5 shadow-md text-white"
                      : "border-[#222] bg-[#080808]/50 text-gray-500 hover:border-[#1A1A1A] hover:text-gray-300"
                  }`}
                >
                  <div className="font-semibold text-sm">Browser Local</div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-normal">Instant synthesis using device system voices.</div>
                </button>
              </div>
            </div>

            {/* GEMINI SPECIFIC PANEL */}
            {engine === "gemini" && (
              <div className="space-y-4 animate-fadeIn">
                
                {/* Voice Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.2em] opacity-40">Select Signature Speaker</span>
                    <span className="text-[10px] font-mono text-gray-600">24kHz PCM Output</span>
                  </div>
                  
                  {/* Language filter tabs */}
                  <div className="flex gap-1.5 pb-1">
                    {["All", "English / Neutral", "Indian Hindi (हिन्दी)"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSelectedGeminiLang(lang)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all duration-200 ${
                          selectedGeminiLang === lang
                            ? "border-[#D4AF37]/40 bg-[#D4AF37]/5 text-[#D4AF37]"
                            : "border-[#1c1c1c] bg-[#0c0c0c] text-gray-500 hover:text-gray-300 hover:border-[#2a2a2a]"
                        }`}
                      >
                        {lang === "All" ? "All" : lang === "English / Neutral" ? "English" : "Hindi (हिन्दी)"}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-none">
                    {GEMINI_VOICES.filter((v) => selectedGeminiLang === "All" || v.language === selectedGeminiLang).map((v) => (
                      <div
                        key={v.id}
                        onClick={() => setSelectedGeminiVoice(v.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                          selectedGeminiVoice === v.id
                            ? "border-[#D4AF37]/60 bg-[#D4AF37]/10 text-white"
                            : "border-[#222] bg-[#080808]/40 text-gray-400 hover:border-gray-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-gray-200">{v.name}</span>
                          <div className="flex items-center gap-1.5">
                            {v.language && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c1c1c] text-[#D4AF37]/80 border border-[#2a2a2a]">
                                {v.language === "Indian Hindi (हिन्दी)" ? "Hindi" : "English"}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              v.gender === "Female" ? "bg-pink-950/20 text-pink-400" : "bg-blue-950/20 text-blue-400"
                            }`}>
                              {v.gender}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Styled Emotional Modifier */}
                <div className="space-y-1.5 pt-1.5 border-t border-[#1A1A1A]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] opacity-40">Acoustic Style modifier</span>
                    <div className="relative group">
                      <Info className="h-3.5 w-3.5 text-gray-600 hover:text-gray-400 cursor-pointer" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 rounded bg-[#080808] border border-[#222] text-[10px] text-gray-400 leading-normal shadow-lg z-20">
                        Guides the neural TTS speaker's pitch patterns to mimic selected emotions.
                      </div>
                    </div>
                  </div>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-[#080808] border border-[#222] text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                  >
                    {VOICE_STYLES.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name} — {style.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* BROWSER SPECIFIC CONFIG PANEL */}
            {engine === "browser" && (
              <div className="space-y-4 animate-fadeIn">
                
                {/* Voice picker list */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 block">Physical Local Voice</span>
                  {browserVoices.length > 0 ? (
                    <select
                      value={selectedBrowserVoiceURI}
                      onChange={(e) => setSelectedBrowserVoiceURI(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-[#080808] border border-[#222] text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30"
                    >
                      {browserVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-yellow-500 bg-yellow-950/20 border border-yellow-900/30 p-2 rounded-lg">
                      No hardware speech voices loaded on this browser. Try another browser or restart speech processes.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACOUSTIC MODULATION & TONE PRESETS */}
            <div className="mt-4 pt-3.5 border-t border-[#1A1A1A] space-y-4 animate-fadeIn">
              <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 block">Acoustic Modulation & Equalizer</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "flat", name: "Flat / Pure", desc: "No filtration (source voice)" },
                  { id: "bass", name: "Bass Boost", desc: "Deep rich commanding tones" },
                  { id: "warmth", name: "Studio Warmth", desc: "High presence cozy mids" },
                  { id: "radio", name: "Vintage Radio", desc: "Classic bandpass radio" }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setTonePreset(p.id);
                      // If playing, apply filter or restart appropriately
                    }}
                    className={`p-2 text-left rounded-xl border transition-all cursor-pointer ${
                      tonePreset === p.id
                        ? "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-white"
                        : "border-[#222] bg-[#080808]/40 text-gray-500 hover:border-[#1A1A1A] hover:text-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-xs text-gray-200">{p.name}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>

              {/* Slider grid */}
              <div className="space-y-2.5 pt-1.5">
                {/* Speed Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">Vocal Velocity (Speed)</span>
                    <span className="font-mono text-[#D4AF37] font-semibold">{browserRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={browserRate}
                    onChange={(e) => setBrowserRate(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                </div>

                {/* Pitch Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">Vocal Pitch Tone</span>
                    <span className="font-mono text-[#D4AF37] font-semibold">{browserPitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={browserPitch}
                    onChange={(e) => setBrowserPitch(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                </div>

                {/* Volume Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">Audio Gain Volume</span>
                    <span className="font-mono text-[#D4AF37] font-semibold">{Math.round(browserVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={browserVolume}
                    onChange={(e) => setBrowserVolume(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#1A1A1A] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* HISTORICAL REGISTRY LOG CARD */}
          <section className="rounded-2xl border border-[#1A1A1A] bg-[#0C0C0C] p-4 md:p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#D4AF37]" />
                <h2 className="font-display text-xl font-light italic text-[#D4AF37]">Vocal Registry Log</h2>
              </div>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-950/10 hover:bg-rose-950/20 border border-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Wipe Log
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-none">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-[#1A1A1A] bg-[#080808]/50 flex items-start justify-between gap-3 group hover:border-[#D4AF37]/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 leading-normal italic truncate">"{item.text}"</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                          item.engine === "gemini" ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "bg-emerald-950/20 text-emerald-400"
                        }`}>
                          {item.engine === "gemini" ? "Gemini" : "Local"}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">{item.voiceName}</span>
                        {item.styleName && item.styleName !== "Default" && (
                          <span className="text-[10px] text-[#D4AF37]/80 font-mono">· {item.styleName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleReplayHistory(item)}
                        className="p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] opacity-80 group-hover:opacity-100 hover:bg-[#D4AF37]/25 transition-all cursor-pointer"
                        title="Replay Audio"
                      >
                        <Play className="h-3.5 w-3.5 fill-[#D4AF37]" />
                      </button>
                      {item.engine === "gemini" && item.audioBase64 && (
                        <>
                          <button
                            onClick={() => downloadHistoryWav(item)}
                            className="p-2 rounded-lg bg-gray-950 border border-gray-800 text-gray-500 opacity-50 group-hover:opacity-100 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
                            title="Download WAV"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => downloadHistoryMp3(item)}
                            className="p-2 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-[#D4AF37]/70 opacity-50 group-hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/15 transition-all cursor-pointer"
                            title="Download MP3"
                          >
                            <Download className="h-3.5 w-3.5 animate-pulse" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="h-10 w-10 rounded-full bg-[#080808] border border-[#1A1A1A] flex items-center justify-center text-gray-600 mb-2">
                  <History className="h-5 w-5" />
                </div>
                <p className="text-xs text-gray-500">No vocal scripts synthesized yet.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* SOPIHSTICATED DARK FOOTER */}
      <footer className="h-12 bg-[#050505] border-t border-[#1A1A1A] px-10 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] opacity-30 mt-4">
        <span>Server Status: Optimal</span>
        <span>Neural Engine v4.2.0</span>
        <span>© 2026 LUX AUDIO LABS</span>
      </footer>
    </div>
  );
}
