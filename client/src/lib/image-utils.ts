const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.80;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB target

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Try JPEG first for better compression
      let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      
      // If still too large, reduce quality further
      let quality = JPEG_QUALITY;
      while (dataUrl.length > MAX_FILE_SIZE * 1.33 && quality > 0.3) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

export function getImageSizeKB(dataUrl: string): number {
  // Base64 is ~33% larger than binary
  const base64Length = dataUrl.split(',')[1]?.length || 0;
  return Math.round((base64Length * 0.75) / 1024);
}
