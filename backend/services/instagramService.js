/**
 * Mock Instagram publishing service.
 * MOCK ONLY - never calls the real Instagram API.
 */
function publish(post) {
  return {
    success: true,
    simulated: true,
    platform: 'instagram',
    mockPostId: `ig_mock_${Date.now()}`,
    message:
      'MOCK ONLY - This is a simulated Instagram publish. No real Instagram API was called.',
    caption: post.caption,
    publishedAt: new Date().toISOString(),
  };
}

module.exports = { publish };
