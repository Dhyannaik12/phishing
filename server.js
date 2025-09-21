const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // Use require for CommonJS

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies and serve static files
app.use(express.json());

// --- Gemini API Configuration ---
// IMPORTANT: Do NOT hardcode your API key here. Use environment variables.
// Set this variable in your terminal before running the server:
// export GEMINI_API_KEY='YOUR_API_KEY'
const apiKey = process.env.GEMINI_API_KEY || ""; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

// --- Serve the HTML frontend ---
// This serves your index.html file when someone visits the root URL (e.g., http://localhost:3000)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- API Endpoint for URL Analysis ---
app.post('/api/analyze', async (req, res) => {
    if (!apiKey) {
        return res.status(500).json({ 
            status: 'Error', 
            score: 'N/A',
            message: 'API key is not configured on the server.' 
        });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ 
            status: 'Error', 
            score: 'N/A',
            message: 'URL is required.' 
        });
    }

    // --- Prompt Engineering for Gemini ---
    const systemPrompt = `You are a world-class cybersecurity analyst specializing in phishing detection. Your task is to analyze the provided URL and determine its threat level. 
    
    You MUST respond in a valid JSON format that adheres to the provided schema.
    
    Analysis criteria:
    - Examine the URL for common phishing patterns (e.g., typosquatting, misleading subdomains, suspicious TLDs).
    - Check for keywords often used in phishing attacks (e.g., 'login', 'verify', 'secure', 'account-update').
    - Assess the overall trustworthiness of the URL structure.
    
    Response fields:
    - "status": Must be one of three exact strings: "Safe", "Suspicious", or "PHISHING DETECTED".
    - "score": An integer between 0 (high risk) and 100 (very safe). A safe site should be > 85, suspicious 40-85, and phishing < 40.
    - "message": A concise, one-sentence explanation for the user, justifying your analysis.`;

    const payload = {
        contents: [{ parts: [{ text: `Analyze the following URL for phishing threats: ${url}` }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    status: { type: "STRING" },
                    score: { type: "NUMBER" },
                    message: { type: "STRING" }
                },
                required: ["status", "score", "message"]
            }
        }
    };

    try {
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`Gemini API responded with status: ${geminiResponse.status}`);
        }

        const result = await geminiResponse.json();
        
        const candidate = result.candidates?.[0];
        const jsonText = candidate?.content?.parts?.[0]?.text;

        if (jsonText) {
            const parsedJson = JSON.parse(jsonText);
            console.log('Gemini Analysis:', parsedJson);
            res.json(parsedJson);
        } else {
            throw new Error("Invalid response structure from Gemini API.");
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ 
            status: 'Error', 
            score: 'N/A',
            message: 'Failed to get analysis from the AI model.' 
        });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Make sure to set your GEMINI_API_KEY environment variable.');
});

