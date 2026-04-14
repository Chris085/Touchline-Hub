/**
 * A custom fetch wrapper to avoid overwriting window.fetch
 * and provide consistent error handling and JSON parsing.
 */

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function clientFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;

  // 1. Handle base URL (if needed)
  // For now, we'll assume relative or absolute URLs are passed
  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams(params);
    finalUrl += `?${searchParams.toString()}`;
  }

  // 2. Set default headers
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  try {
    // 3. Use the native fetch
    const response = await fetch(finalUrl, {
      ...rest,
      headers: defaultHeaders,
    });

    // 4. Handle HTTP errors
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
      try {
        const parsedError = JSON.parse(errorBody);
        errorMessage = parsedError.message || errorMessage;
      } catch {
        // Not JSON, use the status text
      }
      throw new Error(errorMessage);
    }

    // 5. Parse JSON response
    // If the response is empty (e.g., 204 No Content), return null or empty object
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    // 6. Log and re-throw
    console.error(`[clientFetch] Error fetching ${finalUrl}:`, error);
    throw error;
  }
}

/**
 * Example Service Class usage
 */
export class ApiService {
  static async get<T>(url: string, params?: Record<string, string>) {
    return clientFetch<T>(url, { method: 'GET', params });
  }

  static async post<T>(url: string, body: any) {
    return clientFetch<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static async put<T>(url: string, body: any) {
    return clientFetch<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  static async delete<T>(url: string) {
    return clientFetch<T>(url, { method: 'DELETE' });
  }
}
