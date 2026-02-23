const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7860; // 7860 is default for HuggingFace Spaces

// Middleware
app.use(cors({
    origin: '*', // In production, restrict this to your Cloudflare Pages domain
    methods: ['GET', 'POST']
}));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({
        message: "ConnectSphere Heavy Lifting Microservice is running! 🚀",
        status: "Active"
    });
});

app.get('/api/health', (req, res) => {
    // Health check endpoint for Docker/Platforms
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Speech Analytics logic 🎙️
app.post('/api/process-audio', (req, res) => {
    const { transcription, durationSeconds } = req.body;

    if (!transcription || !durationSeconds) {
        return res.status(400).json({ error: "Transcription and durationSeconds are required!" });
    }

    // Security Hardening: Prevent DoS via massive strings
    if (transcription.length > 50000) {
        return res.status(413).json({ error: "Talk is cheap, but this transcription is too long! Limit is 50k chars." });
    }

    // 1. Calculate Words Per Minute (WPM)
    const words = transcription.trim().split(/\s+/).length;
    const wpm = Math.round((words / durationSeconds) * 60);

    // 2. Detect Filler Words (The Standard common list)
    const fillers = ["um", "uh", "like", "you know", "actually", "basically", "literally", "mtlb", "samajha", "toh"];
    const foundFillers = {};

    fillers.forEach(filler => {
        const regex = new RegExp(`\\b${filler}\\b`, 'gi');
        const count = (transcription.match(regex) || []).length;
        if (count > 0) foundFillers[filler] = count;
    });

    const totalFillerCount = Object.values(foundFillers).reduce((a, b) => Number(a) + Number(b), 0);

    // 3. Pace Consistency (Simplified: 120-160 WPM is ideal)
    let paceRating = "Normal";
    if (wpm < 100) paceRating = "Slow";
    if (wpm > 170) paceRating = "Fast";

    res.json({
        report: {
            wpm,
            totalWords: words,
            paceRating,
            fillerWords: foundFillers,
            totalFillers: totalFillerCount,
            advice: totalFillerCount > 5 ? "Try to reduce filler words to sound more confident!" : "Solid delivery!"
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 ConnectSphere Backend running on port ${PORT}`);
});
