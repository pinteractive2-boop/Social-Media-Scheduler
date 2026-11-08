const express = require('express');
const integrationController = require('../controllers/integrationController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);
router.get('/accounts', integrationController.listAccounts);
router.get('/accounts/cached', integrationController.listStoredAccounts);
router.get('/:platform/connect', integrationController.createConnectUrl);

module.exports = router;
