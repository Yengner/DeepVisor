/**
 * Removes null, undefined, and empty string values from an object
 * This prevents sending unnecessary fields to the Meta API
 * 
 * @param obj - Object to clean
 * @returns New object with empty values removed
 */
export function removeEmptyFields(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    // Skip null, undefined, and empty string values
    if (obj[key] === null || obj[key] === undefined || obj[key] === '') {
      continue;
    }

    // Handle nested objects recursively
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      result[key] = removeEmptyFields(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Handles common errors from Meta API responses
 * 
 * @param response - Fetch Response object
 * @param entityType - Type of entity being created (campaign, adset, etc)
 * @returns Parsed JSON response if successful
 * @throws Error with detailed message if request failed
 */
export async function handleMetaApiResponse(response: Response, entityType: string): Promise<any> {
  if (!response.ok) {
    const text = await response.text();

    // Try to parse error as JSON to get more details
    try {
      const errorJson = JSON.parse(text);
      const errorMessage = errorJson.error?.message || text;
      const errorType = errorJson.error?.type || 'Unknown';
      const errorCode = errorJson.error?.code || 'Unknown';

      console.error(`❌ Facebook API Error (${entityType}):`, {
        status: response.status,
        type: errorType,
        code: errorCode,
        message: errorMessage
      });

      throw new Error(`Failed to create ${entityType}: ${errorMessage} (Code: ${errorCode})`);
    } catch (e) {
      // If can't parse as JSON, use the raw text
      console.error(`❌ Facebook API Error (${entityType}):`, text);
      throw new Error(`Failed to create ${entityType}. Check logs for full response.`);
    }
  }

  return await response.json();
}

/**
 * Standard function to make a POST request to the Meta API
 * 
 * @param url - API endpoint URL
 * @param params - Parameters to send in the request body
 * @param entityType - Type of entity being created
 * @returns Response data from the API
 */
export async function makeMetaApiPostRequest(
  url: string,
  params: Record<string, any>,
  entityType: string
): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(removeEmptyFields(params))
  });

  return handleMetaApiResponse(response, entityType);
}

/**
 * Standard function to make a GET request to the Meta API
 * 
 * @param url - Base API endpoint URL
 * @param params - Query parameters to append to URL
 * @param entityType - Type of entity being fetched
 * @returns Response data from the API
 */
export async function makeMetaApiGetRequest(
  baseUrl: string,
  params: Record<string, any>,
  entityType: string
): Promise<any> {
  // Create URL with query parameters
  const url = new URL(baseUrl);

  // Add all non-empty parameters to URL
  const cleanParams = removeEmptyFields(params);
  Object.entries(cleanParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      url.searchParams.set(key, value.join(','));
    } else {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  return handleMetaApiResponse(response, entityType);
}

/**
 * Formats a currency amount for Meta API (converts to cents)
 * 
 * @param amount - Amount in dollars
 * @returns Amount in cents as required by Meta API
 */
export function formatCurrency(amount: number): number {
  return Math.floor(amount * 100);
}