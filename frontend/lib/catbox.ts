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
        const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData,
            // Note: No 'Content-Type' header needed, functionality is automatic with FormData
        });

        if (!response.ok) {
            throw new Error(`Catbox Upload Failed: ${response.statusText}`);
        }

        const url = await response.text();
        return url;
    } catch (error) {
        console.error("Error uploading to Catbox:", error);
        throw error;
    }
}
