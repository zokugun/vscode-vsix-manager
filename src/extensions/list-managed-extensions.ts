import { ExtensionManager } from './extension-manager.js';

export async function listManagedExtensions(): Promise<string[]> {
	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	return extensionManager.listInstalled();
}
