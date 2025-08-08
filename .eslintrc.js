module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'indent': ['error', 4],
  },
  overrides: [
    {
      files: ['*.tsx'],
      rules: {
        'indent': ['error', 2], 
      },
    },
  ],
};
