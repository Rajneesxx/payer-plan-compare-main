// Netlify Function to log extractions
const { promises: fs } = require('fs');
const path = require('path');

// Ensure logs directory exists
const ensureLogsDir = async () => {
  // Use /tmp/ directory which is writable in Netlify Functions
  const logDir = path.join('/tmp', 'extraction-logs');
  console.log('Ensuring log directory exists at:', logDir);
  
  try {
    await fs.mkdir(logDir, { recursive: true });
    console.log('Log directory ready');
    return path.join(logDir, 'extraction_logs.txt');
  } catch (err) {
    console.error('Error creating logs directory:', err);
    throw err;
  }
};

const handler = async (event, context) => {
  console.log('--- New Request ---');
  
  // Handle non-POST requests
  if (event.httpMethod !== 'POST') {
    console.log(`Method not allowed: ${event.httpMethod} ${event.path}`);
    return {
      statusCode: 200, // Return 200 for GET requests to avoid CORS issues
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'success',
        message: 'Log extraction service is running',
        usage: 'Send a POST request with { fileName: string, status: string, error?: string }'
      })
    };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('Received request with body:', JSON.stringify(body, null, 2));
    
    const { fileName, status, error } = body;
    const logFilePath = await ensureLogsDir();
    
    const timestamp = new Date().toISOString();
    const logLine = error 
      ? `${timestamp} | ${fileName} | ${status} | Error: ${error}\n`
      : `${timestamp} | ${fileName} | ${status}\n`;

    console.log('Writing log entry to:', logFilePath);
    await fs.appendFile(logFilePath, logLine, 'utf8');
    
    console.log('Successfully wrote to log file');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Extraction logged successfully',
        logPath: logFilePath
      })
    };
  } catch (error) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      path: event.path,
      method: event.httpMethod
    };
    
    console.error('Error in logExtraction:', JSON.stringify(errorDetails, null, 2));
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'error',
        error: 'Failed to log extraction',
        ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
      })
    };
  }
};

module.exports = { handler };
