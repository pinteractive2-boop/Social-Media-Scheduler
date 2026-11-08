const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    caption: { type: String, required: [true, 'Caption is required'] },
    imageUrl: { type: String },
    imagePublicId: { type: String },
    platform: {
      type: String,
      enum: ['instagram', 'linkedin'],
      required: [true, 'Platform is required'],
    },
    scheduledAt: { type: Date, required: [true, 'Scheduled time is required'] },
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

module.exports = mongoose.model('Post', postSchema);
