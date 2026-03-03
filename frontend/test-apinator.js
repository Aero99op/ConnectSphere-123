const { getApinatorServer } = require('./lib/apinator-server');
require('dotenv').config({ path: '.env.local' });

async function testTrigger() {
    console.log("Starting Apinator trigger test...");
    const server = getApinatorServer();
    try {
        const result = await server.trigger({
            channel: 'test-channel',
            name: 'test-event',
            data: { message: 'Hello from verification script!' }
        });
        console.log("Success! Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Trigger Failed!");
        console.error(error);
    }
}

testTrigger();
