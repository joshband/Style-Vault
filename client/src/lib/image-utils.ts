const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.80;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB target

/**
 * Image Preloading System
 * 
 * This module provides background image preloading to improve user experience
 * when browsing the style gallery or using comparison features. Images are
 * preloaded in the background using requestIdleCallback to avoid interfering
 * with critical operations.
 * 
 * Features:
 * - Queue-based preloading with concurrency limits
 * - requestIdleCallback scheduling for non-blocking operation
 * - Automatic cache checking (browser handles via src assignment)
 * - IntersectionObserver-based viewport detection for galleries
 * - Hover-based preloading for comparison views
 */

const PRELOAD_CONCURRENCY = 3;
const PRELOAD_DELAY_MS = 100;

type PreloadStatus = 'pending' | 'loading' | 'loaded' | 'error';

interface PreloadEntry {
  url: string;
  status: PreloadStatus;
  priority: number;
}

class ImagePreloader {
  private queue: PreloadEntry[] = [];
  private activeLoads = 0;
  private loadedUrls = new Set<string>();
  private processingScheduled = false;

  preload(url: string, priority: number = 0): Promise<void> {
    if (!url || this.loadedUrls.has(url)) {
      return Promise.resolve();
    }

    const existingEntry = this.queue.find(e => e.url === url);
    if (existingEntry) {
      existingEntry.priority = Math.max(existingEntry.priority, priority);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push({ url, status: 'pending', priority });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.scheduleProcessing();
      resolve();
    });
  }

  preloadMultiple(urls: string[], priority: number = 0): void {
    urls.forEach(url => this.preload(url, priority));
  }

  isLoaded(url: string): boolean {
    return this.loadedUrls.has(url);
  }

  private scheduleProcessing(): void {
    if (this.processingScheduled) return;
    this.processingScheduled = true;

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        setTimeout(() => this.processQueue(), PRELOAD_DELAY_MS);
      }, { timeout: 2000 });
    } else {
      setTimeout(() => this.processQueue(), PRELOAD_DELAY_MS);
    }
  }

  private processQueue(): void {
    this.processingScheduled = false;

    while (this.activeLoads < PRELOAD_CONCURRENCY && this.queue.length > 0) {
      const entry = this.queue.find(e => e.status === 'pending');
      if (!entry) break;

      entry.status = 'loading';
      this.activeLoads++;

      const img = new Image();
      img.onload = () => {
        entry.status = 'loaded';
        this.loadedUrls.add(entry.url);
        this.activeLoads--;
        this.removeFromQueue(entry.url);
        this.scheduleProcessing();
      };
      img.onerror = () => {
        entry.status = 'error';
        this.activeLoads--;
        this.removeFromQueue(entry.url);
        this.scheduleProcessing();
      };
      img.src = entry.url;
    }
  }

  private removeFromQueue(url: string): void {
    const index = this.queue.findIndex(e => e.url === url);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  clear(): void {
    this.queue = [];
  }
}

export const imagePreloader = new ImagePreloader();

export function preloadImage(url: string, priority: number = 0): Promise<void> {
  return imagePreloader.preload(url, priority);
}

export function preloadImages(urls: string[], priority: number = 0): void {
  imagePreloader.preloadMultiple(urls, priority);
}

export function isImagePreloaded(url: string): boolean {
  return imagePreloader.isLoaded(url);
}

export function createPreloadObserver(
  onIntersect: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onIntersect(entry);
        }
      });
    },
    {
      rootMargin: '200px',
      threshold: 0.1,
      ...options,
    }
  );
}

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

const PREVIEW_MAX_DIMENSION = 800;
const PREVIEW_JPEG_QUALITY = 0.75;

export async function compressDataUrl(dataUrl: string, maxDimension = PREVIEW_MAX_DIMENSION, quality = PREVIEW_JPEG_QUALITY): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedUrl);
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}

export async function compressPreviews(previews: { stillLife: string; landscape: string; portrait: string }): Promise<{ stillLife: string; landscape: string; portrait: string }> {
  const [stillLife, landscape, portrait] = await Promise.all([
    compressDataUrl(previews.stillLife),
    compressDataUrl(previews.landscape),
    compressDataUrl(previews.portrait),
  ]);
  return { stillLife, landscape, portrait };
}
