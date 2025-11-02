// netlify/functions/logExtraction.js
const fs = require('fs');
const path = require('path');

// Check if we're running in Netlify environment
const isNetlifyEnvironment = process.env.NETLIFY === 'true' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

// Use appropriate storage location based on environment
const LOG_DIR = isNetlifyEnvironment
  ? '/tmp/extraction-logs'  // Use /tmp in Netlify environment (writable)
  : path.join(process.cwd(), 'logs'); // Use local path in development
const LOG_FILE = path.join(LOG_DIR, 'extraction_logs.txt');

// Ensure logs directory exists
const ensureLogsDir = () => {
  try {
    // Log environment information first (in case directory creation fails)
    console.log(`Environment: ${isNetlifyEnvironment ? 'Netlify' : 'Development'}`);
    console.log(`Log directory: ${LOG_DIR}`);
    console.log(`Log file location: ${LOG_FILE}`);
    
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      console.log(`Created log directory: ${LOG_DIR}`);
    }
    
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '');
      console.log(`Created log file: ${LOG_FILE}`);
    }
  } catch (error) {
    console.error('Error setting up log directory/file:', error);
    // Continue execution even if log setup fails
  }
};

// Initialize logs directory
ensureLogsDir();

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
    };
  }

  try {
    const { fileName, status, error } = JSON.parse(event.body);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${status.toUpperCase()} - ${fileName}${error ? ` - ${error}` : ''}\n`;

    // Append to log file with error handling
    try {
      fs.appendFileSync(LOG_FILE, logEntry);
      console.log('Successfully wrote log entry:', logEntry.trim());
    } catch (writeError) {
      console.error('Error writing to log file:', writeError);
      // Proceed with the request even if logging fails
      // This prevents logging failures from breaking the application
    }

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
      })
    };
  }
};

module.exports = { handler };


