import vscode, { window } from 'vscode';
import { CONFIG_KEY } from '../settings.js';

let $channel: vscode.OutputChannel | null = null;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Logger = {
	error(...args: any[]): void {
		if($channel) {
			$channel.appendLine(`[error] ${args.join(' ')}`);
		}

		const config = vscode.workspace.getConfiguration(CONFIG_KEY);
		const showErrorAlert = config.get<boolean>('showErrorAlert') ?? true;

		if(showErrorAlert) {
			void window.showErrorMessage(`VSIX Manager: ${args.join(' ')}`);
		}
	},
	info(...args: any[]): void {
		if($channel) {
			$channel.appendLine(`[info] ${args.join(' ')}`);
		}
	},
	setup(show: boolean = false): void {
		const config = vscode.workspace.getConfiguration(CONFIG_KEY);
		const debug = config.get<boolean>('debug') ?? false;

		if(debug) {
			$channel ||= vscode.window.createOutputChannel('VSIX Manager');
		}

		if(show) {
			$channel?.show();
		}
	},
	show(): void {
		$channel?.show();
	},
};
