export type ExtensionList = {
	builtin?: {
		disabled?: string[];
		enabled?: string[];
	};
	disabled: string[];
	enabled: string[];
};

export type MarketPlace = {
	kind: 'marketplace';
	serviceUrl: string;
	itemUrl: string;
};

export type Source = MarketPlace;

export type VSIXManager = {
	listManagedExtensions(): Promise<string[]>;
};
