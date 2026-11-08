const instagramService = require('./instagramService');
const linkedinService = require('./linkedinService');

const platformServices = {
  instagram: instagramService,
  linkedin: linkedinService,
};

async function publish(post) {
  const service = platformServices[post.platform];
  if (!service) {
    const error = new Error(`Unsupported publishing platform: ${post.platform}`);
    error.code = 'UNSUPPORTED_PLATFORM';
    throw error;
  }

  return service.publish(post);
}

module.exports = { publish };
