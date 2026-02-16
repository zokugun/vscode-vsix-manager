import { inspect } from 'node:util';
import { isPrimitive } from '@zokugun/is-it-type';
import vscode, { window } from 'vscode';
import { CONFIG_KEY } from '../settings.js';

let $channel: vscode.OutputChannel | null = null;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Logger = {
	debug(...args: unknown[]): void {
		if($channel) {
			$channel.appendLine(`[debug] ${args.map(toString).join(' ')}`);
		}
	},
	error(...args: unknown[]): void {
		const config = vscode.workspace.getConfiguration(CONFIG_KEY);
		const showErrorAlert = config.get<boolean>('showErrorAlert') ?? true;

		if(Boolean($channel) || showErrorAlert) {
			const output = args.map(toString).join(' ');

			if($channel) {
				$channel.appendLine(`[error] ${output}`);
			}

			if(showErrorAlert) {
				void window.showErrorMessage(`VSIX Manager: ${output}`);
			}
		}
	},
	info(...args: unknown[]): void {
		if($channel) {
			$channel.appendLine(`[info] ${args.map(toString).join(' ')}`);
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

function toString(value: unknown): string {
	if(isPrimitive(value)) {
		return `${value}`;
	}
	else {
		return inspect(value, { depth: null, compact: true, breakLength: Infinity });
	}
}
