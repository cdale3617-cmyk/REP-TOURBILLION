import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { checkGreenPhotoName } from './greenPhotoReference';

function savedFile(name: string) {
  checkGreenPhotoName(name);
  const directory = new Directory(Paths.document, 'drc-golf-green-photos');
  directory.create({ idempotent: true, intermediates: true });
  return new File(directory, name);
}

export async function storeGreenPhoto(uri: string, name: string): Promise<void> {
  const source = new File(uri);
  if (!source.exists || !source.size) throw new Error('The selected photo is no longer available.');
  source.copy(savedFile(name));
}

export async function getGreenPhotoUri(name: string): Promise<string> {
  const file = savedFile(name);
  if (!file.exists) throw new Error('This photo is not on this device. The saved note is still available; JSON backups contain references, not photo files.');
  return file.uri;
}

export function releaseGreenPhotoUri(_uri: string): void {}

export async function deleteGreenPhoto(name: string): Promise<void> {
  const file = savedFile(name);
  if (file.exists) file.delete();
}

export async function shareGreenPhoto(name: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Photo sharing is unavailable on this device.');
  await Sharing.shareAsync(await getGreenPhotoUri(name), { dialogTitle: 'Export saved green photo' });
}
