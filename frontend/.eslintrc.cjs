module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    // React 17+ automatic JSX transform — no import needed
    'react/react-in-jsx-scope': 'off',
    // Small project; prop shapes are documented with JSDoc instead
    'react/prop-types': 'off',
    // Warn on unused locals but allow _prefixed variables to be ignored
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Avoid confusing equality pitfalls
    'eqeqeq': ['error', 'always'],
    // Catch awaited-but-not-returned async functions inside effects
    'no-async-promise-executor': 'error',
  },
}
