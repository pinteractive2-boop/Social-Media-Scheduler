const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Social Media Scheduler API',
      description:
        'API for creating and scheduling posts. Instagram and LinkedIn API integrations are not configured, so due posts are marked failed until the real publishing services are connected.',
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
      { name: 'Scheduler', description: 'Run scheduled publishing attempts' },
    ],
  },
  apis: [path.join(__dirname, '../docs/openapi.js')],
};

module.exports = swaggerJSDoc(options);
