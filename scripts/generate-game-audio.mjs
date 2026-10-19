import { mkdirSync, writeFileSync } from 'node:fs';

const rate = 22050;
const output = new URL('../src/assets/audio/game/', import.meta.url);
mkdirSync(output, { recursive: true });

function wav(name, duration, render) {
  const length = Math.ceil(rate * duration);
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const value = Math.max(-1, Math.min(1, render(i / rate, i / length)));
    pcm[i] = Math.round(value * 32767);
  }
  const bytes = Buffer.alloc(44 + pcm.byteLength);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + pcm.byteLength, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(pcm.byteLength, 40);
  Buffer.from(pcm.buffer).copy(bytes, 44);
  writeFileSync(new URL(name, output), bytes);
}

let seed = 0x4e4a414d;
const noise = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};
const tone = (frequency, time) => Math.sin(Math.PI * 2 * frequency * time);
const bell = (frequency, time) => tone(frequency, time) + .38 * tone(frequency * 2.01, time) + .18 * tone(frequency * 3.98, time);

wav('card-1.wav', .18, (t, p) => (noise() * .7 + tone(1150 + 1250 * p, t) * .18) * Math.sin(Math.PI * p) * (1 - p));
wav('card-2.wav', .16, (t, p) => (noise() * .62 + tone(1550 + 900 * p, t) * .22) * Math.sin(Math.PI * p) * (1 - p));
wav('special.wav', .34, (t, p) => bell(t < .13 ? 523.25 : 783.99, t) * .32 * Math.pow(1 - p, .8));
wav('draw.wav', .24, (t, p) => (noise() * .45 + tone(420 - 170 * p, t) * .28) * Math.sin(Math.PI * p) * (1 - p));
wav('turn.wav', .31, (t, p) => bell(t < .13 ? 659.25 : 987.77, t) * .27 * Math.pow(1 - p, .65));
wav('low-time.wav', .22, (t, p) => tone(760 - 150 * p, t) * .34 * Math.sin(Math.PI * Math.min(1, p * 4)) * (1 - p));
wav('victory.wav', 1.45, (t, p) => {
  const sequence = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
  const starts = [0, .16, .32, .59, .75, .91];
  let value = 0;
  sequence.forEach((frequency, index) => {
    const age = t - starts[index];
    if (age >= 0) value += bell(frequency, age) * Math.exp(-age * (index === 5 ? 2.4 : 6));
  });
  return value * .24 * Math.min(1, t * 20) * Math.min(1, (1 - p) * 8);
});
wav('defeat.wav', .78, (t, p) => {
  const frequency = t < .23 ? 440 : t < .46 ? 370 : 294;
  return bell(frequency, t) * .24 * Math.sin(Math.PI * Math.min(1, (t % .23) / .05)) * (1 - p);
});
