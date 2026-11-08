/**
 * @openapi
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       required:
 *         - caption
 *         - platform
 *         - scheduledAt
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB document ID.
 *           example: 665f1a2b3c4d5e6f7890abcd
 *         caption:
 *           type: string
 *           example: A scheduled post
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           description: Optional URL for an image. Uploaded files use their Cloudinary secure URL.
 *           example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *         imagePublicId:
 *           type: string
 *           description: Cloudinary public ID; present for images uploaded through this API.
 *           example: social-media-scheduler/sample
 *         platform:
 *           type: string
 *           enum:
 *             - instagram
 *             - linkedin
 *           example: instagram
 *         scheduledAt:
 *           type: string
 *           format: date-time
 *           example: 2099-01-01T12:00:00.000Z
 *         status:
 *           type: string
 *           enum:
 *             - pending
 *             - processing
 *             - published
 *             - failed
 *           description: Set to pending on creation and updated by the scheduler.
 *           example: pending
 *         publishedAt:
 *           type: string
 *           format: date-time
 *           description: Set only after the platform service confirms publishing success.
 *         publishingResponse:
 *           type: object
 *           nullable: true
 *           description: Publishing attempt details, provider response, or failure information.
 *           additionalProperties: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     Error:
 *       type: object
 *       required:
 *         - error
 *       properties:
 *         error:
 *           type: string
 *           example: Invalid post ID
 *
 * /:
 *   get:
 *     tags:
 *       - General
 *     summary: Get the API welcome message
 *     description: Returns a simple text response from the Express server.
 *     responses:
 *       '200':
 *         description: API is responding.
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *             example: Social Media Scheduler API
 *
 * /api/posts:
 *   post:
 *     tags:
 *       - Posts
 *     summary: Create a scheduled post
 *     description: >
 *       Creates a scheduled post via Zernio. An image is required for Instagram
 *       and optional for LinkedIn. Use multipart/form-data with the file field
 *       named image to upload (JPG, JPEG, PNG, WEBP, up to 5 MB). Uploaded images
 *       are stored in Cloudinary. The post is scheduled with Zernio at the selected
 *       date and time; the scheduler syncs publishing status every minute.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caption
 *               - platform
 *               - scheduledAt
 *             properties:
 *               caption:
 *                 type: string
 *                 example: Hello Instagram!
 *               imageUrl:
 *                 type: string
 *                 nullable: true
 *                 description: Optional image URL; this does not upload a file.
 *                 example: https://example.com/image.jpg
 *               platform:
 *                 type: string
 *                 enum:
 *                   - instagram
 *                   - linkedin
 *                 example: instagram
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2099-01-01T12:00:00.000Z
 *           example:
 *             caption: Hello Instagram!
 *             platform: instagram
 *             scheduledAt: 2099-01-01T12:00:00.000Z
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - caption
 *               - platform
 *               - scheduledAt
 *             properties:
 *               caption:
 *                 type: string
 *                 example: Hello Instagram!
 *               imageUrl:
 *                 type: string
 *                 description: Optional URL alternative to uploading an image file.
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional JPG, JPEG, PNG, or WEBP file; maximum 5 MB.
 *               platform:
 *                 type: string
 *                 enum:
 *                   - instagram
 *                   - linkedin
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *           encoding:
 *             image:
 *               contentType: image/jpeg, image/png, image/webp
 *     responses:
 *       '201':
 *         description: Post created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *             example:
 *               _id: 665f1a2b3c4d5e6f7890abcd
 *               caption: Hello Instagram!
 *               platform: instagram
 *               scheduledAt: 2099-01-01T12:00:00.000Z
 *               status: pending
 *       '400':
 *         description: Missing or invalid fields, or unsupported image format/content.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingFields:
 *                 value:
 *                   error: caption, platform and scheduledAt are required
 *               invalidPlatform:
 *                 value:
 *                   error: platform must be 'instagram' or 'linkedin'
 *               invalidImage:
 *                 value:
 *                   error: Only JPG, JPEG, PNG and WEBP images are allowed
 *       '413':
 *         description: Uploaded image exceeds the 5 MB limit.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '503':
 *         description: Cloudinary credentials are not configured for image upload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Database or other server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get all posts
 *     description: Returns all posts sorted by scheduledAt in ascending order.
 *     responses:
 *       '200':
 *         description: List of posts (an empty list is returned when there are no posts).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 *             example: []
 *       '500':
 *         description: Database or server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/posts/{id}:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       description: MongoDB post document ID.
 *       schema:
 *         type: string
 *       example: 665f1a2b3c4d5e6f7890abcd
 *   get:
 *     tags:
 *       - Posts
 *     summary: Get a post by ID
 *     responses:
 *       '200':
 *         description: Post found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       '400':
 *         description: Invalid MongoDB ID.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Invalid post ID
 *       '404':
 *         description: No post has this ID.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Post not found
 *       '500':
 *         description: Database or server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     tags:
 *       - Posts
 *     summary: Update a pending post
 *     description: >
 *       Only pending posts can be updated. All fields are optional. Send JSON to update
 *       text fields, or multipart/form-data to replace the image using the image field.
 *       An empty imageUrl clears the current image URL.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *                 example: Updated caption
 *               imageUrl:
 *                 type: string
 *                 nullable: true
 *                 description: Set to an empty string to remove the current image.
 *               platform:
 *                 type: string
 *                 enum:
 *                   - instagram
 *                   - linkedin
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *           example:
 *             caption: Updated caption
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 description: Optional URL alternative; an empty value clears the image.
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional JPG, JPEG, PNG, or WEBP file; maximum 5 MB.
 *               platform:
 *                 type: string
 *                 enum:
 *                   - instagram
 *                   - linkedin
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *           encoding:
 *             image:
 *               contentType: image/jpeg, image/png, image/webp
 *     responses:
 *       '200':
 *         description: Post updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       '400':
 *         description: Invalid ID/input or post is not pending.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidId:
 *                 value:
 *                   error: Invalid post ID
 *               notPending:
 *                 value:
 *                   error: Only pending posts can be updated
 *               invalidPlatform:
 *                 value:
 *                   error: platform must be 'instagram' or 'linkedin'
 *       '404':
 *         description: Post not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Post not found
 *       '413':
 *         description: Uploaded image exceeds the 5 MB limit.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '503':
 *         description: Cloudinary credentials are not configured for image upload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Database or server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     tags:
 *       - Posts
 *     summary: Delete a pending post
 *     description: Deletes the post and attempts to remove its uploaded Cloudinary image.
 *     responses:
 *       '200':
 *         description: Post deleted. A warning may be included if Cloudinary cleanup fails.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - message
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post deleted
 *                 warning:
 *                   type: string
 *                   example: Post deleted, but its Cloudinary image could not be removed
 *       '400':
 *         description: Invalid ID or post is not pending.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidId:
 *                 value:
 *                   error: Invalid post ID
 *               notPending:
 *                 value:
 *                   error: Only pending posts can be deleted
 *       '404':
 *         description: Post not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Post not found
 *       '500':
 *         description: Database or server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /api/scheduler/run:
 *   post:
 *     tags:
 *       - Scheduler
 *     summary: Run the scheduler manually
 *     description: >
 *       Processes pending posts whose scheduledAt time has arrived. Posts are marked
 *       processing before the platform service is called. A post is marked published
 *       only after Zernio confirms success. The automatic scheduler also runs every
 *       minute, syncing publishing status from Zernio for all due posts.
 *     responses:
 *       '200':
 *         description: Scheduler completed and returns posts attempted by this run.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - message
 *                 - processed
 *                 - posts
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Scheduler ran successfully
 *                 processed:
 *                   type: integer
 *                   example: 1
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *             example:
 *               message: Scheduler ran successfully
 *               processed: 1
 *               posts:
 *                 - _id: 665f1a2b3c4d5e6f7890abcd
 *                   caption: Hello Instagram!
 *                   platform: instagram
 *                   scheduledAt: 2026-11-08T15:00:00.000Z
 *                   status: published
 *                   publishedAt: 2026-11-08T15:00:05.000Z
 *                   publishingResponse:
 *                     provider: zernio
 *                     status: published
 *                     checkedAt: 2026-11-08T15:00:05.000Z
 *       '500':
 *         description: Scheduler could not run.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Unable to run scheduler
 */
