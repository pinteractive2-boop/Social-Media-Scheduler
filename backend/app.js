const express = require('express');
const multer = require('multer');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/authRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const requireAuth = require('./middleware/requireAuth');
const postRoutes = require('./routes/postRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');

const app = express();

app.use(express.json());

const frontendOrigin = process.env.FRONTEND_ORIGIN;
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // With credentials, echo the specific origin instead of '*'
    if (!frontendOrigin || origin === frontendOrigin) {
      return callback(null, origin);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Cookie', 'authorization'],
  exposedHeaders: ['Set-Cookie'],
}));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/posts', requireAuth, postRoutes);
app.use('/api/scheduler', requireAuth, schedulerRoutes);

app.get('/', (req, res) => {
  res.send('Social Media Scheduler API');
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({ error: error.message });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
