const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { startKeepAlive } = require('./keep-alive');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7860;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check / Ping Route (Keep-Alive)
app.get('/ping', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'ConnectSphere Backend is Alive!', timestamp: new Date().toISOString() });
});

// Root Route
app.get('/', (req, res) => {
    res.send('ConnectSphere Metadata Server Running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Start Self-Pinger (Only if in production or explicitly enabled)
    if (process.env.NODE_ENV === 'production') {
        startKeepAlive();
    }
});
//ok//