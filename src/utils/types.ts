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
};

export type InstallResult = string | { name: string; version: string } | undefined;

export type MarketPlaceOld = {
	kind: 'marketplace';
	serviceUrl: string;
	itemUrl: string;
};

export type MarketPlace = {
	type: 'marketplace';
	serviceUrl: string;
	itemUrl: string;
};

export type Source = FileSystem | MarketPlace | 'github';

export type UpdateResult = string | { name: string; version: string; updated: boolean } | undefined;

export type VSIXManager = {
	installExtensions(update?: boolean): Promise<void>;
	listManagedExtensions(): Promise<string[]>;
};
