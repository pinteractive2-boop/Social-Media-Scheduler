const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && body.error
        ? body.error
        : `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body;
}

export function getPosts() {
  return request('/posts');
}

export function getCurrentUser() {
  return request('/auth/me');
}

export function registerUser(user) {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
}

export function loginUser(credentials) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}

export function logoutUser() {
  return request('/auth/logout', { method: 'POST' });
}

export function getConnectedAccounts() {
  return request('/integrations/accounts');
}

export function getAccountConnectUrl(platform) {
  return request(`/integrations/${platform}/connect`);
}

export function getPostStatus(id) {
  return request(`/posts/${id}/status`);
}

export function createPost(post, image) {
  if (image) {
    const formData = new FormData();
    formData.append('caption', post.caption);
    formData.append('platform', post.platform);
    formData.append('accountId', post.accountId);
    formData.append('scheduledAt', post.scheduledAt);
    formData.append('image', image);
    return request('/posts', { method: 'POST', body: formData });
  }

  return request('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
}

export function updatePost(id, post, image, removeImage) {
  if (image || removeImage) {
    const formData = new FormData();
    formData.append('caption', post.caption);
    formData.append('platform', post.platform);
    formData.append('accountId', post.accountId);
    formData.append('scheduledAt', post.scheduledAt);
    if (image) formData.append('image', image);
    if (removeImage) formData.append('imageUrl', '');
    return request(`/posts/${id}`, { method: 'PUT', body: formData });
  }

  return request(`/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
}

export function deletePost(id) {
  return request(`/posts/${id}`, { method: 'DELETE' });
}
