export const GREEN_PHOTO_PATTERN = /^green-[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|heic|heif)$/;

export function checkGreenPhotoName(name: string): string {
  if (!GREEN_PHOTO_PATTERN.test(name)) throw new Error('Invalid saved green-photo reference.');
  return name;
}

export function createGreenPhotoName(uri: string, mimeType?: string | null): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/heic': 'heic', 'image/heif': 'heif',
  };
  const extension = (mimeType && extensions[mimeType])
    || uri.split('?')[0].match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)?.[1]?.toLowerCase()
    || 'jpg';
  return checkGreenPhotoName(`green-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`);
}
