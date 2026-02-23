const https = require('https');

// Keep-Alive Mechanism
// Pings the server every 14 minutes to prevent sleep (15 min timeout usually)
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:7860'; // Set this in Env!

function startKeepAlive() {
    console.log(`Starting Keep-Alive Pinger... Target: ${SERVER_URL}`);

    setInterval(() => {
        console.log(`Pinging ${SERVER_URL}/ping...`);
        https.get(`${SERVER_URL}/ping`, (res) => {
            console.log(`Keep-Alive Status: ${res.statusCode}`);
        }).on('error', (e) => {
            console.error(`Keep-Alive Error: ${e.message}`);
        });
    }, PING_INTERVAL);
}

module.exports = { startKeepAlive };
