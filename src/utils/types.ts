export type Metadata = {
	kind: MetadataKind;
	enabled: boolean;
	fullName: string;
	source?: string;
	targetName?: string;
	targetVersion?: string;
};

export type MetadataKind = 'extension' | 'group';

export type Extension = { id: string; version: string };

export type ExtensionList = {
	builtin?: {
		disabled?: Extension[];
		enabled?: Extension[];
	};
	disabled: Extension[];
	enabled: Extension[];
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
	serviceUrl?: string;
	owner?: string;
	token?: string;
	fallback?: string;
};

export type GitService = Forgejo | GitHub;
export type GitConfig = {
	getHeaders(source: GitService | undefined): {} | undefined;
	getDownloadHeaders(source: GitService | undefined): {} | undefined;
	getReleasesUrl(extensionName: string, source: GitService | undefined): string;
	getAssetUrl(asset: unknown): string;
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
