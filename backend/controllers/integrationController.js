const User = require('../models/User');
const zernioService = require('../services/zernioService');

const supportedPlatforms = new Set(['instagram', 'linkedin']);

function handleIntegrationError(res, error, fallbackMessage) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.statusCode === 503
        ? 'Zernio is not configured or is temporarily unavailable'
        : fallbackMessage,
      ...(error.code ? { code: error.code } : {}),
    });
  }

  console.error(fallbackMessage);
  return res.status(500).json({ error: 'Unable to complete the integration request' });
}

exports.createConnectUrl = async (req, res) => {
  const { platform } = req.params;
  if (!supportedPlatforms.has(platform)) {
    return res.status(400).json({ error: 'Platform must be instagram or linkedin' });
  }

  try {
    const profileId = await zernioService.ensureProfile(req.user);
    const result = await zernioService.createConnectUrl(profileId, platform);
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error, 'Unable to start account connection');
  }
};

exports.listAccounts = async (req, res) => {
  try {
    const profileId = await zernioService.ensureProfile(req.user);
    const accounts = await zernioService.listAccounts(profileId);
    req.user.connectedAccounts = accounts;
    await req.user.save();
    return res.json({ accounts });
  } catch (error) {
    return handleIntegrationError(res, error, 'Unable to retrieve connected accounts');
  }
};

exports.listStoredAccounts = (req, res) => {
  return res.json({ accounts: req.user.connectedAccounts });
};
