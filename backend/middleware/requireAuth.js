const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

function getToken(req) {
  const authorization = req.get('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('scheduler_session='));

  return cookie ? cookie.slice('scheduler_session='.length) : null;
}

module.exports = async function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    return res.status(503).json({ error: 'Authentication is not configured' });
  }

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let payload;
  try {
    payload = jwt.verify(token, secret, {
      issuer: 'social-media-scheduler',
      audience: 'social-media-scheduler-client',
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
