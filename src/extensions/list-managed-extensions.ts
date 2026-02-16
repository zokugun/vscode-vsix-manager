import { ExtensionManager } from './extension-manager.js';

export async function listManagedExtensions(): Promise<string[]> {
	const extensionManager = new ExtensionManager();

	const loadResult = await extensionManager.loadManagedExtensions();
	if(loadResult.fails) {
		return [];
	}

	return extensionManager.listInstalled();
}
