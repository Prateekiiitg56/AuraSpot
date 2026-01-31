const cloudinary = require("cloudinary").v2;

// Configure Cloudinary - supports both CLOUDINARY_URL and separate variables
if (process.env.CLOUDINARY_URL) {
  // If CLOUDINARY_URL is set, cloudinary auto-configures from it
  console.log("[CLOUDINARY] Configured via CLOUDINARY_URL");
} else {
  // Otherwise use separate variables
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log("[CLOUDINARY] Configured via separate env vars");
}

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer from multer memory storage
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<string>} - Cloudinary URL
 */
const uploadImage = async (buffer, folder = "auraspot") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "image",
        transformation: [
          { width: 800, height: 600, crop: "limit" },
          { quality: "auto" }
        ]
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    
    uploadStream.end(buffer);
  });
};

/**
 * Upload multiple images
 * @param {Array} files - Array of multer files with buffer
 * @param {string} folder - Folder name
 * @returns {Promise<string[]>} - Array of Cloudinary URLs
 */
const uploadMultipleImages = async (files, folder = "auraspot") => {
  if (!files || files.length === 0) return [];
  
  const uploadPromises = files.map(file => uploadImage(file.buffer, folder));
  return Promise.all(uploadPromises);
};

/**
 * Delete image from Cloudinary
 * @param {string} url - Cloudinary URL
 */
const deleteImage = async (url) => {
  try {
    // Extract public_id from URL
    const parts = url.split("/");
    const filename = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const publicId = `${folder}/${filename.split(".")[0]}`;
    
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadMultipleImages,
  deleteImage
};
