const instagramService = require('./instagramService');
const linkedinService = require('./linkedinService');

/**
 * Routes a post to the correct mock publishing service.
 * MOCK ONLY - no real external API requests.
 */
function publish(post) {
  if (post.caption.trim().toLowerCase().startsWith('[mock-fail]')) {
    throw new Error('Simulated publishing failure requested by [mock-fail]');
  }

  if (post.platform === 'instagram') {
    return instagramService.publish(post);
  }
  if (post.platform === 'linkedin') {
    return linkedinService.publish(post);
  }
  throw new Error(`Unsupported platform: ${post.platform}`);
}

module.exports = { publish };
