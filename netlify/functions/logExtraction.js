// netlify/functions/logExtraction.js
const fs = require('fs');
const path = require('path');

// Use a persistent storage location for logs
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'extraction_logs.txt');

// Ensure logs directory exists
const ensureLogsDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }
};

// Initialize logs directory
ensureLogsDir();

const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { fileName, status, error } = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status.toUpperCase()} - ${fileName}${error ? ` - ${error}` : ''}\n`;

    // Append to log file
    fs.appendFileSync(LOG_FILE, logEntry);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, message: 'Log entry created' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};

module.exports = { handler };