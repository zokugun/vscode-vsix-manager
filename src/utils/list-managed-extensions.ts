import { ExtensionManager } from './extension-manager';

export async function listManagedExtensions(): Promise<string[]> {
	const extensionManager = new ExtensionManager();

	await extensionManager.load();

	return extensionManager.listInstalled();
}
