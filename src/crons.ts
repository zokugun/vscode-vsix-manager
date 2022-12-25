import vscode from 'vscode';

type Crons = {
	update?: string;
};

const $cronsIds = {
	update: '',
};

export async function setupCrons() {
	for(const key in $cronsIds) {
		if($cronsIds[key]) {
			await vscode.commands.executeCommand('cronTasks.unregister', $cronsIds[key]);

			$cronsIds[key] = '';
		}
	}

	const config = vscode.workspace.getConfiguration('vsix');
	const crons = config.get<Crons>('crons') ?? {};

	if(crons.update) {
		$cronsIds.update = await vscode.commands.executeCommand('cronTasks.register', crons.update, 'vsix.update');
	}
}
