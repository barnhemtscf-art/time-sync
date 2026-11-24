export interface CompressImageOptions {
  maxDimension?: number;
  maxBytes?: number;
  quality?: number;
}

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_MAX_BYTES = 420 * 1024;

function readRawDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

function approxDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return dataUrl.length;
  return Math.ceil(((dataUrl.length - commaIdx - 1) * 3) / 4);
}

/**
 * Resizes and compresses raster images via browser Canvas so mobile photos (3-5 MB)
 * shrink to ~80-220 KB, avoiding stalls in localStorage and speeding up Google Drive uploads.
 */
export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<string | undefined> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const initialQuality = options.quality ?? 0.78;

  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (isSvg) {
    if (file.size > maxBytes) return undefined;
    return readRawDataUrl(file);
  }

  const rawDataUrl = await readRawDataUrl(file);
  if (!rawDataUrl) return undefined;

  // Already small enough and browser doesn't need extra re-encoding
  if (file.size <= 160 * 1024) {
    return rawDataUrl;
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return approxDataUrlBytes(rawDataUrl) <= maxBytes ? rawDataUrl : undefined;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(approxDataUrlBytes(rawDataUrl) <= maxBytes ? rawDataUrl : undefined);
          return;
        }
        const scale = Math.min(1, maxDimension / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(approxDataUrlBytes(rawDataUrl) <= maxBytes ? rawDataUrl : undefined);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let compressed = canvas.toDataURL('image/jpeg', initialQuality);
        if (approxDataUrlBytes(compressed) > maxBytes) {
          compressed = canvas.toDataURL('image/jpeg', 0.6);
        }
        if (approxDataUrlBytes(compressed) > maxBytes) {
          // One more downscale pass for ultra-large camera images
          const smaller = document.createElement('canvas');
          smaller.width = Math.max(1, Math.round(targetW * 0.65));
          smaller.height = Math.max(1, Math.round(targetH * 0.65));
          const sCtx = smaller.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#FFFFFF';
            sCtx.fillRect(0, 0, smaller.width, smaller.height);
            sCtx.drawImage(canvas, 0, 0, smaller.width, smaller.height);
            compressed = smaller.toDataURL('image/jpeg', 0.58);
          }
        }
        resolve(approxDataUrlBytes(compressed) <= maxBytes ? compressed : compressed);
      } catch {
        resolve(approxDataUrlBytes(rawDataUrl) <= maxBytes ? rawDataUrl : undefined);
      }
    };
    img.onerror = () => {
      resolve(approxDataUrlBytes(rawDataUrl) <= maxBytes ? rawDataUrl : undefined);
    };
    img.src = rawDataUrl;
  });
}

export async function readAttachmentForStorage(file: File, isImage: boolean): Promise<string | undefined> {
  if (isImage) {
    return compressImageFileToDataUrl(file);
  }
  if (file.size > 512 * 1024) {
    return undefined;
  }
  return readRawDataUrl(file);
}
