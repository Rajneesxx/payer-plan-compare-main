<<<<<<< HEAD

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
    
=======
// src/utils/logging.ts
export async function logExtraction(
  fileName: string,
  status: 'started' | 'success' | 'error',
  details?: string
): Promise<{ success: boolean; message?: string }> {
  const endpoint = '/.netlify/functions/logExtraction';
  const timestamp = new Date().toISOString();
  
  try {
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
<<<<<<< HEAD
      body: JSON.stringify(requestBody),
=======
      body: JSON.stringify({
        fileName,
        status,
        ...(details && { error: details }),
        timestamp
      }),
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
    });

    const responseText = await response.text();
    
    if (!response.ok) {
<<<<<<< HEAD
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
=======
      const errorText = await response.text();
      console.error(`Failed to log extraction (${response.status}): ${errorText}`);
      return { 
        success: false, 
        message: errorText || 'Failed to log extraction' 
      };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    console.error('Error in logExtraction:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error'
    };
>>>>>>> 667357627ff8a497d37cb8af2aa634834400e720
  }
}
