const crypto = require('crypto');

function md5Hex(str) {
    return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function signRequest(secret, method, path, body, timestamp) {
    const bodyMD5 = body === '' ? '' : md5Hex(body);
    const sigString = `${timestamp}\n${method}\n${path}\n${bodyMD5}`;
    return crypto.createHmac('sha256', secret).update(sigString, 'utf8').digest('hex');
}

const appId = process.env.APINATOR_APP_ID || 'YOUR_APP_ID';
const appKey = process.env.APINATOR_KEY || 'YOUR_APP_KEY';
const appSecret = process.env.APINATOR_SECRET || 'YOUR_APP_SECRET';
const cluster = process.env.NEXT_PUBLIC_APINATOR_CLUSTER || 'us';
const host = `https://ws-${cluster}.apinator.io`;

async function testTrigger() {
    const body = JSON.stringify({
        name: 'test-event',
        channel: 'test-channel',
        data: JSON.stringify({ message: 'Hello from standalone verification script!' })
    });

    const path = `/apps/${appId}/events`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(appSecret, 'POST', path, body, timestamp);

    console.log("Timestamp:", timestamp);
    console.log("Signature:", signature);
    console.log("URL:", `${host}${path}`);

    try {
        const response = await fetch(`${host}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Realtime-Key': appKey,
                'X-Realtime-Timestamp': timestamp.toString(),
                'X-Realtime-Signature': signature,
            },
            body: body,
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response:", text);
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testTrigger();
