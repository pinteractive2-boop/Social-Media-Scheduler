# Social Media Post Scheduler Backend

A small Node.js + Express + MongoDB backend for managing scheduled social posts.
Image files are stored in Cloudinary. Publishing services are structured for
Instagram and LinkedIn integration, but neither platform API is connected yet.

**No publishing simulations are returned.** Due posts are marked failed with
`PUBLISHING_NOT_CONFIGURED` until a real platform integration is added. A post is
never marked `published` unless its publishing service confirms success.

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
├── services/              # Image storage and platform publishing adapters
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
| publishedAt | Date | set only when a publishing service confirms success |
| publishingResponse | Mixed | publishing attempt, provider response, or failure details |

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
`scheduledAt` time has arrived, marks them as `processing`, then calls the platform
publishing service. Until platform APIs are connected, due posts are marked
`failed` with `PUBLISHING_NOT_CONFIGURED`; they are not reported as published.

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
   - Currently due posts should have `status: "failed"` and a
     `publishingResponse.code` of `PUBLISHING_NOT_CONFIGURED`.

## Notes

- Instagram and LinkedIn services currently return an explicit
  `PUBLISHING_NOT_CONFIGURED` failure. No mock post IDs or simulated success
  responses are created.
- Replace the platform service implementations with authenticated provider calls
  when the official API integrations are added. Keep credentials server-side.
- A post is atomically changed from `pending` to `processing` before publishing,
  so overlapping scheduler runs cannot claim the same post.
- The manual `/api/scheduler/run` endpoint uses the same `runScheduler()`
  logic as the cron job.
