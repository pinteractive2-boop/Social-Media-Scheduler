async function publish(post) {
  const error = new Error(
    'LinkedIn publishing is unavailable until an API integration is configured'
  );
  error.code = 'PUBLISHING_NOT_CONFIGURED';
  error.platform = post.platform;
  throw error;
}

module.exports = { publish };
