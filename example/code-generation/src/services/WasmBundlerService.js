import * as esbuild from 'esbuild-wasm';

class WasmBundlerService {
    constructor() {
        this.initialized = false;
    }

    findEntryPoint(files = []) {
        const normalize = (p = '') => p.replace(/^\/+/, '');
        const normalizedPaths = new Set(files.map(f => normalize(f.path)));

        const candidates = [
            'src/main.jsx', 'src/main.tsx', 'src/main.js', 'src/main.ts',
            'src/index.jsx', 'src/index.tsx', 'src/index.js', 'src/index.ts',
            'index.jsx', 'index.tsx', 'index.js', 'main.jsx', 'main.tsx', 'main.js',
        ];

        const found = candidates.find(p => normalizedPaths.has(p));
        if (found) return found;

        const firstScript = files.find(f => /\.(m?jsx?|tsx?)$/.test(f.path));
        return firstScript ? normalize(firstScript.path) : null;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await esbuild.initialize({
                worker: true,
                wasmURL: 'https://unpkg.com/esbuild-wasm@0.24.0/esbuild.wasm',
            });
            this.initialized = true;
            console.log('ESBuild initialized');
        } catch (err) {
            // If already initialized, ignore error
            if (err.message.includes('initialize')) {
                this.initialized = true;
            } else {
                console.error('Failed to initialize ESBuild:', err);
                throw err;
            }
        }
    }

    async bundle(files, entryPointOverride) {
        if (!this.initialized) await this.initialize();

        // Create a map for easy lookup
        const fileMap = new Map();
        files.forEach(f => {
            // Normalize path to remove leading slash
            const path = f.path.startsWith('/') ? f.path.slice(1) : f.path;
            fileMap.set(path, f.content);
        });

        // Find entry point
        const entryPoint = entryPointOverride || this.findEntryPoint(files);

        if (!entryPoint) {
            throw new Error('No entry point found (e.g., src/main.jsx)');
        }

        try {
            const result = await esbuild.build({
                entryPoints: [entryPoint.startsWith('/') ? entryPoint.slice(1) : entryPoint],
                bundle: true,
                write: false,
                format: 'esm',
                plugins: [
                    {
                        name: 'in-memory-resolver',
                        setup(build) {
                            // Resolve relative paths
                            build.onResolve({ filter: /^\.+\// }, args => {
                                return {
                                    path: new URL(args.path, 'http://localhost/' + args.resolveDir + '/').pathname.slice(1),
                                    namespace: 'in-memory',
                                };
                            });

                            // Resolve bare modules to ESM.sh (External)
                            build.onResolve({ filter: /^[^.\/]/ }, args => {
                                return {
                                    path: `https://esm.sh/${args.path}`,
                                    external: true,
                                };
                            });

                            // Load files from memory
                            build.onLoad({ filter: /.*/, namespace: 'in-memory' }, args => {
                                const content = fileMap.get(args.path);
                                if (!content) {
                                    throw new Error(`File not found: ${args.path}`);
                                }
                                const loader = args.path.endsWith('.tsx') ? 'tsx' :
                                    args.path.endsWith('.ts') ? 'ts' :
                                        args.path.endsWith('.jsx') ? 'jsx' :
                                            args.path.endsWith('.css') ? 'css' :
                                                'js';
                                return {
                                    contents: content,
                                    loader: loader,
                                    resolveDir: args.path.split('/').slice(0, -1).join('/'),
                                };
                            });

                            // Initial entry point resolution
                            build.onResolve({ filter: /.*/ }, args => {
                                if (fileMap.has(args.path)) {
                                    return { path: args.path, namespace: 'in-memory' };
                                }
                            });
                        },
                    },
                ],
            });

            if (result.outputFiles && result.outputFiles.length > 0) {
                return result.outputFiles[0].text;
            }
            return '';
        } catch (err) {
            console.error('Bundling failed:', err);
            throw err;
        }
    }
}

export const wasmBundlerService = new WasmBundlerService();
