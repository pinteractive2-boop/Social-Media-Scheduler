const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    caption: { type: String, required: [true, 'Caption is required'] },
    imageUrl: { type: String },
    imagePublicId: { type: String },
    platform: {
      type: String,
      enum: ['instagram', 'linkedin'],
      required: [true, 'Platform is required'],
    },
    scheduledAt: { type: Date, required: [true, 'Scheduled time is required'] },
    providerAccountId: { type: String, required: true },
    providerPostId: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
    statusCheckLeaseUntil: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'processing', 'published', 'failed'],
      default: 'pending',
    },
    publishedAt: { type: Date },
    publishingResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

postSchema.index({ owner: 1, scheduledAt: 1 });

module.exports = mongoose.model('Post', postSchema);
