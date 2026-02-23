export async function uploadToCatbox(file: File | Blob): Promise<string> {
    const formData = new FormData();
    // Proxy expects 'file'
    formData.append("file", file);

    try {
        // Call our own Next.js Proxy API to bypass CORS
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${errorText}`);
        }

        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
}
