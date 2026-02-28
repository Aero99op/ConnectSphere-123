import { uploadToCatbox } from "@/lib/storage";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB for better parallelization and lower memory usage
const MAX_CONCURRENT_UPLOADS = 6; // Increased for faster multi-chunk uploads
const MAX_RETRIES = 3;

interface ChunkInfo {
    index: number;
    blob: Blob;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadChunkWithRetry(chunk: Blob, index: number, retries = 0): Promise<string> {
    try {
        // Direct upload since it's a chunk (passed to storage.ts which handles switching)
        const fileToUpload = new File([chunk], `chunk_${index}`, { type: chunk.type });
        const url = await uploadToCatbox(fileToUpload, { useProxy: false });
        return url;
    } catch (error) {
        if (retries < MAX_RETRIES) {
            console.warn(`Chunk ${index} failed, retrying (${retries + 1}/${MAX_RETRIES})...`);
            await delay(1000 * Math.pow(2, retries)); // Exponential backoff: 1s, 2s, 4s
            return uploadChunkWithRetry(chunk, index, retries + 1);
        }
        throw new Error(`Failed to upload chunk ${index} after ${MAX_RETRIES} retries.`);
    }
}

export async function uploadFileInChunks(
    file: File,
    onProgress?: (progress: number) => void
): Promise<string[]> {
    if (file.size <= CHUNK_SIZE) {
        // Direct upload for small files
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

            const url = await uploadChunkWithRetry(chunkInfo.blob, chunkInfo.index);
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

    // If only one URL, just fetch it directly (optimization)
    if (urls.length === 1) {
        const response = await fetch(urls[0]);
        const blob = await response.blob();
        return URL.createObjectURL(new Blob([blob], { type: mimeType }));
    }

    const totalChunks = urls.length;
    const chunkBlobs: Blob[] = new Array(totalChunks);
    let chunksDownloaded = 0;

    const downloadChunk = async (url: string, index: number) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download chunk ${index}`);
        const blob = await response.blob();
        chunkBlobs[index] = blob;
        chunksDownloaded++;
        if (onProgress) onProgress(Math.round((chunksDownloaded / totalChunks) * 100));
    };

    // Download chunks in parallel (browser handles max concurrent connections)
    await Promise.all(urls.map((url, i) => downloadChunk(url, i)));

    // Merge all blobs into one
    const finalBlob = new Blob(chunkBlobs, { type: mimeType });
    return URL.createObjectURL(finalBlob);
}
