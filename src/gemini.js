/**
 * DipDip Gemini Integration
 * Handles audio transcription via Gemini 3 Flash
 */

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

// Initialize client - will use GOOGLE_API_KEY or GEMINI_API_KEY env var
let ai = null;

// Load prompt from file
function getPrompt() {
  const promptPath = path.join(__dirname, '..', 'prompt.txt');
  return fs.readFileSync(promptPath, 'utf-8').trim();
}

function getClient() {
  if (!ai) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GOOGLE_API_KEY or GEMINI_API_KEY environment variable');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/**
 * Transcribe audio/video using Gemini 3 Flash
 * @param {string} base64Data - Base64 encoded audio/video data
 * @param {string} mimeType - MIME type (e.g., 'audio/webm', 'video/webm')
 * @returns {Promise<string>} The transcription text
 */
async function transcribeAudio(base64Data, mimeType) {
  const client = getClient();

  const response = await client.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { text: getPrompt() },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ]
  });

  return response.text;
}

module.exports = { transcribeAudio };
