const crypto = require('crypto');
const zernioApi = require('./zernioApiService');

const supportedPlatforms = new Set(['instagram', 'linkedin']);

async function findProfileByExternalId(externalId) {
  const result = await zernioApi.request('GET', '/profiles', {
    query: { externalId },
  });
  return (result.profiles || []).find(
    (profile) => profile.externalId === externalId
  );
}

async function ensureProfile(user) {
  if (user.zernioProfileId) return user.zernioProfileId;

  const externalId = user._id.toString();
  let profile = await findProfileByExternalId(externalId);
  if (!profile) {
    const created = await zernioApi.request('POST', '/profiles', {
      body: {
        // Profile names must be unique across Zernio, so scope the name to this user.
        name: user.displayName ? `${user.displayName} (${externalId})` : `Social Scheduler user ${externalId}`,
        externalId,
      },
    });
    profile = created.profile;
  }

  if (!profile || typeof profile._id !== 'string') {
    throw new zernioApi.ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
  }

  user.zernioProfileId = profile._id;
  await user.save();
  return profile._id;
}

async function createConnectUrl(profileId, platform) {
  if (!supportedPlatforms.has(platform)) {
    const error = new Error('Unsupported social platform');
    error.statusCode = 400;
    throw error;
  }

  const result = await zernioApi.request('GET', `/connect/${platform}`, {
    query: { profileId },
  });
  if (typeof result.authUrl !== 'string') {
    throw new zernioApi.ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
  }

  return { authUrl: result.authUrl };
}

async function listAccounts(profileId) {
  const result = await zernioApi.request('GET', '/accounts', {
    query: { profileId, platforms: 'instagram,linkedin' },
  });

  if (!Array.isArray(result.accounts)) {
    throw new zernioApi.ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
  }

  return result.accounts
    .filter((account) =>
      account &&
      account.profileId &&
      account.profileId._id === profileId &&
      supportedPlatforms.has(account.platform) &&
      typeof account._id === 'string'
    )
    .map((account) => ({
      accountId: account._id,
      platform: account.platform,
      username: typeof account.username === 'string' ? account.username : '',
      isActive: account.isActive !== false,
    }));
}

async function createScheduledPost(post, idempotencyKey) {
  const mediaItems = post.imageUrl
    ? [{ type: 'image', url: post.imageUrl }]
    : undefined;
  const body = {
    content: post.caption,
    platforms: [{ platform: post.platform, accountId: post.providerAccountId }],
    scheduledFor: post.scheduledAt.toISOString(),
    ...(mediaItems ? { mediaItems } : {}),
  };

  const result = await zernioApi.request('POST', '/posts', {
    body,
    idempotencyKey,
  });
  if (!result.post || typeof result.post._id !== 'string') {
    throw new zernioApi.ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
  }
  return result.post;
}

async function getPost(providerPostId) {
  const result = await zernioApi.request(
    'GET',
    `/posts/${encodeURIComponent(providerPostId)}`
  );
  if (!result.post || typeof result.post.status !== 'string') {
    throw new zernioApi.ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
  }
  return result.post;
}

async function updateScheduledPost(post) {
  const body = {
    content: post.caption,
    platforms: [{ platform: post.platform, accountId: post.providerAccountId }],
    scheduledFor: post.scheduledAt.toISOString(),
    isDraft: false,
    ...(post.imageUrl
      ? { mediaItems: [{ type: 'image', url: post.imageUrl }] }
      : { mediaItems: [] }),
  };
  const result = await zernioApi.request(
    'PUT',
    `/posts/${encodeURIComponent(post.providerPostId)}`,
    { body }
  );
  if (!result.post || typeof result.post._id !== 'string') {
    throw new zernioApi.ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
  }
  return result.post;
}

async function deleteScheduledPost(providerPostId) {
  return zernioApi.request(
    'DELETE',
    `/posts/${encodeURIComponent(providerPostId)}`
  );
}

function createIdempotencyKey() {
  return crypto.randomUUID();
}

module.exports = {
  ensureProfile,
  createConnectUrl,
  listAccounts,
  createScheduledPost,
  getPost,
  updateScheduledPost,
  deleteScheduledPost,
  createIdempotencyKey,
};
