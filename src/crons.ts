import vscode from 'vscode';

type Crons = {
	update?: string;
};

const DEPRECATED_KEY = 'deprecated-crons'

const $cronsIds: Crons = {
	update: undefined,
};

export async function setupCrons(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('vsix');
	const crons = config.get<Crons>('crons') ?? {};

	if(!crons.update && !$cronsIds.update) {
		return;
	}

	const currentWarning = new Date();

	if(currentWarning > new Date(2027, 0, 1)) {
		vscode.window.showErrorMessage(
			'VSIX Manager: Please update your settings.',
			{
				detail: 'The "vsix.crons" setting is not supported since January 1, 2027.\n\nIt has been replaced in favor of the "cronTasks.tasks" setting from the "zokugun.cron-tasks" extension.',
				modal: true,
			}
		);

		return;
	}

	const commands = await vscode.commands.getCommands();
	const hasCronCommands = commands.some((command) => command === 'cronTasks.register');

	if(hasCronCommands) {
		const value = context.globalState.get<Date>(DEPRECATED_KEY);
		const lastWarning = value ? new Date(value) : null;

		if(!lastWarning || lastWarning.getFullYear() !== currentWarning.getFullYear() || lastWarning.getMonth() !== currentWarning.getMonth()) {
			context.globalState.update(DEPRECATED_KEY, currentWarning);

			vscode.window.showWarningMessage(
				'VSIX Manager: Please update your settings.',
				{
					detail: 'The "vsix.crons" setting has been deprecated and replaced in favor of the "cronTasks.tasks" setting from the "zokugun.cron-tasks" extension.\n\nIts support will stop on January 1, 2027.',
					modal: true,
				}
			);
		}
	}
	else {
		vscode.window.showErrorMessage(
			'VSIX Manager: Please update your settings.',
			{
				detail: 'The "vsix.crons" setting has been deprecated and replaced in favor of the "cronTasks.tasks" setting.\n\nYou will need to install the "zokugun.cron-tasks" extension.\n\nIts support will stop on January 1, 2027.',
				modal: true,
			}
		);

		return;
	}

	for(const key in $cronsIds) {
		if($cronsIds[key]) {
			await vscode.commands.executeCommand('cronTasks.unregister', $cronsIds[key]);

			$cronsIds[key] = undefined;
		}
	}

	if(crons.update) {
		$cronsIds.update = await vscode.commands.executeCommand('cronTasks.register', crons.update, 'vsix.update');
	}
}
