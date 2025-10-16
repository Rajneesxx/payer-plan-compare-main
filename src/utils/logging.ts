// src/utils/logging.ts
export async function logExtraction(
  fileName: string,
  status: 'started' | 'success' | 'error',
  details?: string
): Promise<{ success: boolean; message?: string }> {
  const endpoint = '/.netlify/functions/logExtraction';
  const timestamp = new Date().toISOString();
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        status,
        ...(details && { error: details }),
        timestamp
      }),
    });

    if (!response.ok) {
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
  }
}
