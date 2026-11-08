const cron = require('node-cron');
const Post = require('../models/Post');
const publishingService = require('../services/publishingService');

let cronTask = null;

async function publishPost(post) {
  try {
    const response = await publishingService.publish(post);
    if (!response || response.success !== true) {
      throw new Error('Mock publishing service did not confirm success');
    }

    post.status = 'published';
    post.publishedAt = new Date();
    post.publishingResponse = response;
    await post.save();
    console.log(`[MOCK] Post ${post._id} published to ${post.platform}`);
  } catch (error) {
    post.status = 'failed';
    post.publishingResponse = {
      success: false,
      simulated: true,
      error: error.message,
    };
    await post.save();
    console.error(`[MOCK] Post ${post._id} failed: ${error.message}`);
  }

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
        { $set: { status: 'processing' } },
        { new: true }
      );

      if (post) processedPosts.push(await publishPost(post));
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
