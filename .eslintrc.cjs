module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: "latest",
  },
  ignorePatterns: ["node_modules/"],
  overrides: [
    {
      files: ["web/**/*.js"],
      env: {
        browser: true,
      },
    },
  ],
  rules: {
    "no-console": "off",
  },
};
