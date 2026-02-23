
const axios = require('axios');
require('dotenv').config();

async function callOpenRouter(prompt, model = 'zhipuai/glm-4-5-chat') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('Error: OPENROUTER_API_KEY missing in .env file, lodu!');
        return;
    }

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [{ role: 'user', content: prompt }],
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/google-deepmind/antigravity', // Optional
                },
            }
        );

        console.log(response.data.choices[0].message.content);
    } catch (error) {
        console.error('API Error:', error.response ? error.response.data : error.message);
    }
}

const prompt = process.argv.slice(2).join(' ');
if (prompt) {
    callOpenRouter(prompt);
} else {
    console.log('Prompt toh de, bsdk!');
}
