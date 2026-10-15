import fs from 'node:fs';
import path from 'node:path';

// Records the page with its sound through Chrome's tab capture. Chrome has to be
// launched with --auto-accept-this-tab-capture (see playwright.config.js) and in
// a visible window; only the page itself is captured, never the window frame.
export async function startTabRecording(page) {
  await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      // Keep the mix untouched and in stereo (left/right is the point of the piece).
      audio: {
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      preferCurrentTab: true,
    });

    // Chrome slides a "sharing this tab" bar in once capture starts, which shrinks
    // the page by a few dozen pixels. Let that settle before recording so the
    // picture does not change size halfway through.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 256_000,
    });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.start(1000);
    window.__tabRecording = {
      recorder,
      chunks,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    };
  });
  return page.evaluate(() => ({
    audioTracks: window.__tabRecording.audioTracks,
    videoTracks: window.__tabRecording.videoTracks,
  }));
}

// Stops the recording, saves it, and reports how loud the captured audio is.
export async function stopTabRecording(page, outputPath) {
  const result = await page.evaluate(() => new Promise((resolve) => {
    const { recorder, chunks } = window.__tabRecording;
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }

      let audio = null;
      try {
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(bytes.buffer.slice(0));
        const samples = decoded.getChannelData(0);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < samples.length; i += 1) {
          sum += samples[i] * samples[i];
          peak = Math.max(peak, Math.abs(samples[i]));
        }
        // Loudness of each second, to tell silence from the actual music.
        const rate = decoded.sampleRate;
        const rmsPerSecond = [];
        for (let start = 0; start < samples.length; start += rate) {
          let part = 0;
          const end = Math.min(start + rate, samples.length);
          for (let i = start; i < end; i += 1) part += samples[i] * samples[i];
          rmsPerSecond.push(+Math.sqrt(part / (end - start)).toFixed(3));
        }
        audio = {
          seconds: decoded.duration,
          channels: decoded.numberOfChannels,
          rms: Math.sqrt(sum / samples.length),
          peak,
          rmsPerSecond,
        };
        await context.close();
      } catch (error) {
        audio = { error: String(error.message || error) };
      }
      resolve({ base64: btoa(binary), audio, size: bytes.length });
    };
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
  }));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(result.base64, 'base64'));
  return { bytes: result.size, audio: result.audio };
}
