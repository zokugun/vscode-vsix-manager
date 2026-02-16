export type Aliases = Record<string, string>;

export type Metadata = {
	kind: MetadataKind;
	enabled: boolean;
	fullName: string;
	source?: string;
	targetName?: string;
	targetVersion?: string;
};

export type MetadataKind = 'extension' | 'group';

export type Extension = { id: string; version: string; builtin?: boolean; enabled?: boolean; mode?: ManagerMode };

export type ExtensionMap = Record<string, Extension>;

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

export type ManagerMode = 'global' | 'workspace';

export type MarketPlace = {
	type: 'marketplace';
	serviceUrl: string;
	itemUrl: string;
	fallback?: string;
	throttle: number;
};

export type RestartMode = 'auto' | 'none' | 'reload-windows' | 'restart-app' | 'restart-host';

export type SearchDownloadResult = {
	type: 'download';
	fullName: string;
	version: string;
	download: () => Promise<string>;
};

export type SearchFileResult = {
	type: 'file';
	fullName: string;
	version: string;
	file: string;
	unlink?: string;
};

export type SearchResult = SearchFileResult | SearchDownloadResult;

export type Source = FileSystem | Forgejo | GitHub | MarketPlace | 'github';

export type VSIXManager = {
	installExtensions(update?: boolean): Promise<void>;
	listManagedExtensions(): Promise<string[]>;
};
