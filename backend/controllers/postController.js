const mongoose = require('mongoose');
const Post = require('../models/Post');
const imageService = require('../services/imageService');
const publishingService = require('../services/publishingService');
const postStatusService = require('../services/postStatusService');
const zernioService = require('../services/zernioService');

const platforms = ['instagram', 'linkedin'];

function validatePostInput(body, isUpdate = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'A JSON or multipart request body is required';
  }
  if (!isUpdate && (!body.caption || !body.platform || !body.scheduledAt || !body.accountId)) {
    return 'caption, platform, accountId and scheduledAt are required';
  }
  if (body.caption !== undefined &&
      (typeof body.caption !== 'string' || !body.caption.trim())) {
    return 'caption must be a non-empty string';
  }
  if (body.platform !== undefined && !platforms.includes(body.platform)) {
    return "platform must be 'instagram' or 'linkedin'";
  }
  if (body.scheduledAt !== undefined) {
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return 'scheduledAt must be a valid date and time';
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return 'scheduledAt must be in the future';
    }
  }
  if (body.accountId !== undefined &&
      (typeof body.accountId !== 'string' || !body.accountId.trim())) {
    return 'accountId must be a non-empty string';
  }
  if (body.imageUrl !== undefined &&
      body.imageUrl !== null &&
      typeof body.imageUrl !== 'string') {
    return 'imageUrl must be a string';
  }
  if (typeof body.imageUrl === 'string' && body.imageUrl) {
    try {
      if (new URL(body.imageUrl).protocol !== 'https:') {
        return 'imageUrl must use HTTPS';
      }
    } catch {
      return 'imageUrl must be a valid HTTPS URL';
    }
  }
  return null;
}

function serializePost(post) {
  const result = post.toObject ? post.toObject() : { ...post };
  delete result.owner;
  delete result.idempotencyKey;
  result.accountId = result.providerAccountId;
  delete result.providerAccountId;
  delete result.statusCheckLeaseUntil;
  return result;
}

function handleControllerError(res, error, action) {
  console.error(`${action} failed (${error.code || error.name || 'unknown'})`);
  const statusCode = error.statusCode ||
    (error.name === 'ValidationError' ? 400 : 500);
  const message = statusCode === 500
    ? 'Internal server error'
    : error.statusCode && error.statusCode < 500
      ? error.message
      : 'Unable to complete the request';
  return res.status(statusCode).json({ error: message });
}

async function removeUploadedAsset(publicId) {
  if (!publicId) return;
  try {
    await imageService.deleteImage(publicId);
    return true;
  } catch (error) {
    console.error(`Cloudinary cleanup failed (${error.code || error.name || 'unknown'})`);
    return false;
  }
}

async function refreshAccounts(user) {
  const profileId = await zernioService.ensureProfile(user);
  const accounts = await zernioService.listAccounts(profileId);
  user.connectedAccounts = accounts;
  await user.save();
  return accounts;
}

function findAccount(accounts, accountId, platform) {
  return accounts.find(
    (account) =>
      account.accountId === accountId &&
      account.platform === platform &&
      account.isActive
  );
}

function validatePlatformMedia(platform, imageUrl, hasFile) {
  if (platform === 'instagram' && !imageUrl && !hasFile) {
    return 'Instagram posts require an image';
  }
  return null;
}

function setProviderStatus(post, providerPost) {
  const statuses = {
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
  post.status = statuses[providerPost.status] || 'pending';
  post.publishingResponse = {
    provider: 'zernio',
    status: providerPost.status,
    checkedAt: new Date(),
  };
  if (post.status === 'published') {
    const publishedAt = new Date(providerPost.publishedAt);
    post.publishedAt = Number.isNaN(publishedAt.getTime())
      ? new Date()
      : publishedAt;
  }
}

function persistProviderFailure(post, error) {
  post.status = 'failed';
  post.publishedAt = undefined;
  post.publishingResponse = {
    provider: 'zernio',
    success: false,
    code: error.code || 'ZERNIO_REQUEST_FAILED',
    failedAt: new Date(),
  };
}

exports.createPost = async (req, res) => {
  const validationError = validatePostInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  let uploadedImage;
  let post;
  try {
    const accounts = await refreshAccounts(req.user);
    if (!findAccount(accounts, req.body.accountId, req.body.platform)) {
      return res.status(403).json({ error: 'The selected account is not connected to this user' });
    }

    uploadedImage = req.file ? await imageService.uploadImage(req.file) : null;
    const imageUrl = uploadedImage ? uploadedImage.imageUrl : req.body.imageUrl;
    const mediaError = validatePlatformMedia(req.body.platform, imageUrl, Boolean(req.file));
    if (mediaError) {
      if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
      return res.status(400).json({ error: mediaError });
    }

    post = new Post({
      owner: req.user._id,
      caption: req.body.caption.trim(),
      imageUrl,
      imagePublicId: uploadedImage ? uploadedImage.publicId : undefined,
      platform: req.body.platform,
      scheduledAt: req.body.scheduledAt,
      providerAccountId: req.body.accountId,
      idempotencyKey: zernioService.createIdempotencyKey(),
      status: 'processing',
      publishingResponse: { provider: 'zernio', status: 'submitting' },
    });
    await post.save();
  } catch (error) {
    if (!post && uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
    return handleControllerError(res, error, 'Create post');
  }

  try {
    const providerPost = await publishingService.schedule(
      post,
      post.idempotencyKey
    );
    post.providerPostId = providerPost._id;
    setProviderStatus(post, providerPost);
    await post.save();
    return res.status(201).json(serializePost(post));
  } catch (error) {
    persistProviderFailure(post, error);
    await post.save();
    console.error(`Post ${post._id} scheduling failed (${error.code || 'ZERNIO_REQUEST_FAILED'})`);
    const statusCode = error.statusCode || 502;
    return res.status(statusCode).json({
      error: 'Zernio could not schedule the post',
      post: serializePost(post),
    });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({ owner: req.user._id }).sort({ scheduledAt: 1 });
    return res.json(posts.map(serializePost));
  } catch (error) {
    return handleControllerError(res, error, 'Get posts');
  }
};

async function getOwnedPost(id, userId) {
  return Post.findOne({ _id: id, owner: userId });
}

exports.getPost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  try {
    const post = await getOwnedPost(req.params.id, req.user._id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.providerPostId && post.scheduledAt <= new Date()) {
      await postStatusService.syncPostStatus(post);
    }
    return res.json(serializePost(post));
  } catch (error) {
    return handleControllerError(res, error, 'Get post');
  }
};

exports.getPostStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  try {
    const post = await getOwnedPost(req.params.id, req.user._id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.providerPostId) await postStatusService.syncPostStatus(post);
    return res.json({
      postId: post._id,
      status: post.status,
      scheduledAt: post.scheduledAt,
      publishedAt: post.publishedAt,
      publishingResponse: post.publishingResponse,
    });
  } catch (error) {
    return handleControllerError(res, error, 'Get post status');
  }
};

exports.updatePost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  const validationError = validatePostInput(req.body, true);
  if (validationError) return res.status(400).json({ error: validationError });

  let uploadedImage;
  try {
    const post = await getOwnedPost(req.params.id, req.user._id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'pending' || !post.providerPostId) {
      return res.status(400).json({ error: 'Only scheduled posts can be updated' });
    }

    const original = {
      caption: post.caption,
      platform: post.platform,
      scheduledAt: post.scheduledAt,
      imageUrl: post.imageUrl,
      imagePublicId: post.imagePublicId,
      providerAccountId: post.providerAccountId,
    };
    const previousImagePublicId = post.imagePublicId;
    const previousImageUrl = post.imageUrl;
    const imageWasReplaced = Boolean(req.file) ||
      (req.body.imageUrl !== undefined && req.body.imageUrl !== previousImageUrl);

    if (req.body.caption !== undefined) post.caption = req.body.caption.trim();
    if (req.body.platform !== undefined) post.platform = req.body.platform;
    if (req.body.scheduledAt !== undefined) post.scheduledAt = req.body.scheduledAt;

    if (req.file) {
      uploadedImage = await imageService.uploadImage(req.file);
      post.imageUrl = uploadedImage.imageUrl;
      post.imagePublicId = uploadedImage.publicId;
    } else if (imageWasReplaced && req.body.imageUrl !== undefined) {
      post.imageUrl = req.body.imageUrl || undefined;
      post.imagePublicId = undefined;
    }

    const mediaError = validatePlatformMedia(post.platform, post.imageUrl, Boolean(req.file));
    if (mediaError) {
      if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
      return res.status(400).json({ error: mediaError });
    }

    const accountId = req.body.accountId || post.providerAccountId;
    const accounts = await refreshAccounts(req.user);
    if (!findAccount(accounts, accountId, post.platform)) {
      if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
      return res.status(403).json({ error: 'The selected account is not connected to this user' });
    }
    post.providerAccountId = accountId;

    try {
      const providerPost = await publishingService.updateScheduledPost(post);
      setProviderStatus(post, providerPost);
      await post.save();
    } catch (error) {
      Object.assign(post, original);
      if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
      return handleControllerError(res, error, 'Update post');
    }

    if (previousImagePublicId && imageWasReplaced) {
      const cleanupSucceeded = await removeUploadedAsset(previousImagePublicId);
      if (!cleanupSucceeded) {
        res.set('X-Image-Cleanup-Warning', 'Previous Cloudinary image could not be removed');
      }
    }
    return res.json(serializePost(post));
  } catch (error) {
    if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
    return handleControllerError(res, error, 'Update post');
  }
};

exports.deletePost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  try {
    const post = await getOwnedPost(req.params.id, req.user._id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!['pending', 'failed'].includes(post.status)) {
      return res.status(400).json({ error: 'Only scheduled or failed posts can be deleted' });
    }

    if (post.providerPostId) {
      await publishingService.deleteScheduledPost(post);
    }
    const imagePublicId = post.imagePublicId;
    await post.deleteOne();

    let warning;
    if (imagePublicId) {
      const cleanupSucceeded = await removeUploadedAsset(imagePublicId);
      if (!cleanupSucceeded) warning = 'Post deleted, but its Cloudinary image could not be removed';
    }

    return res.json({ message: 'Post deleted', ...(warning ? { warning } : {}) });
  } catch (error) {
    return handleControllerError(res, error, 'Delete post');
  }
};
