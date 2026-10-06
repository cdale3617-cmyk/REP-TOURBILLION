import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function archivedFile(name: string) {
  if (!/^[a-zA-Z0-9-]+\.(mp4|mov|m4v|webm)$/.test(name)) throw new Error('Invalid video reference.');
  const directory = new Directory(Paths.document, 'drc-golf-videos');
  directory.create({ idempotent: true, intermediates: true });
  return new File(directory, name);
}
export async function storeVideoFile(uri: string, name: string): Promise<void> {
  const source = new File(uri);
  if (!source.exists || source.size === 0) throw new Error('The source video is no longer available.');
  source.copy(archivedFile(name));
}
export async function getVideoUri(name: string): Promise<string> {
  const file = archivedFile(name);
  if (!file.exists) throw new Error('This video file is missing from this device.');
  return file.uri;
}
export function releaseVideoUri(_uri: string): void {}
export async function deleteVideoFile(name: string): Promise<void> {
  const file = archivedFile(name);
  if (file.exists) file.delete();
}
export async function shareVideoFile(name: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(await getVideoUri(name), { dialogTitle: 'Share DRC golf video' });
}