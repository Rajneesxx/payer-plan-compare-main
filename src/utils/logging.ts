
export async function logExtraction(
  fileName: string,
  status: 'started' | 'success' | 'error',
  error?: string
): Promise<{ success: boolean; message?: string }> {
  const endpoint = '/.netlify/functions/logExtraction';
  const timestamp = new Date().toISOString();
  const requestBody = {
    fileName,
    status,
    ...(error && { error }),
    timestamp
  };

  try {
    console.log(`[${timestamp}] Sending log request:`, JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      const errorMsg = `Failed to log extraction (${response.status}): ${responseText}`;
      console.error(`[${timestamp}] ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    try {
      const data = responseText ? JSON.parse(responseText) : {};
      console.log(`[${timestamp}] Log successful:`, data);
      return { success: true, ...data };
    } catch (parseError) {
      console.error(`[${timestamp}] Failed to parse response:`, parseError);
      return { 
        success: false, 
        message: 'Invalid response format from logging service' 
      };
    }
  } catch (err) {
    const errorMsg = `Error in logExtraction: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[${timestamp}] ${errorMsg}`);
    return { success: false, message: errorMsg };
  }
}
