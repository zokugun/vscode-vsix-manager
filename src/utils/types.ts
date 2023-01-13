export type ExtensionList = {
	builtin?: {
		disabled?: string[];
		enabled?: string[];
	};
	disabled: string[];
	enabled: string[];
};

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

export type Source = MarketPlace;

export type VSIXManager = {
	installExtensions(update?: boolean): Promise<void>;
	listManagedExtensions(): Promise<string[]>;
};
