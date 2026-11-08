const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const zernioService = require('../services/zernioService');

const sessionLifetimeSeconds = 12 * 60 * 60;

function getUserResponse(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
  };
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('Authentication is not configured');
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

function setSessionCookie(res, user) {
  const token = jwt.sign({}, getJwtSecret(), {
    subject: user._id.toString(),
    expiresIn: sessionLifetimeSeconds,
    issuer: 'social-media-scheduler',
    audience: 'social-media-scheduler-client',
  });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `scheduler_session=${token}; Max-Age=${sessionLifetimeSeconds}; Path=/api; HttpOnly; SameSite=Lax${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `scheduler_session=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax${secure}`
  );
}

function safeFailure(res, error, fallbackMessage) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.statusCode === 503
        ? 'Authentication or Zernio is not configured'
        : fallbackMessage,
    });
  }
  console.error(fallbackMessage);
  return res.status(500).json({ error: 'Unable to complete the request' });
}

exports.register = async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const password = req.body?.password;
  const displayName = typeof req.body?.displayName === 'string'
    ? req.body.displayName.trim()
    : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and no more than 72 bytes',
    });
  }
  if (displayName.length > 80) {
    return res.status(400).json({ error: 'Display name must be 80 characters or fewer' });
  }

  try {
    if (await User.exists({ email })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = new User({
      email,
      displayName,
      passwordHash: await bcrypt.hash(password, 12),
    });
    await user.save();
    await zernioService.ensureProfile(user);
    setSessionCookie(res, user);
    return res.status(201).json({ user: getUserResponse(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    return safeFailure(res, error, 'Registration failed');
  }
};

exports.login = async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const password = req.body?.password;
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    await zernioService.ensureProfile(user);
    setSessionCookie(res, user);
    return res.json({ user: getUserResponse(user) });
  } catch (error) {
    return safeFailure(res, error, 'Login failed');
  }
};

exports.logout = (req, res) => {
  clearSessionCookie(res);
  return res.json({ message: 'Signed out' });
};

exports.getCurrentUser = (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({ user: getUserResponse(req.user) });
};
