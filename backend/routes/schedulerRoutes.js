const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');

router.post('/run', schedulerController.runScheduler);

module.exports = router;
