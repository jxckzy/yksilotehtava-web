import {apiURL} from './config.js';

export const requestJSON = async (path, {method = 'GET', body, token} = {}) => {
  const headers = {};
  const isFormData = body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiURL + path, {
    method,
    headers,
    body:
      body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Response not ok: ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const fetchData = (path, token) => requestJSON(path, {token});
