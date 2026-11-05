const BASE_URL = '/api/v1';

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      'Unable to connect to backend server. Please verify the backend API is running on http://localhost:4000.',
      0,
      { isNetworkError: true }
    );
  }

  let json: any = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    let errorMessage = json.message;
    if (!errorMessage) {
      if (response.status === 504 || response.status === 502) {
        errorMessage = 'Backend API is offline or unreachable (504/502). Please start the backend server.';
      } else if (response.status === 500) {
        errorMessage = 'Internal Server Error (500). Please check backend server console logs.';
      } else {
        errorMessage = `Request failed with status ${response.status}: ${response.statusText || 'Unknown error'}`;
      }
    }

    throw new ApiError(errorMessage, response.status, json);
  }

  if (json.data !== undefined) {
    if (typeof json.data === 'object' && json.data !== null && !Array.isArray(json.data) && json.message && !('message' in json.data)) {
      return { ...json.data, message: json.message } as T;
    }
    return json.data as T;
  }

  return json as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
