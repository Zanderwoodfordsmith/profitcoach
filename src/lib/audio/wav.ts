function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function mixToMono(buffer: AudioBuffer) {
  const length = buffer.length;
  const mixed = new Float32Array(length);
  const channelCount = buffer.numberOfChannels;

  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      sum += buffer.getChannelData(channel)[i] ?? 0;
    }
    mixed[i] = sum / channelCount;
  }

  return mixed;
}

export function audioBufferToWavBlob(buffer: AudioBuffer) {
  const samples = mixToMono(buffer);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(
      offset,
      clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([bytes], { type: "audio/wav" });
}

export async function recordingBlobToWavFile(blob: Blob, filename: string) {
  const context = new AudioContext();
  try {
    const source = await blob.arrayBuffer();
    const audio = await context.decodeAudioData(source.slice(0));
    const targetRate = 16000;
    const frames = Math.max(1, Math.ceil(audio.duration * targetRate));
    const offline = new OfflineAudioContext(1, frames, targetRate);
    const node = offline.createBufferSource();
    node.buffer = audio;
    node.connect(offline.destination);
    node.start(0);
    const rendered = await offline.startRendering();
    const wav = audioBufferToWavBlob(rendered);
    return new File([wav], filename, { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
