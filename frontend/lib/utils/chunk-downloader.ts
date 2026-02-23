// \lib\utils\chunk-downloader.ts

const MAX_RETRIES = 3;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchChunkWithRetry(url: string, index: number, retries = 0): Promise<Blob> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch chunk ${index}: ${response.statusText}`);
        }
        return await response.blob();
    } catch (error) {
        if (retries < MAX_RETRIES) {
            console.warn(`Failed to grab chunk ${index}, retrying (${retries + 1}/${MAX_RETRIES})...`);
            await delay(1000 * Math.pow(2, retries));
            return fetchChunkWithRetry(url, index, retries + 1);
        }
        throw new Error(`Max retries reached fetching chunk ${index}`);
    }
}

/**
 * Downloads multiple chunks and merges them back into a single Blob (Object URL).
 * Used for transparently reassembling 200MB+ files.
 */
export async function downloadAndMergeChunks(
    urls: string[],
    mimeType: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    if (!urls || urls.length === 0) {
        throw new Error("No duplicate URLs provided to merge.");
    }

    // Fast path: if only one chunk, just return it directly or fetch it normally
    // For single files, the UI might just use the URL directly, but if they pass it here, we fetch and blob it.
    if (urls.length === 1) {
        const singleBlob = await fetchChunkWithRetry(urls[0], 0);
        if (onProgress) onProgress(100);
        return URL.createObjectURL(singleBlob);
    }

    const blobs: Blob[] = new Array(urls.length);
    let chunksDownloaded = 0;

    // Concurrency Control (MOSSAD-Level Memory Management)
    // We only download 2 chunks at a time to prevent RAM spikes on low-end phones
    const downloadQueue = [...urls.map((url, index) => ({ url, index }))];
    const MAX_CONCURRENT_DOWNLOADS = 2;

    const worker = async () => {
        while (downloadQueue.length > 0) {
            const item = downloadQueue.shift();
            if (!item) break;

            const blob = await fetchChunkWithRetry(item.url, item.index);
            blobs[item.index] = blob;

            chunksDownloaded++;
            if (onProgress) {
                const progress = Math.round((chunksDownloaded / urls.length) * 100);
                onProgress(progress);
            }
        }
    };

    const workers = [];
    const workerCount = Math.min(MAX_CONCURRENT_DOWNLOADS, urls.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);

    // Verify all parts are there
    if (blobs.includes(undefined as any)) {
        throw new Error("Some chunks failed to download, unable to merge completely.");
    }

    // Merge! ('Tod ke Jodo' success point)
    const mergedBlob = new Blob(blobs, { type: mimeType });
    return URL.createObjectURL(mergedBlob);
}
