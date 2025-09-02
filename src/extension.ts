import vscode from 'vscode';
import pkg from '../package.json';
import { adoptExtensions } from './commands/adopt-extensions.js';
import { installExtensions } from './commands/install-extensions.js';
import { uninstallExtensions } from './commands/uninstall-extensions.js';
import { updateExtensions } from './commands/update-extensions.js';
import { setupCrons } from './crons.js';
import { CONFIG_KEY, setupSettings } from './settings.js';
import { listManagedExtensions } from './utils/list-managed-extensions.js';
import { type VSIXManager } from './utils/types.js';

const VERSION_KEY = 'version';

async function showWhatsNewMessage(version: string) { // {{{
	const actions: vscode.MessageItem[] = [{
		title: 'Homepage',
	}, {
		title: 'Release Notes',
	}];

	const result = await vscode.window.showInformationMessage(
		`VSIX Manager has been updated to v${version} — check out what's new!`,
		...actions,
	);

	if(result !== null) {
		if(result === actions[0]) {
			await vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse(`${pkg.homepage}`),
			);
		}
		else if(result === actions[1]) {
			await vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse(`${pkg.homepage}/blob/master/CHANGELOG.md`),
			);
		}
	}
} // }}}

export async function activate(context: vscode.ExtensionContext): Promise<VSIXManager> { // {{{
	await setupSettings(context);

	const previousVersion = context.globalState.get<string>(VERSION_KEY);
	const currentVersion = pkg.version;

	const config = vscode.workspace.getConfiguration(CONFIG_KEY);

	if(previousVersion === undefined || currentVersion !== previousVersion) {
		void context.globalState.update(VERSION_KEY, currentVersion);

		const notification = config.get<string>('notification');

		if(previousVersion === undefined) {
			// don't show notification on install
		}
		else if(notification === 'major') {
			if(currentVersion.split('.')[0] > previousVersion.split('.')[0]) {
				void showWhatsNewMessage(currentVersion);
			}
		}
		else if(notification === 'minor') {
			if(currentVersion.split('.')[0] > previousVersion.split('.')[0] || (currentVersion.split('.')[0] === previousVersion.split('.')[0] && currentVersion.split('.')[1] > previousVersion.split('.')[1])) {
				void showWhatsNewMessage(currentVersion);
			}
		}
		else if(notification !== 'none') {
			void showWhatsNewMessage(currentVersion);
		}
	}

	const disposables: vscode.Disposable[] = [];

	disposables.push(
		vscode.commands.registerCommand('vsix.adoptExtensions', adoptExtensions),
		vscode.commands.registerCommand('vsix.installExtensions', installExtensions),
		vscode.commands.registerCommand('vsix.uninstallExtensions', uninstallExtensions),
		vscode.commands.registerCommand('vsix.updateExtensions', updateExtensions),
	);

	await setupCrons();

	vscode.workspace.onDidChangeConfiguration(async (event) => {
		if(event.affectsConfiguration('vsix.crons')) {
			await setupCrons();
		}
	});

	return {
		installExtensions,
		listManagedExtensions,
	};
} // }}}
