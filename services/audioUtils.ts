import { SpeakerSegment, ExportFormat } from "../types";
import * as lamejs from 'lamejs';

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

const bufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let resultBuffer: Float32Array;

  // Interleave channels if necessary
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const length = left.length + right.length;
    resultBuffer = new Float32Array(length);
    for (let i = 0; i < left.length; i++) {
      resultBuffer[i * 2] = left[i];
      resultBuffer[i * 2 + 1] = right[i];
    }
  } else {
    resultBuffer = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const bufferLength = 44 + resultBuffer.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + resultBuffer.length * bytesPerSample, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, resultBuffer.length * bytesPerSample, true);

  // write the PCM samples
  floatTo16BitPCM(view, 44, resultBuffer);

  return new Blob([view], { type: 'audio/wav' });
};

const bufferToMp3 = (buffer: AudioBuffer): Blob => {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const kbps = 128;
  const mp3encoder = new (lamejs as any).Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  const left = buffer.getChannelData(0);
  const right = channels === 2 ? buffer.getChannelData(1) : new Float32Array(left.length);

  const sampleBlockSize = 1152;
  
  for (let i = 0; i < left.length; i += sampleBlockSize) {
    const leftPart = left.subarray(i, i + sampleBlockSize);
    const rightPart = right.subarray(i, i + sampleBlockSize);
    
    const leftInt = new Int16Array(leftPart.length);
    const rightInt = new Int16Array(rightPart.length);
    
    for (let j = 0; j < leftPart.length; j++) {
      const sL = Math.max(-1, Math.min(1, leftPart[j]));
      leftInt[j] = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
      
      if (channels === 2) {
        const sR = Math.max(-1, Math.min(1, rightPart[j]));
        rightInt[j] = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
      }
    }

    const mp3buf = channels === 2 
      ? mp3encoder.encodeBuffer(leftInt, rightInt)
      : mp3encoder.encodeBuffer(leftInt);
    
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remove data:audio/wav;base64, prefix
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const audioUtils = {
  async preprocessAudioForGemini(file: File): Promise<{ base64: string; mimeType: string }> {
    const COMPRESSED_TYPES = [
      'audio/mpeg', 
      'audio/mp3', 
      'audio/aac', 
      'audio/x-m4a', 
      'audio/m4a', 
      'audio/mp4', 
      'audio/webm', 
      'audio/ogg'
    ];
    // Thresholds
    const INLINE_SAFE_LIMIT = 20 * 1024 * 1024; // 20MB
    const MEMORY_SAFE_LIMIT = 50 * 1024 * 1024; // 50MB - Decoding larger than this might crash browser tab

    console.log(`Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // STRATEGY 1: PASS-THROUGH
    // If file is already compressed and small enough, sending it directly is better than expanding to WAV.
    // OR if file is too large to decode safely in browser (RAM exhaustion), we risk sending raw to avoid crash.
    const isCompressed = COMPRESSED_TYPES.includes(file.type) || file.name.endsWith('.m4a');
    const isSmallEnough = file.size < INLINE_SAFE_LIMIT;
    const isTooBigToDecode = file.size > MEMORY_SAFE_LIMIT;

    if ((isCompressed && isSmallEnough) || isTooBigToDecode) {
      console.log(isTooBigToDecode 
        ? "File too large for local processing. Sending raw to API." 
        : "File is optimized enough. Sending original.");
      
      const base64 = await blobToBase64(file);
      return { base64, mimeType: file.type || 'audio/m4a' }; // Fallback to m4a if type missing but logic passed
    }

    // STRATEGY 2: RESAMPLE & DOWNMIX
    // If file is raw (WAV) or in the "Goldilocks zone" (20-50MB) where we can safely optimize it.
    try {
      console.log("Decoding and resampling audio...");
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const originalBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Resample to 16kHz Mono (Speech optimized)
      const TARGET_SAMPLE_RATE = 16000;
      const OfflineAudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      
      // Calculate new duration
      const newLength = Math.ceil(originalBuffer.duration * TARGET_SAMPLE_RATE);
      const offlineCtx = new OfflineAudioContextClass(
        1, // Mono
        newLength,
        TARGET_SAMPLE_RATE
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = originalBuffer;
      source.connect(offlineCtx.destination);
      source.start();

      const resampledBuffer = await offlineCtx.startRendering();

      // Convert to WAV Blob
      const wavBlob = bufferToWav(resampledBuffer);
      
      // Smart Check: Did we actually make it smaller?
      // WAV is uncompressed. A 20MB MP3 might become 50MB WAV even at 16kHz.
      if (wavBlob.size > file.size && isCompressed) {
         console.log("Optimization resulted in larger file. Reverting to original.");
         const base64 = await blobToBase64(file);
         return { base64, mimeType: file.type };
      }

      console.log(`Optimized to WAV: ${(wavBlob.size / 1024 / 1024).toFixed(2)} MB`);
      const base64 = await blobToBase64(wavBlob);
      return { base64, mimeType: 'audio/wav' };

    } catch (e) {
      console.error("Audio preprocessing failed, falling back to original file:", e);
      // Fallback to sending original if decoding fails
      const base64 = await blobToBase64(file);
      return { base64, mimeType: file.type || 'audio/mp3' };
    }
  },

  async isolateTrack(
    originalBuffer: AudioBuffer, 
    segments: SpeakerSegment[], 
    format: ExportFormat = 'wav',
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    onProgress?.(5);

    // 1. Create Offline Context
    const OfflineAudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineAudioContextClass(
      originalBuffer.numberOfChannels,
      originalBuffer.length,
      originalBuffer.sampleRate
    );

    // 2. Prepare Source
    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;

    // 3. Prepare Gain for gating/isolation
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = 0; // Start silent

    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    // 4. Sort and Merge segments to handle overlaps cleanly
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    const mergedSegments: { start: number; end: number }[] = [];
    
    if (sortedSegments.length > 0) {
      let current = { start: sortedSegments[0].start, end: sortedSegments[0].end };
      
      for (let i = 1; i < sortedSegments.length; i++) {
        const next = sortedSegments[i];
        if (next.start <= current.end) {
          // Overlap or adjacent
          current.end = Math.max(current.end, next.end);
        } else {
          mergedSegments.push(current);
          current = { start: next.start, end: next.end };
        }
      }
      mergedSegments.push(current);
    }

    // 5. Schedule Automation
    const FADE_TIME = 0.02; // 20ms fade

    mergedSegments.forEach(seg => {
      // Fade In
      const startTime = Math.max(0, seg.start);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(1, startTime + FADE_TIME);
      
      // Fade Out
      const endTime = Math.min(originalBuffer.duration, seg.end);
      if (endTime > startTime + FADE_TIME) {
          gainNode.gain.setValueAtTime(1, endTime - FADE_TIME);
          gainNode.gain.linearRampToValueAtTime(0, endTime);
      }
    });

    onProgress?.(15);

    // 6. Render
    source.start();
    const renderedBuffer = await offlineCtx.startRendering();

    onProgress?.(50);

    // 7. Convert to desired format
    if (format === 'mp3') {
      const channels = renderedBuffer.numberOfChannels;
      const sampleRate = renderedBuffer.sampleRate;
      const kbps = 128;
      const mp3encoder = new (lamejs as any).Mp3Encoder(channels, sampleRate, kbps);
      const mp3Data: Uint8Array[] = [];

      const left = renderedBuffer.getChannelData(0);
      const right = channels === 2 ? renderedBuffer.getChannelData(1) : new Float32Array(left.length);

      const sampleBlockSize = 1152;
      
      for (let i = 0; i < left.length; i += sampleBlockSize) {
        // Report progress druing encoding (from 50% to 95%)
        const encodingProgress = Math.floor(50 + (i / left.length) * 45);
        if (i % (sampleBlockSize * 100) === 0) onProgress?.(encodingProgress);

        const leftPart = left.subarray(i, i + sampleBlockSize);
        const rightPart = right.subarray(i, i + sampleBlockSize);
        
        const leftInt = new Int16Array(leftPart.length);
        const rightInt = new Int16Array(rightPart.length);
        
        for (let j = 0; j < leftPart.length; j++) {
          const sL = Math.max(-1, Math.min(1, leftPart[j]));
          leftInt[j] = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
          
          if (channels === 2) {
            const sR = Math.max(-1, Math.min(1, rightPart[j]));
            rightInt[j] = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
          }
        }

        const mp3buf = channels === 2 
          ? mp3encoder.encodeBuffer(leftInt, rightInt)
          : mp3encoder.encodeBuffer(leftInt);
        
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }

      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));

      onProgress?.(100);
      return new Blob(mp3Data, { type: 'audio/mp3' });
    } else if (format === 'm4a') {
      return new Promise(async (resolve) => {
        const destCtx = new AudioContext();
        const dest = destCtx.createMediaStreamDestination();
        const sourceNode = destCtx.createBufferSource();
        sourceNode.buffer = renderedBuffer;
        sourceNode.connect(dest);
        
        const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : 'audio/webm;codecs=opus';
        
        const recorder = new MediaRecorder(dest.stream, { mimeType });
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          onProgress?.(100);
          resolve(new Blob(chunks, { type: mimeType }));
          destCtx.close();
        };
        
        recorder.start();
        sourceNode.start();
        
        const durationMs = renderedBuffer.duration * 1000;
        const startTime = Date.now();
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.floor(50 + (elapsed / durationMs) * 45);
            onProgress?.(Math.min(p, 99));
        }, 200);

        setTimeout(() => {
          clearInterval(progressInterval);
          recorder.stop();
          sourceNode.stop();
        }, durationMs + 100);
      });
    }
    
    onProgress?.(90);
    const blob = bufferToWav(renderedBuffer);
    onProgress?.(100);
    return blob;
  }
};