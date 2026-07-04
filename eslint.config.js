// ESLint 9 flat config. Self-contained: no imported presets or plugins.

const sharedRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  'no-undef': 'error',
  'prefer-const': 'warn',
  'eqeqeq': ['warn', 'smart']
};

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['client/**/*.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly'
      }
    },
    rules: sharedRules
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly'
      }
    },
    rules: sharedRules
  }
];
