# 🇮🇳 ConnectSphere: The "Jugaad" Blueprint (India Ka Apna Social Media)

> **Mission:** Build a "Desi" Instagram-killer that is completely free, scalable, and hosted on high-performance free-tier architectures.
> **Philosophy:** "Zero Cost, Infinite Scale." (₹0 Budget)

---

## 🏗️ The "Unlimited" Storage Strategy (The Catbox Protocol)

To support **Original Quality** files >200MB (e.g., 500MB) on a free host with a 200MB limit, we used **"The Chunking Hack"**.

### 💡 The Logic: "Tod Ke Jodo" (Split & Merge)
We use **Catbox.moe** (200MB Limit per file) as the host.
1.  **Scenario:** User sends a **500MB** file.
2.  **Upload (Frontend):** We split the file into **3 parts** (200MB + 200MB + 100MB) inside the browser.
3.  **Storage:** We upload 3 chunks to Catbox. We get 3 links.
4.  **Database:** We store the links as an array: `["link1", "link2", "link3"]`.
5.  **Download (Receiver):** The receiver's app downloads all 3 parts and **merges** them back into the original 500MB file instantly.
    -   *Result:* 100% Original Quality. Zero Server Cost.

---

## ⚡ Revised Tech Stack

### 1. Frontend (The Brains)
-   **Framework:** Next.js 14+ (App Router).
-   **Hosting:** **Cloudflare Pages**.
-   **Logic:** **Client-Side Chunking** using JavaScript `Blob.slice()`.

### 2. Backend (The Metadata Manager)
-   **Host:** **Hugging Face Spaces** (Docker/Node.js).
-   **Role:**
    -   **Proxy:** Only for small metadata exchanges.
    -   **Thumbnailer:** Generates thumbnails for videos.

### 3. Database (The Ledger)
-   **Supabase (PostgreSQL):** Stores User Data and File Arrays.

---

## 📝 The "Master Prompt" for AI Agent

**Copy paste this to start building:**

> "Act as a Senior Architect. We are building 'ConnectSphere', an Indian social media app.
>
> **Core Requirement: Unlimited Free Storage & Original Quality (500MB+).**
>
> **Architecture Overview:**
> 1. **Storage Engine:** **Catbox.moe** (Direct Uploads).
>    -   **Constraint:** Max file size 200MB.
>    -   **Solution:** Implement **File Chunking**. If file > 200MB, split it client-side into chunks of 190MB.
> 2. **Database:** Supabase.
>    -   `media_urls`: Array of Text `['url1', 'url2']` to support chunked files.
>
> **Task 1: The 'Jugaad' Storage (Frontend Logic)**
> -   Create a `FileUpload` component in Next.js.
> -   **Logic:**
>     -   If file < 200MB: Upload directly to Catbox.
>     -   If file > 200MB: Loop and slice file into chunks. Upload each chunk. Collect all URLs.
> -   **Download Logic:**
>     -   Create a `FileDownloader` utility.
>     -   If multiple URLs: Fetch all blobs, merge them (`new Blob([blob1, blob2])`), and trigger download.
>
> **Task 2: The Backend (Hugging Face)**
> -   Write a Node.js `server.js`.
> -   **Implement Thumbnailing:**
>     -   Since we upload directly to Catbox from frontend, we need a way to generate thumbnails.
>     -   *Strategy:* Frontend captures the first frame of video (canvas hack) and uploads it as a separate JPG to Catbox. No backend needed!
>
> **Task 3: Database Schema**
> -   Table `messages`:
>     -   `file_urls` (Array of Text).
>     -   `file_name` (Text).
>     -   `file_size` (Int).
>     -   `thumbnail_url` (Text).
>
> **Aesthetics:**
> -   Use 'Glassmorphism' + 'Desi' vibrant color palette.
>
> Let's start by scaffolding the Project Structure."
