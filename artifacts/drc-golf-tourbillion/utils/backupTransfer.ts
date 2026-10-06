import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

export async function exportBackup(contents: string): Promise<void> {
  const name = `drc-golf-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const uri = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = uri; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(uri), 1000);
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const file = new File(Paths.cache, name); file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your DRC golf backup' });
}
export async function chooseBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.');
  if (Platform.OS === 'web') {
    if (asset.file) return asset.file.text();
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Could not read this backup.');
    return response.text();
  }
  return new File(asset.uri).text();
}