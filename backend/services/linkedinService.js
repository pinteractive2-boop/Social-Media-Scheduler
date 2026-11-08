/**
 * Mock LinkedIn publishing service.
 * MOCK ONLY - never calls the real LinkedIn API.
 */
function publish(post) {
  return {
    success: true,
    simulated: true,
    platform: 'linkedin',
    mockPostId: `li_mock_${Date.now()}`,
    message:
      'MOCK ONLY - This is a simulated LinkedIn publish. No real LinkedIn API was called.',
    caption: post.caption,
    publishedAt: new Date().toISOString(),
  };
}

module.exports = { publish };
