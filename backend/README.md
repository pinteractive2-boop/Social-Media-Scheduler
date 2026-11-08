# Social Media Post Scheduler Backend

A small Node.js + Express + MongoDB backend for managing scheduled social posts.
Image files are stored in Cloudinary, and publishing to Instagram or LinkedIn is
simulated for this assignment.

**Mock publishing only.** The backend does not call real Instagram or LinkedIn
APIs. Cloudinary is used only for image storage.

## Project Structure

```
backend/
├── config/
│   ├── cloudinary.js      # Optional Cloudinary configuration
│   └── db.js              # MongoDB connection
├── controllers/           # Request handlers
│   ├── postController.js
│   └── schedulerController.js
├── models/Post.js         # Post schema
├── middleware/uploadImage.js # Multer image upload validation
├── routes/                # API routes
│   ├── postRoutes.js
│   └── schedulerRoutes.js
├── services/              # Mock publishing services
│   ├── imageService.js
│   ├── instagramService.js
│   ├── linkedinService.js
│   └── publishingService.js
├── jobs/postScheduler.js  # node-cron job + shared scheduling logic
├── app.js                 # Express app
├── server.js              # Entry point
├── .env                   # Local environment variables (never overwrite)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- Node.js (v18+)
- MongoDB running locally (or a MongoDB connection string)

## Setup

```bash
cd backend

# Install dependencies
npm install

# If you do not already have a .env file, copy the example
copy .env.example .env     # Windows
# cp .env.example .env     # Mac/Linux

# Set MongoDB and Cloudinary values in .env
```

Required variables: `PORT`, `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Cloudinary variables may be
left blank to start and use the JSON `imageUrl` field; file uploads return
`503` until valid Cloudinary credentials are configured. Get the Cloudinary
values from your Cloudinary dashboard. Do not commit `.env` or share its secret.

## Start the server

```bash
npm start
# or
npm run dev
```

The server starts on `http://localhost:5000` (or the `PORT` from `.env`).
Interactive API documentation is available at `http://localhost:5000/api-docs`.
The cron scheduler starts **only after** a successful MongoDB connection and checks
for due posts every minute.

## Post Model

| Field | Type | Notes |
|-------|------|-------|
| caption | String | required |
| imageUrl | String | optional |
| imagePublicId | String | Cloudinary asset ID used for image cleanup |
| platform | String | `instagram` or `linkedin`, required |
| scheduledAt | Date | required, ISO 8601 |
| status | String | `pending` / `processing` / `published` / `failed` |
| publishedAt | Date | set when published |
| publishingResponse | Mixed | mock response from the publishing service |

## API Endpoints

### Create a post
```
POST /api/posts
Content-Type: application/json

{
  "caption": "Hello Instagram!",
  "imageUrl": "https://example.com/image.jpg",
  "platform": "instagram",
  "scheduledAt": "2026-11-08T15:00:00Z"
}
```

For an actual image upload, use Postman **Body → form-data** with fields
`caption`, `platform`, `scheduledAt` and a file field named `image`. Supported
formats are JPG/JPEG, PNG, and WEBP, up to 5 MB. Uploaded files are sent to
Cloudinary; MongoDB stores their secure URL and Cloudinary public ID, not binary
image data.

### Get all posts
```
GET /api/posts
```

### Get one post
```
GET /api/posts/:id
```

### Update a pending post
```
PUT /api/posts/:id
Content-Type: application/json

{
  "caption": "Updated caption"
}
```

### Delete a pending post
```
DELETE /api/posts/:id
```

### Run the scheduler manually (for testing)
```
POST /api/scheduler/run
```

This runs the same scheduling logic as the cron job: finds pending posts whose
`scheduledAt` time has arrived, publishes them via the mock service, and updates
their status to `published` (or `failed`).

## Postman Testing Examples

1. **Create Instagram sample post**
   - `POST http://localhost:5000/api/posts`
   - Body (raw JSON):
     ```json
     {
       "caption": "Sample Instagram post",
       "platform": "instagram",
       "scheduledAt": "2026-11-08T14:30:00Z"
     }
     ```

2. **Create LinkedIn sample post**
   - `POST http://localhost:5000/api/posts`
   - Body (raw JSON):
     ```json
     {
       "caption": "Sample LinkedIn post",
       "imageUrl": "https://example.com/image.jpg",
       "platform": "linkedin",
       "scheduledAt": "2026-11-08T14:35:00Z"
     }
     ```

3. **Fetch posts**
   - `GET http://localhost:5000/api/posts`

4. **Trigger the scheduler manually**
   - `POST http://localhost:5000/api/scheduler/run`

5. **Check the updated publishing status**
   - `GET http://localhost:5000/api/posts`
   - Look for `status: "published"`, `publishedAt`, and `publishingResponse`
     (marked `MOCK ONLY`).

## Notes

- All publishing is mocked. Responses include `mockPostId`, `simulated: true`,
  and a `MOCK ONLY` message. No real Instagram or LinkedIn API is ever called.
- To test the failed state, start the caption with `[mock-fail]`; this is a
  deterministic test hook for the mock publisher.
- A post is atomically changed from `pending` to `processing` before publishing,
  so overlapping scheduler runs cannot claim the same post.
- The manual `/api/scheduler/run` endpoint uses the same `runScheduler()`
  logic as the cron job.
