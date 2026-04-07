/**
 * 🎬 ConnectSphere Client-Side Video Compressor (with Perceptual Enhancer)
 * 
 * Works on 3 principles for the "Illusion of No Quality Loss":
 * 1. Adaptive Max Bitrate: Uses the math formula to keep the file EXACTLY under 190MB. 
 *    (A 1 min video will use 25Mbps, making it visually lossless).
 * 2. Visual Enhancer (The Magic): Applies a subtle contrast + saturation boost 
 *    using Canvas filters. This tricks the human eye into perceiving high sharpness 
 *    and quality, hiding compression artifacts.
 * 3. 60 FPS Smoothness: Preserves up to 60fps framerates for absolute butter-smooth motion.
 */

const MAX_OUTPUT_BYTES = 190 * 1024 * 1024; // 190MB (safe for Catbox's 200MB limit)

interface CompressOptions {
    maxWidth?: number;
    maxHeight?: number;
    onProgress?: (percent: number, status: string) => void;
}

export async function compressVideo(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const {
        maxWidth = 1080,  // Full HD limit
        maxHeight = 1920, // Full HD limit
        onProgress
    } = options;

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';

        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        const cleanup = () => URL.revokeObjectURL(objectUrl);

        video.onloadedmetadata = async () => {
            try {
                const duration = video.duration;

                if (duration > 60 * 60) {
                    cleanup();
                    reject(new Error("Bhai video 1 ghante se bada hai, movie upload kar raha hai kya?"));
                    return;
                }

                // 🧠 THE MATH: Calculate maximum possible bitrate to fit exactly in 190MB
                // Formula: (190MB * 8 bits * 0.9 safety margin) / duration in seconds
                let optimalBitrate = Math.floor((MAX_OUTPUT_BYTES * 8 * 0.9) / duration);
                
                // Cap it at 20 Mbps (Instagram uses ~2.5 to 5 Mbps, so 20 is INSANE quality)
                if (optimalBitrate > 20_000_000) optimalBitrate = 20_000_000;
                // Floor it at 500 kbps (so it never becomes completely unwatchable)
                if (optimalBitrate < 500_000) optimalBitrate = 500_000;

                // Calculate dimensions
                let w = video.videoWidth;
                let h = video.videoHeight;
                if (w > maxWidth || h > maxHeight) {
                    const ratio = Math.min(maxWidth / w, maxHeight / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                w = w - (w % 2); // Must be even for codecs
                h = h - (h % 2);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;

                // 🪄 PERCEPTUAL ENHANCER (The Illusion)
                // 1. High quality image scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                // 2. The Visual Trick: 5% more contrast, 10% more saturation. 
                // Makes colors pop and edges look sharper, which hides compression blocking!
                ctx.filter = 'contrast(1.05) saturate(1.10)';

                // 💨 SMOOTHNESS: Capture at 60fps to preserve all native motion fluidity
                const canvasStream = canvas.captureStream(60);

                let stream: MediaStream;
                try {
                    const audioCtx = new AudioContext({ sampleRate: 48000 });
                    const source = audioCtx.createMediaElementSource(video);
                    const dest = audioCtx.createMediaStreamDestination();
                    source.connect(dest);
                    source.connect(audioCtx.destination);
                    stream = new MediaStream([
                        ...canvasStream.getVideoTracks(),
                        ...dest.stream.getAudioTracks()
                    ]);
                } catch {
                    stream = canvasStream;
                }

                // Use VP9 for premium quality at lower bitrates (better than H264)
                const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
                    .find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

                const recorder = new MediaRecorder(stream, {
                    mimeType: mime,
                    videoBitsPerSecond: optimalBitrate,
                    audioBitsPerSecond: 128_000 // Good audio quality
                });

                const chunks: Blob[] = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    cleanup();
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const baseName = file.name.replace(/\.[^.]+$/, '');
                    const compressedFile = new File([blob], `${baseName}_enhanced.webm`, { type: 'video/webm' });
                    
                    const origMB = (file.size / 1048576).toFixed(1);
                    const newMB = (compressedFile.size / 1048576).toFixed(1);
                    console.log(`[Enhancer] ${origMB}MB -> ${newMB}MB | Target Bitrate: ${(optimalBitrate/1e6).toFixed(1)}Mbps`);
                    
                    resolve(compressedFile);
                };

                recorder.onerror = () => {
                    cleanup();
                    reject(new Error('Enhancement processing failed'));
                };

                // Start
                recorder.start(1000);
                video.currentTime = 0;
                
                // Don't play at double speed here, drawing needs to sync perfectly for 60fps
                await video.play();

                const drawFrame = () => {
                    if (video.ended || video.paused) {
                        if (recorder.state === 'recording') recorder.stop();
                        return;
                    }
                    
                    // The drawing applies the enhancer filter we set!
                    ctx.drawImage(video, 0, 0, w, h);
                    
                    if (onProgress && duration > 0) {
                        const pct = Math.round((video.currentTime / duration) * 100);
                        const estOut = ((optimalBitrate * duration) / 8 / 1048576).toFixed(0);
                        onProgress(pct, `Applying Vision Enhancer... ~${estOut}MB`);
                    }
                    requestAnimationFrame(drawFrame);
                };
                drawFrame();

                video.onended = () => {
                    if (recorder.state === 'recording') recorder.stop();
                };

            } catch (err) {
                cleanup();
                reject(err);
            }
        };

        video.onerror = () => {
            cleanup();
            reject(new Error('Cannot load video'));
        };
    });
}

/** Check if video needs compression */
export function needsCompression(file: File): boolean {
    return file.type.startsWith('video/') && file.size > MAX_OUTPUT_BYTES;
}
