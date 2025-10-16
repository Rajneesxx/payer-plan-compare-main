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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const handler = async (event, context) => {
  console.log(`[${new Date().toISOString()}] New Request: ${event.httpMethod} ${event.path}`);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: ''
    };
  }
  
  // Handle non-POST requests
  if (event.httpMethod !== 'POST') {
    const response = {
      status: 'success',
      message: 'Log extraction service is running',
      timestamp: new Date().toISOString(),
      usage: 'Send a POST request with { fileName: string, status: string, error?: string }'
    };
    
    console.log(`[${new Date().toISOString()}] Method not allowed: ${event.httpMethod}`, response);
    
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
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
    const response = {
      status: 'success',
      message: 'Extraction logged successfully',
      timestamp: new Date().toISOString(),
      logPath: logFilePath,
      fileName,
      status: status
    };
    
    console.log(`[${new Date().toISOString()}] Success response:`, response);
    
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
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
    
    const errorResponse = {
      status: 'error',
      error: 'Failed to log extraction',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
    };
    
    console.error(`[${new Date().toISOString()}] Error response:`, errorResponse);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(errorResponse)
    };
  }
};

module.exports = { handler };
