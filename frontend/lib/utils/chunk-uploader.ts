import { uploadToCatbox } from "@/lib/storage";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB for better parallelization and lower memory usage
const MAX_CONCURRENT_UPLOADS = 6; // Increased for faster multi-chunk uploads
const MAX_RETRIES = 3;

interface ChunkInfo {
    index: number;
    blob: Blob;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadChunkWithRetry(chunk: Blob, index: number, ext: string, retries = 0): Promise<string> {
    try {
        // Use proxy to avoid CORS and potentially handle SSL issues at edge
        const fileToUpload = new File([chunk], `chunk_${index}${ext}`, { type: chunk.type });
        const url = await uploadToCatbox(fileToUpload, { useProxy: true });
        return url;
    } catch (error) {
        if (retries < MAX_RETRIES) {
            console.warn(`Chunk ${index} failed, retrying (${retries + 1}/${MAX_RETRIES})...`);
            await delay(1000 * Math.pow(2, retries)); // Exponential backoff: 1s, 2s, 4s
            return uploadChunkWithRetry(chunk, index, ext, retries + 1);
        }
        throw new Error(`Failed to upload chunk ${index} after ${MAX_RETRIES} retries.`);
    }
}

export async function uploadFileInChunks(
    file: File,
    onProgress?: (progress: number) => void
): Promise<string[]> {
    // Extracts file extension and makes sure videos NEVER get chunked.
    // Chunking an MP4 splits the 'moov' atom and breaks playback.
    const extMatch = file.name.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const isVideo = file.type.startsWith('video/');

    if (file.size <= CHUNK_SIZE || isVideo) {
        // Direct upload for small files AND all video files!
        if (onProgress) onProgress(10);
        const url = await uploadToCatbox(file);
        if (onProgress) onProgress(100);
        return [url];
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunks: ChunkInfo[] = [];

    // Slice the file
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        chunks.push({
            index: i,
            blob: file.slice(start, end, file.type),
        });
    }

    const uploadedUrls: string[] = new Array(totalChunks);
    let chunksUploaded = 0;

    // Process chunks with concurrency limit
    // We create an array of "worker" promises
    const uploadQueue = [...chunks];

    const worker = async () => {
        while (uploadQueue.length > 0) {
            const chunkInfo = uploadQueue.shift();
            if (!chunkInfo) break;

            const url = await uploadChunkWithRetry(chunkInfo.blob, chunkInfo.index, ext);
            uploadedUrls[chunkInfo.index] = url;

            chunksUploaded++;
            if (onProgress) {
                // Calculate overall progress across all chunks
                const progress = Math.round((chunksUploaded / totalChunks) * 100);
                onProgress(progress);
            }
        }
    };

    // Run up to MAX_CONCURRENT_UPLOADS workers in parallel
    const workers = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENT_UPLOADS, totalChunks); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);

    // Verify all chunks are uploaded
    if (uploadedUrls.includes(undefined as any)) {
        throw new Error("Some chunks failed to upload properly.");
    }

    return uploadedUrls;
}

const globalBlobCache: Record<string, string> = {};

/**
 * 📥 "Tod Ke Jodo" Receiver
 * Downloads all chunks in parallel and merges them into a single blob.
 */
export async function downloadAndMergeChunks(
    urls: string[],
    mimeType: string = "video/mp4",
    onProgress?: (progress: number) => void
): Promise<string> {
    if (!urls || urls.length === 0) throw new Error("No URLs to download");

    // Cache Key based on joined URLs
    const cacheKey = urls.join('|');
    if (globalBlobCache[cacheKey]) {
        if (onProgress) onProgress(100);
        return globalBlobCache[cacheKey];
    }

    // If only one URL, just fetch it directly (optimization)
    // NOTE: Returning early avoid CORS 'fetch' issues on mobile for single-file media
    if (urls.length === 1) {
        return urls[0];
    }

    const totalChunks = urls.length;
    const chunkBlobs: Blob[] = new Array(totalChunks);
    let chunksDownloaded = 0;

    const downloadChunk = async (url: string, index: number) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to download chunk ${index}`);
            const blob = await response.blob();
            chunkBlobs[index] = blob;
            chunksDownloaded++;
            if (onProgress) onProgress(Math.round((chunksDownloaded / totalChunks) * 100));
        } catch (err) {
            console.error(`Chunk ${index} download error, retrying...`, err);
            // Simple 1-time retry
            const response = await fetch(url);
            const blob = await response.blob();
            chunkBlobs[index] = blob;
            chunksDownloaded++;
        }
    };

    // Download chunks with concurrency limit of 6 (Increased for faster downloads)
    const queue = [...urls.map((url, i) => ({ url, i }))];
    const workers = Array(Math.min(3, totalChunks)).fill(null).map(async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item) await downloadChunk(item.url, item.i);
        }
    });

    await Promise.all(workers);

    // Merge all blobs into one
    const finalBlob = new Blob(chunkBlobs, { type: mimeType });
    const resultUrl = URL.createObjectURL(finalBlob);

    // Save to cache for instant repeat views
    globalBlobCache[cacheKey] = resultUrl;
    return resultUrl;
}
