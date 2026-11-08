const mongoose = require('mongoose');

const connectedAccountSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true },
    platform: { type: String, enum: ['instagram', 'linkedin'], required: true },
    username: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    displayName: { type: String, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    zernioProfileId: { type: String, default: null },
    connectedAccounts: { type: [connectedAccountSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
