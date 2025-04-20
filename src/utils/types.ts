export type Extension = {
	kind: ExtensionKind;
	fullName: string;
	version?: string;
	source?: string;
	enabled: boolean;
};

export type ExtensionKind = 'extension' | 'group';

export type ExtensionList = {
	builtin?: {
		disabled?: string[];
		enabled?: string[];
	};
	disabled: string[];
	enabled: string[];
};

export type FileSystem = {
	type: 'file';
	path: string;
	fallback?: string;
};

export type Forgejo = {
	type: 'forgejo';
	serviceUrl: string;
	owner?: string;
	token?: string;
	fallback?: string;
};

export type GitHub = {
	type: 'github';
	owner?: string;
	token?: string;
	fallback?: string;
};

export type GitService = Forgejo | GitHub;
export type GitConfig = {
	getHeaders(source: GitService | undefined): {} | undefined;
	getReleasesUrl(extensionName: string, source: GitService | undefined): string;
};

export type InstallResult = { name: string; version: string; enabled: boolean } | undefined;

export type MarketPlaceOld = {
	kind: 'marketplace';
	serviceUrl: string;
	itemUrl: string;
};

export type MarketPlace = {
	type: 'marketplace';
	serviceUrl: string;
	itemUrl: string;
	fallback?: string;
	throttle: number;
};

export type RestartMode = 'auto' | 'none' | 'reload-windows' | 'restart-app' | 'restart-host';

export type Source = FileSystem | Forgejo | GitHub | MarketPlace | 'github';

export type UpdateResult = string | { name: string; version: string; updated: boolean } | undefined;

export type VSIXManager = {
	installExtensions(update?: boolean): Promise<void>;
	listManagedExtensions(): Promise<string[]>;
};
