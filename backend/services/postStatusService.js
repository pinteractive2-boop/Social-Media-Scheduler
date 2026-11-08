const publishingService = require('./publishingService');

const providerStatusMap = {
  draft: 'pending',
  scheduled: 'pending',
  pending: 'pending',
  pending_approval: 'pending',
  uploading: 'processing',
  publishing: 'processing',
  processing: 'processing',
  published: 'published',
  failed: 'failed',
  partial: 'failed',
  cancelled: 'failed',
};

async function syncPostStatus(post) {
  if (!post.providerPostId) return post;

  const providerPost = await publishingService.getStatus(post);
  const localStatus = providerStatusMap[providerPost.status];
  if (!localStatus) return post;

  post.status = localStatus;
  post.publishingResponse = {
    provider: 'zernio',
    status: providerPost.status,
    checkedAt: new Date(),
  };
  if (localStatus === 'published' && !post.publishedAt) {
    const providerPublishedAt = new Date(providerPost.publishedAt);
    post.publishedAt = Number.isNaN(providerPublishedAt.getTime())
      ? new Date()
      : providerPublishedAt;
  }
  if (localStatus !== 'published') post.publishedAt = undefined;

  await post.save();
  return post;
}

module.exports = { syncPostStatus };
