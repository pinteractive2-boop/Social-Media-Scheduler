const { runScheduler } = require('../jobs/postScheduler');

// POST /api/scheduler/run - Manually trigger the scheduler
exports.runScheduler = async (req, res) => {
  try {
    const posts = await runScheduler();
    return res.json({
      message: 'Scheduler ran successfully',
      processed: posts.length,
      posts,
    });
  } catch (error) {
    console.error('Manual scheduler run failed:', error);
    return res.status(500).json({ error: 'Unable to run scheduler' });
  }
};
