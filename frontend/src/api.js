const API_BASE_URL = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && body.error
        ? body.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export function getPosts() {
  return request('/posts');
}

export function createPost(post, image) {
  if (image) {
    const formData = new FormData();
    formData.append('caption', post.caption);
    formData.append('platform', post.platform);
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
