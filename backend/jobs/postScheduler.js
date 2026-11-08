const cron = require('node-cron');
const Post = require('../models/Post');
const publishingService = require('../services/publishingService');

let cronTask = null;

async function publishPost(post, attemptedAt) {
  let response;
  try {
    response = await publishingService.publish(post);
    if (!response || response.success !== true) {
      const error = new Error('Publishing service did not confirm success');
      error.code = 'INVALID_PUBLISHING_RESPONSE';
      throw error;
    }
  } catch (error) {
    post.status = 'failed';
    post.publishedAt = undefined;
    post.publishingResponse = {
      success: false,
      platform: post.platform,
      code: error.code || 'PUBLISHING_FAILED',
      message: error.code === 'PUBLISHING_NOT_CONFIGURED'
        ? error.message
        : 'Publishing failed. Check the backend configuration and logs.',
      attemptedAt,
      failedAt: new Date(),
    };
    await post.save();
    console.error(
      `Post ${post._id} failed to publish to ${post.platform} (${post.publishingResponse.code})`
    );
    return post;
  }

  const completedAt = new Date();
  post.status = 'published';
  post.publishedAt = completedAt;
  post.publishingResponse = {
    success: true,
    platform: post.platform,
    attemptedAt,
    completedAt,
    providerResponse: response,
  };
  await post.save();
  console.log(`Post ${post._id} was published to ${post.platform}`);

  return post;
}

async function runScheduler() {
  const now = new Date();
  const duePosts = await Post.find({
    status: 'pending',
    scheduledAt: { $lte: now },
  }).select('_id');
  const processedPosts = [];

  for (const duePost of duePosts) {
    try {
      const post = await Post.findOneAndUpdate(
        {
          _id: duePost._id,
          status: 'pending',
          scheduledAt: { $lte: now },
        },
        {
          $set: {
            status: 'processing',
            publishingResponse: {
              success: null,
              attemptedAt: now,
            },
          },
          $unset: { publishedAt: 1 },
        },
        { new: true }
      );

      if (post) {
        processedPosts.push(await publishPost(post, now));
      }
    } catch (error) {
      console.error(`Failed to process scheduled post ${duePost._id}:`, error);
    }
  }

  return processedPosts;
}

function startScheduler() {
  if (cronTask) return;
  cronTask = cron.schedule('* * * * *', async () => {
    try {
      await runScheduler();
    } catch (error) {
      console.error('Scheduler error:', error.message);
    }
  });
  console.log('Scheduler started: checking pending posts every minute');
}

function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = { runScheduler, startScheduler, stopScheduler };
