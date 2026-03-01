/**
 * Uploads a file (or blob) to Catbox.moe
 * @param file The file or blob to upload
 * @returns The URL of the uploaded file
 */
export async function uploadToCatbox(file: Blob | File): Promise<string> {
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", file);

    try {
        const response = await fetch("/api/upload/catbox", {
            method: "POST",
            body: formData,
            // Note: No 'Content-Type' header needed, functionality is automatic with FormData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Upload Failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error("Error uploading to proxy:", error);
        throw error;
    }
}
