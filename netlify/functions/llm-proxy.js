export default async (request, context) => {
    // Only allow POST requests
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        
        // Target URL and API key from environment variables
        const llmUrl = process.env.LLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
        const apiKey = process.env.LLM_API_KEY;

        if (!apiKey) {
            console.error('LLM_API_KEY environment variable is missing.');
            return new Response(JSON.stringify({ error: 'LLM_API_KEY is not configured on the server.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://medgame.netlify.app',
            'X-Title': 'MedGame'
        };

        const response = await fetch(llmUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        // Forward response headers and body (supporting SSE streaming)
        return new Response(response.body, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

    } catch (error) {
        console.error('Proxy Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
