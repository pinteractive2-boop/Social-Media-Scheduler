const mongoose = require('mongoose');
const Post = require('../models/Post');
const imageService = require('../services/imageService');

const platforms = ['instagram', 'linkedin'];

function validatePostInput(body, isUpdate = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'A JSON or multipart request body is required';
  }

  if (!isUpdate && (!body.caption || !body.platform || !body.scheduledAt)) {
    return 'caption, platform and scheduledAt are required';
  }

  if (body.caption !== undefined &&
      (typeof body.caption !== 'string' || !body.caption.trim())) {
    return 'caption must be a non-empty string';
  }

  if (body.platform !== undefined && !platforms.includes(body.platform)) {
    return "platform must be 'instagram' or 'linkedin'";
  }

  if (body.scheduledAt !== undefined &&
      Number.isNaN(new Date(body.scheduledAt).getTime())) {
    return 'scheduledAt must be a valid date and time';
  }

  if (body.imageUrl !== undefined &&
      body.imageUrl !== null &&
      typeof body.imageUrl !== 'string') {
    return 'imageUrl must be a string';
  }

  return null;
}

function handleControllerError(res, error, action) {
  console.error(`${action} failed:`, error);
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  const message = statusCode === 500 ? 'Internal server error' : error.message;
  return res.status(statusCode).json({ error: message });
}

async function removeUploadedAsset(publicId) {
  if (!publicId) return;

  try {
    await imageService.deleteImage(publicId);
    return true;
  } catch (error) {
    console.error(`Cloudinary cleanup failed for ${publicId}:`, error);
    return false;
  }
}

exports.createPost = async (req, res) => {
  const validationError = validatePostInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  let uploadedImage;
  try {
    uploadedImage = req.file ? await imageService.uploadImage(req.file) : null;
    const post = new Post({
      caption: req.body.caption.trim(),
      imageUrl: uploadedImage ? uploadedImage.imageUrl : req.body.imageUrl,
      imagePublicId: uploadedImage ? uploadedImage.publicId : undefined,
      platform: req.body.platform,
      scheduledAt: req.body.scheduledAt,
    });

    await post.save();
    return res.status(201).json(post);
  } catch (error) {
    if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
    return handleControllerError(res, error, 'Create post');
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().sort({ scheduledAt: 1 });
    return res.json(posts);
  } catch (error) {
    return handleControllerError(res, error, 'Get posts');
  }
};

exports.getPost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(post);
  } catch (error) {
    return handleControllerError(res, error, 'Get post');
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
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending posts can be updated' });
    }

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

    try {
      await post.save();
    } catch (error) {
      if (uploadedImage) await removeUploadedAsset(uploadedImage.publicId);
      throw error;
    }

    if (previousImagePublicId && imageWasReplaced) {
      const cleanupSucceeded = await removeUploadedAsset(previousImagePublicId);
      if (!cleanupSucceeded) {
        res.set('X-Image-Cleanup-Warning', 'Previous Cloudinary image could not be removed');
      }
    }

    return res.json(post);
  } catch (error) {
    return handleControllerError(res, error, 'Update post');
  }
};

exports.deletePost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending posts can be deleted' });
    }

    const imagePublicId = post.imagePublicId;
    await post.deleteOne();

    let warning;
    if (imagePublicId) {
      try {
        await imageService.deleteImage(imagePublicId);
      } catch (error) {
        console.error(`Cloudinary cleanup failed for ${imagePublicId}:`, error);
        warning = 'Post deleted, but its Cloudinary image could not be removed';
      }
    }

    return res.json({
      message: 'Post deleted',
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    return handleControllerError(res, error, 'Delete post');
  }
};
