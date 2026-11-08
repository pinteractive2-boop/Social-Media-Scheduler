const instagramService = require('./instagramService');
const linkedinService = require('./linkedinService');

const platformServices = {
  instagram: instagramService,
  linkedin: linkedinService,
};

function getService(post) {
  const service = platformServices[post.platform];
  if (!service) {
    const error = new Error(`Unsupported publishing platform: ${post.platform}`);
    error.code = 'UNSUPPORTED_PLATFORM';
    throw error;
  }
  return service;
}

function schedule(post, idempotencyKey) {
  return getService(post).schedule(post, idempotencyKey);
}

function getStatus(post) {
  return getService(post).getStatus(post);
}

function updateScheduledPost(post) {
  return getService(post).updateScheduledPost(post);
}

function deleteScheduledPost(post) {
  return getService(post).deleteScheduledPost(post);
}

module.exports = { schedule, getStatus, updateScheduledPost, deleteScheduledPost };
