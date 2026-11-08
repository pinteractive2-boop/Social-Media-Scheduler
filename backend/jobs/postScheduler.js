const cron = require('node-cron');
const Post = require('../models/Post');
const User = require('../models/User');
const postStatusService = require('../services/postStatusService');

let cronTask = null;

async function runScheduler(ownerId) {
  const now = new Date();
  const ownerFilter = ownerId ? { owner: ownerId } : {};
  const duePosts = await Post.find({
    ...ownerFilter,
    status: { $in: ['pending', 'processing'] },
    providerPostId: { $exists: true, $ne: null },
    scheduledAt: { $lte: now },
  }).select('_id');
  const processedPosts = [];

  for (const duePost of duePosts) {
    try {
      const post = await Post.findOneAndUpdate(
        {
          _id: duePost._id,
          ...ownerFilter,
          status: { $in: ['pending', 'processing'] },
          scheduledAt: { $lte: now },
          $or: [
            { statusCheckLeaseUntil: { $exists: false } },
            { statusCheckLeaseUntil: null },
            { statusCheckLeaseUntil: { $lte: now } },
          ],
        },
        { $set: { statusCheckLeaseUntil: new Date(now.getTime() + 60000) } },
        { new: true }
      );
      if (!post) continue;

      const user = await User.findById(post.owner);
      const ownsAccount = user &&
        user.connectedAccounts.some(
          (account) =>
            account.accountId === post.providerAccountId &&
            account.platform === post.platform
        );
      if (!ownsAccount) {
        post.status = 'failed';
        post.publishingResponse = {
          provider: 'zernio',
          success: false,
          code: 'CONNECTED_ACCOUNT_UNAVAILABLE',
          checkedAt: new Date(),
        };
      } else {
        await postStatusService.syncPostStatus(post);
      }

      post.statusCheckLeaseUntil = undefined;
      await post.save();
      processedPosts.push(post);
    } catch (error) {
      await Post.updateOne(
        { _id: duePost._id },
        { $unset: { statusCheckLeaseUntil: 1 } }
      );
      console.error(
        `Failed to synchronize scheduled post ${duePost._id} (${error.code || error.name || 'unknown'})`
      );
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
      console.error(`Scheduler error (${error.code || error.name || 'unknown'})`);
    }
  });
  console.log('Scheduler started: checking due Zernio posts every minute');
}

function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = { runScheduler, startScheduler, stopScheduler };
