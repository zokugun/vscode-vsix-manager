import { configure, gitignore, ignores } from '@zokugun/eslint-config';
import { json, jsonc, yaml } from '@zokugun/eslint-config-data';
import { glossary } from '@zokugun/eslint-config-glossary';
import { javascript, regexp } from '@zokugun/eslint-config-js';
import { markdown } from '@zokugun/eslint-config-md';
import { nodejs } from '@zokugun/eslint-config-nodejs';
import { importX, perfectionist, stylistic } from '@zokugun/eslint-config-style';
import { typescript } from '@zokugun/eslint-config-ts';

export default configure([
	// configdotts/Ignore rules
	ignores(),
	gitignore(),

	// configdotts/Documentation rules
	glossary(),
	markdown(),

	// configdotts/Runtime rules
	nodejs(),

	// configdotts/Language rules
	javascript(),
	typescript(),

	// configdotts/Language-feature rules
	regexp(),

	// configdotts/Testing rules

	// configdotts/Sorting and stylistic rules
	importX(),
	perfectionist(),
	stylistic(),

	// configdotts/Data-format rules
	json(),
	jsonc(),
	yaml(),
]);
