// Netlify Function to log successful extractions
const { promises: fs } = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { fileName, status } = JSON.parse(event.body);
    
    // Only log successful extractions
    if (status === 'success') {
      const logDir = path.join(process.cwd(), 'logs');
      const logFilePath = path.join(logDir, 'extraction_logs.txt');

      // Create logs directory if it doesn't exist
      try {
        await fs.mkdir(logDir, { recursive: true });
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }

      const timestamp = new Date().toISOString();
      const logLine = `${timestamp} | ${fileName} | ${status}\n`;

      // Append to log file
      await fs.appendFile(logFilePath, logLine, 'utf8');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Extraction logged successfully' })
    };
  } catch (error) {
    console.error('Error logging extraction:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to log extraction',
        details: error.message 
      })
    };
  }
};
