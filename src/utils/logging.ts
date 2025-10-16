/**
 * Logs extraction events to a serverless function
 * @param fileName - Name of the extracted file
 * @param status - Status of the extraction ('success' or 'error')
 * @param error - Optional error details if status is 'error'
 */
export async function logExtraction(
  fileName: string,
  status: 'success' | 'error',
  error?: string
): Promise<void> {
  try {
    const response = await fetch('/.netlify/functions/logExtraction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        status,
        ...(error && { error }),
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      console.error('Failed to log extraction:', await response.text());
    }
  } catch (err) {
    console.error('Error logging extraction:', err);
  }
}
