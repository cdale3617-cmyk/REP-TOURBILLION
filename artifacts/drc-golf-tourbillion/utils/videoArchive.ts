import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { deleteVideoFile, storeVideoFile } from './videoFiles';

const KEY = 'drc-golf-tourbillion-video-reviews-v1';
const reviewSchema = z.object({
  id: z.string(), fileName: z.string().regex(/^[a-zA-Z0-9-]+\.(mp4|mov|m4v|webm)$/),
  tool: z.enum(['swing-monitor', 'shot-tracer']), note: z.string(), createdAt: z.string().datetime(),
});
export type VideoReview = z.infer<typeof reviewSchema>;
export async function listVideoReviews(): Promise<VideoReview[]> {
  const saved = await AsyncStorage.getItem(KEY);
  if (!saved) return [];
  try { return z.array(reviewSchema).parse(JSON.parse(saved)); }
  catch { throw new Error('The saved video list could not be read. Existing files have been left untouched.'); }
}
export async function archiveVideo(uri: string, tool: VideoReview['tool'], note: string, mimeType?: string): Promise<VideoReview> {
  const reviews = await listVideoReviews();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const extension = mimeType === 'video/webm' || uri.startsWith('data:video/webm') ? 'webm'
    : mimeType === 'video/quicktime' ? 'mov'
    : uri.split('?')[0].match(/\.(mp4|mov|m4v|webm)$/i)?.[1]?.toLowerCase() ?? 'mp4';
  const review: VideoReview = { id, fileName: `${id}.${extension}`, tool, note: note.trim(), createdAt: new Date().toISOString() };
  await storeVideoFile(uri, review.fileName);
  try { await AsyncStorage.setItem(KEY, JSON.stringify([review, ...reviews])); }
  catch {
    await deleteVideoFile(review.fileName);
    throw new Error('Video details could not be saved. The clip has not been added to your library.');
  }
  return review;
}
export async function removeVideoReview(review: VideoReview): Promise<void> {
  const reviews = await listVideoReviews();
  await deleteVideoFile(review.fileName);
  await AsyncStorage.setItem(KEY, JSON.stringify(reviews.filter((entry) => entry.id !== review.id)));
}