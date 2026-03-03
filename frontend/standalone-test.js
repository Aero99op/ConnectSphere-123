const crypto = require('crypto');

function md5Hex(str) {
    return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function signRequest(secret, method, path, body, timestamp) {
    const bodyMD5 = body === '' ? '' : md5Hex(body);
    const sigString = `${timestamp}\n${method}\n${path}\n${bodyMD5}`;
    return crypto.createHmac('sha256', secret).update(sigString, 'utf8').digest('hex');
}

const appId = 'a642bc88-0e01-40ca-bade-0305c9ad42a4';
const appKey = 'app_2dd04bc7a4e6f4c949dbcb6b3b53659685f04fb5';
const appSecret = '8aa9fa6a280324ecace4b72248099ffdb0486936530cb9bc0daeb6fe1fe101c5';
const cluster = 'eu';
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
