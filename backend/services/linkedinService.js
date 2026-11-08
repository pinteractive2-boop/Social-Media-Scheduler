const zernioService = require('./zernioService');

function assertPlatform(post) {
  if (post.platform !== 'linkedin') {
    const error = new Error('LinkedIn service received a non-LinkedIn post');
    error.code = 'UNSUPPORTED_PLATFORM';
    throw error;
  }
}

async function schedule(post, idempotencyKey) {
  assertPlatform(post);
  return zernioService.createScheduledPost(post, idempotencyKey);
}

async function getStatus(post) {
  assertPlatform(post);
  return zernioService.getPost(post.providerPostId);
}

async function updateScheduledPost(post) {
  assertPlatform(post);
  return zernioService.updateScheduledPost(post);
}

async function deleteScheduledPost(post) {
  assertPlatform(post);
  return zernioService.deleteScheduledPost(post.providerPostId);
}

module.exports = { schedule, getStatus, updateScheduledPost, deleteScheduledPost };
