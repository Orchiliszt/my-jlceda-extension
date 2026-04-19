import antfu from '@antfu/eslint-config';

export default antfu({
	stylistic: {
		indent: 'tab',
		quotes: 'single',
		semi: true,
	},

	typescript: true,

	ignores: ['build/dist/', 'coverage/', 'dist/', 'node_modules/', '.eslintcache', 'debug.log', 'test.js'],

	rules: {
		'no-console': 'off',
	},

	languageOptions: {
		globals: {
			eda: 'readonly',
			EDMT_EditorDocumentType: 'readonly',
		},
	},

});
