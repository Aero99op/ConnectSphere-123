# 🏠 Local Database Setup (Supabase)

You requested to run the Database **Locally**. We will use the official Supabase CLI (via Docker) to simulate the full Supabase stack on your machine.

## Prerequisites
-   **Docker Desktop** must be installed and running.

## Step 1: Start Supabase Locally
Run this command in your terminal (Root folder `d:\connectsphere1`):
```bash
npx supabase start
```
*First time might take a few minutes to download Docker images.*

## Step 2: Get Local Keys
Once started, you will see output like this:
```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 3: Update Frontend Config
1.  Open `frontend\.env.local`.
2.  Replace the values with the **Local** ones you just got:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key_here
    ```

## Step 4: Apply Schema
Running the schema locally is easy:
1.  Copy the content of `supabase_schema.sql`.
2.  Go to the local dashboard: `http://127.0.0.1:54323` (Studio).
3.  Go to **SQL Editor** and run the script.

Now your entire app (Frontend + DB + Auth) is running locally! 🚀
