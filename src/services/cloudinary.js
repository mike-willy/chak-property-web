// src/services/cloudinary.js - FIXED VERSION
import axios from 'axios';

// Configuration
const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dbv5trqkz';
const CLOUDINARY_UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'property_uploads';

/**
 * Upload image to Cloudinary
 * @param {File} file - Image file
 * @param {Object} options - Options for upload
 * @returns {Promise<Object>} Upload result
 */
export const uploadImageToCloudinary = async (file, options = {}) => {
  try {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // ❌ REMOVE THIS: formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
    // Cloud_name should be in URL only, not in form data!

    // Add folder for organization
    if (options.folder) {
      formData.append('folder', options.folder);
    }

    // ❌ TEMPORARILY COMMENT OUT transformation for debugging
    // const transformation = 'w_1200,h_800,c_limit,q_auto:good,f_auto';
    // formData.append('transformation', transformation);

    // ✅ CORRECT URL with cloud_name
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    
    console.log('📤 Uploading to Cloudinary:', {
      url: cloudinaryUrl,
      cloudName: CLOUDINARY_CLOUD_NAME,
      uploadPreset: CLOUDINARY_UPLOAD_PRESET,
      fileName: file.name,
      fileSize: file.size,
      folder: options.folder
    });

    // Upload
    const response = await axios.post(
      cloudinaryUrl,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000 // 30 seconds
      }
    );

    console.log('✅ Upload successful:', {
      url: response.data.secure_url,
      publicId: response.data.public_id,
      size: response.data.bytes
    });

    return {
      success: true,
      url: response.data.secure_url,
      publicId: response.data.public_id,
      width: response.data.width,
      height: response.data.height,
      bytes: response.data.bytes
    };

  } catch (error) {
    console.error('❌ Cloudinary upload error details:');
    console.error('Status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    console.error('Error message:', error.response?.data?.error?.message || error.message);
    
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Unknown upload error'
    };
  }
};

/**
 * Upload multiple images
 * @param {File[]} files - Array of image files
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleImages = async (files, options = {}) => {
  if (!files || !files.length) return [];

  const uploadPromises = Array.from(files)
    .slice(0, 10) // Max 10 images
    .map(file => uploadImageToCloudinary(file, options));

  const results = await Promise.all(uploadPromises);
  
  console.log('📊 Multiple upload results:', {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
  
  return results;
};

export default {
  uploadImage: uploadImageToCloudinary,
  uploadMultiple: uploadMultipleImages
};