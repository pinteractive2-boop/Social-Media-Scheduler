const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media Scheduler API',
      description:
        'API for creating and scheduling posts. Instagram and LinkedIn publishing is simulated; no real social media APIs are called.',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development',
      },
      {
        url: 'https://social-media-scheduler-fzmm.onrender.com',
        description: 'Render Deployment',
      },
    ],
    tags: [
      { name: 'General', description: 'General API information' },
      { name: 'Posts', description: 'Create and manage scheduled posts' },
      { name: 'Scheduler', description: 'Run scheduled mock publishing' },
    ],
  },
  apis: [path.join(__dirname, '../docs/openapi.js')],
};

module.exports = swaggerJSDoc(options);
