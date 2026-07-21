/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore
import MPEGMode from "lamejs/src/js/MPEGMode.js";
// @ts-ignore
import Lame from "lamejs/src/js/Lame.js";
// @ts-ignore
import BitStream from "lamejs/src/js/BitStream.js";

// Ensure MPEGMode, Lame, and BitStream are globally available because lamejs internal files expect them globally in ES module / strict environments.
const realMPEGMode = (MPEGMode && (MPEGMode as any).default) ? (MPEGMode as any).default : MPEGMode;
const realLame = (Lame && (Lame as any).default) ? (Lame as any).default : Lame;
const realBitStream = (BitStream && (BitStream as any).default) ? (BitStream as any).default : BitStream;

if (typeof window !== "undefined") {
  (window as any).MPEGMode = realMPEGMode;
  (window as any).Lame = realLame;
  (window as any).BitStream = realBitStream;
}
if (typeof globalThis !== "undefined") {
  (globalThis as any).MPEGMode = realMPEGMode;
  (globalThis as any).Lame = realLame;
  (globalThis as any).BitStream = realBitStream;
}

// @ts-ignore
import lamejs from "lamejs";

/**
 * Decodes a base64 string of raw 16-bit PCM data (little-endian) into an Int16Array.
 */
export function base64ToPcm(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // 16-bit samples are 2 bytes each
  return new Int16Array(bytes.buffer);
}

/**
 * Converts a 16-bit signed PCM array into a floating-point array (range -1.0 to 1.0).
 */
export function pcmToFloat32(pcmSamples: Int16Array): Float32Array {
  const floatSamples = new Float32Array(pcmSamples.length);
  for (let i = 0; i < pcmSamples.length; i++) {
    // Convert 16-bit integer [-32768, 32767] to float [-1.0, 1.0]
    floatSamples[i] = pcmSamples[i] / 32768;
  }
  return floatSamples;
}

/**
 * Converts raw 16-bit PCM little-endian data to a downloadable WAV Blob.
 */
export function pcmToWavBlob(pcmSamples: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmSamples.length * 2);
  const view = new DataView(buffer);

  // 1. "RIFF" chunk descriptor
  writeString(view, 0, "RIFF");
  // File size = 36 + data size
  view.setUint32(4, 36 + pcmSamples.length * 2, true);
  writeString(view, 8, "WAVE");

  // 2. "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  // Sub-chunk size (16 for PCM)
  view.setUint32(16, 16, true);
  // Audio format (1 for uncompressed PCM)
  view.setUint16(20, 1, true);
  // Number of channels (1 for mono)
  view.setUint16(22, 1, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate = sampleRate * channels * bytesPerSample
  view.setUint32(28, sampleRate * 1 * 2, true);
  // Block align = channels * bytesPerSample
  view.setUint16(32, 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);

  // 3. "data" sub-chunk
  writeString(view, 36, "data");
  // Sub-chunk size
  view.setUint32(40, pcmSamples.length * 2, true);

  // Write PCM audio samples
  for (let i = 0; i < pcmSamples.length; i++) {
    view.setInt16(44 + i * 2, pcmSamples[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Converts raw 16-bit PCM little-endian samples to a compressed downloadable MP3 Blob.
 */
export function pcmToMp3Blob(pcmSamples: Int16Array, sampleRate: number): Blob {
  const mp3encoder = new (lamejs as any).Mp3Encoder(1, sampleRate, 128);
  const mp3Data: Int8Array[] = [];

  const sampleBlockSize = 1152; // standard MP3 block size
  for (let i = 0; i < pcmSamples.length; i += sampleBlockSize) {
    const sampleChunk = pcmSamples.subarray(i, i + sampleBlockSize);
    
    // Check if we need to pad the last chunk (lamejs needs precise buffers)
    let chunkToEncode = sampleChunk;
    if (sampleChunk.length < sampleBlockSize) {
      chunkToEncode = new Int16Array(sampleBlockSize);
      chunkToEncode.set(sampleChunk);
    }

    const mp3buf = mp3encoder.encodeBuffer(chunkToEncode);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  return new Blob(mp3Data, { type: "audio/mp3" });
}

