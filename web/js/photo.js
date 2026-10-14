// Photo of the day: resized on the phone before it enters the outbox (spec §3.2, §9),
// so the queued blob is small and the upload feels instant.

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to <img>, which also honors EXIF orientation in modern browsers.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(src, max) {
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode-failed'))), type, quality)
  );
}

/** → { blob: ~1600px JPEG for upload, thumb: small JPEG data URL kept on the phone } */
export async function resizePhoto(file, max = 1600, thumbMax = 320) {
  const src = await decode(file);
  try {
    const blob = await toBlob(draw(src, max), 'image/jpeg', 0.82);
    const thumb = draw(src, thumbMax).toDataURL('image/jpeg', 0.72);
    return { blob, thumb };
  } finally {
    src.close?.();
  }
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
