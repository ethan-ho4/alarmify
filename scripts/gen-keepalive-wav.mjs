/**
 * Writes assets/keepalive-loop.wav — 441 Hz sine, mono 44.1kHz, 1s (seamless loop).
 * 441 cycles × 100 samples = 44100 → phase matches at loop boundary.
 *
 * Run: node scripts/gen-keepalive-wav.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'keepalive-loop.wav');

const sampleRate = 44100;
const frequency = 441;
const durationSec = 1;
const amplitude = 10_000;

const numSamples = sampleRate * durationSec;
const samples = new Int16Array(numSamples);
for (let i = 0; i < numSamples; i++) {
  samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate));
}

const blockAlign = 2;
const dataSize = numSamples * 2;
const buffer = Buffer.alloc(44 + dataSize);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * blockAlign, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  buffer.writeInt16LE(samples[i], 44 + i * 2);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, buffer);
console.log('Wrote', OUT, `(${numSamples} samples, ${frequency} Hz)`);
