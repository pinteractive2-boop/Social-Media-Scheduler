const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const postRoutes = require('./routes/postRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');

const app = express();

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/posts', postRoutes);
app.use('/api/scheduler', schedulerRoutes);

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
