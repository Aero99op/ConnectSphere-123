const url = "https://fzvxoagkuhmodbxcwmjh.supabase.co/rest/v1/messages?select=*,sender:profiles!sender_id(username,full_name,avatar_url),post:posts(id,file_urls,thumbnail_url,media_type,caption),story:stories(id,media_url,media_type)&conversation_id=eq.eec34c2b-58e3-4573-b064-e923eefd3570";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dnhvYWdrdWhtb2RieGN3bWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjY3ODksImV4cCI6MjA4Njc0Mjc4OX0.gH1sdO6zCrYt1LUjOPVdp2zEmtCmDIyollNCwbBUxzM";

fetch(url, {
    headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Cache-Control': 'no-cache'
    }
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);
