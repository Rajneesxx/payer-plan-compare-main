// netlify/functions/logExtraction.js
const fs = require('fs');
const path = require('path');

<<<<<<< HEAD
// Use a persistent storage location for logs
const LOG_DIR = path.join(process.cwd(), 'logs');
=======
// In Netlify Functions, we can use /tmp for temporary storage
const LOG_DIR = '/tmp/extraction-logs';
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
const LOG_FILE = path.join(LOG_DIR, 'extraction_logs.txt');

// Ensure logs directory exists
const ensureLogsDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
<<<<<<< HEAD
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }
=======
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }
  console.log(`Log file location: ${LOG_FILE}`);
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
};

// Initialize logs directory
ensureLogsDir();

<<<<<<< HEAD
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
=======
const handler = async (event) => {
  console.log('Received request:', {
    method: event.httpMethod,
    path: event.path,
    body: event.body
  });

  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
    };
  }

  try {
    const { fileName, status, error } = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status.toUpperCase()} - ${fileName}${error ? ` - ${error}` : ''}\n`;

    // Append to log file
    fs.appendFileSync(LOG_FILE, logEntry);
<<<<<<< HEAD

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
=======
    console.log('Successfully wrote log entry:', logEntry.trim());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Log entry created',
        logPath: LOG_FILE
      })
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
      })
    };
  }
};

<<<<<<< HEAD
module.exports = { handler };
=======
module.exports = { handler };
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
