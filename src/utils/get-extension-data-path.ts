import path from 'path';
import { getEditorStorage } from './get-editor-storage';

export async function getExtensionDataPath(): Promise<string> {
	return path.join(await getEditorStorage(), 'extensions');
}
