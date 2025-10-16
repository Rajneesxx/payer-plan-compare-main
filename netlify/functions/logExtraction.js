// Netlify Function to log extractions
const { promises: fs } = require('fs');
const path = require('path');

// Ensure logs directory exists
const ensureLogsDir = async () => {
  const logDir = path.join(__dirname, 'logs');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('Error creating logs directory:', err);
      throw err;
    }
  }
  return path.join(logDir, 'extraction_logs.txt');
};

const handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { fileName, status, error } = JSON.parse(event.body);
    const logFilePath = await ensureLogsDir();
    
    const timestamp = new Date().toISOString();
    const logLine = error 
      ? `${timestamp} | ${fileName} | ${status} | Error: ${error}\n`
      : `${timestamp} | ${fileName} | ${status}\n`;

    // Append to log file
    await fs.appendFile(logFilePath, logLine, 'utf8');
    
    console.log('Logged extraction:', { fileName, status, timestamp });
    if (error) console.error('Error details:', error);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Extraction logged successfully',
        logPath: logFilePath
      })
    };
  } catch (error) {
    console.error('Error in logExtraction function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to log extraction',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// Export the handler as required by Netlify
module.exports = { handler };