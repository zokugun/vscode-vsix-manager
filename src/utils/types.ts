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

export type Source = FileSystem | MarketPlace | 'github';

export type UpdateResult = string | { name: string; version: string; updated: boolean } | undefined;

export type VSIXManager = {
	installExtensions(update?: boolean): Promise<void>;
	listManagedExtensions(): Promise<string[]>;
};
