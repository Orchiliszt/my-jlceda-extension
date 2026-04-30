import esbuild from 'esbuild';

esbuild.buildSync({
	entryPoints: {
		setNetToPin: './iframe/setNetToPin.ts',
	},
	entryNames: '[name]',
	assetNames: '[name]',
	bundle: true,
	outdir: './dist/',
	format: 'iife',
	platform: 'browser',
	minify: false,
	sourcemap: false,
	loader: {},
	define: {},
});

console.log('【Done】 iframe/setNetToPin.js built successfully');
