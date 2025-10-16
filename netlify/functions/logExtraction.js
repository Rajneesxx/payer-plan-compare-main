// Netlify Function to log extractions
const { promises: fs } = require('fs');
const path = require('path');

// Ensure logs directory exists
const ensureLogsDir = async () => {
  try {
    // Use /tmp/ directory which is writable in Netlify Functions
    const logDir = path.join('/tmp', 'extraction-logs');
    const logFile = path.join(logDir, 'extraction_logs.txt');
    
    console.log(`[${new Date().toISOString()}] Ensuring log directory exists at: ${logDir}`);
    
    try {
      await fs.access(logDir);
      console.log(`[${new Date().toISOString()}] Log directory already exists`);
    } catch (err) {
      console.log(`[${new Date().toISOString()}] Creating log directory`);
      await fs.mkdir(logDir, { recursive: true });
      console.log(`[${new Date().toISOString()}] Log directory created`);
    }
    
    // Verify we can write to the directory
    try {
      await fs.access(logDir, fs.constants.W_OK);
      console.log(`[${new Date().toISOString()}] Log directory is writable`);
      return logFile;
    } catch (err) {
      const error = new Error(`Cannot write to log directory: ${logDir}`);
      error.code = 'EACCES';
      throw error;
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error in ensureLogsDir:`, {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
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
    
    // Format log line with consistent timestamp format
    const logLine = error 
      ? `[${timestamp}] | ${fileName} | ${status} | Error: ${error}\n`
      : `[${timestamp}] | ${fileName} | ${status}\n`;

    console.log(`[${timestamp}] Attempting to write to log file: ${logFilePath}`);
    
    try {
      await fs.appendFile(logFilePath, logLine, 'utf8');
      console.log(`[${timestamp}] Successfully wrote to log file`);
      
      // Verify the write was successful
      const stats = await fs.stat(logFilePath);
      console.log(`[${timestamp}] Log file stats: ${JSON.stringify({
        size: stats.size,
        mtime: stats.mtime
      })}`);
    } catch (writeErr) {
      console.error(`[${timestamp}] Failed to write to log file:`, {
        message: writeErr.message,
        code: writeErr.code,
        path: logFilePath
      });
      throw writeErr;
    }
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
