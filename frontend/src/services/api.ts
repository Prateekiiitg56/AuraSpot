export const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Get the correct image URL - handles both Cloudinary URLs and legacy local paths
 * @param image - Image path or full URL
 * @returns Full image URL or placeholder
 */
export const getImageUrl = (image: string | undefined | null): string => {
  if (!image) {
    return "https://via.placeholder.com/300x200?text=No+Image";
  }
  
  // If it's already a full URL (Cloudinary, etc.), return as-is
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  
  // Legacy local path - try to load from uploads (won't work on Vercel)
  return `${API}/uploads/${image}`;
};
