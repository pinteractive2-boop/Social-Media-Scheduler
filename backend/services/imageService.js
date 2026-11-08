const { configure } = require('../config/cloudinary');

function validateImageContents(buffer) {
  const isJpeg = buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isPng = buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    const error = new Error('Uploaded file contents are not a supported image');
    error.statusCode = 400;
    throw error;
  }
}

function uploadToCloudinary(buffer) {
  const cloudinary = configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'social-media-scheduler', resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        if (!result || !result.secure_url || !result.public_id) {
          return reject(new Error('Cloudinary returned an incomplete upload result'));
        }

        return resolve({
          imageUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.end(buffer);
  });
}

async function uploadImage(file) {
  validateImageContents(file.buffer);
  return uploadToCloudinary(file.buffer);
}

async function deleteImage(publicId) {
  const cloudinary = configure();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
  });

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary image deletion failed: ${result.result}`);
  }
}

module.exports = { uploadImage, deleteImage };
