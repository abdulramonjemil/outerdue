module.exports = {
  extends: [
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:eslint-comments/recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "prettier"
  ],

  env: { browser: true },
  ignorePatterns: ["!.*"],
  parser: "@typescript-eslint/parser",

  parserOptions: {
    ecmaVersion: 2020,
    project: "./tsconfig.eslint.json"
  },

  plugins: ["@typescript-eslint", "eslint-comments", "ignore-generated"],

  rules: {
    "import/prefer-default-export": "off",

    "import/extensions": [
      "error",
      "always",
      {
        ts: "never",
        tsx: "never",
        js: "never",
        jsx: "never"
      }
    ],

    "import/no-unresolved": "error",
    "lines-between-class-members": [
      "error",
      "always",
      { exceptAfterSingleLine: true }
    ],

    "no-restricted-syntax": "off",
    "no-underscore-dangle": ["error", { allow: ["__cmd_type__"] }],
    "arrow-parens": ["error", "always"],
    semi: ["error", "never"],
    quotes: ["error", "double"]
  },

  root: true,

  settings: {
    "import/resolver": {
      alias: {
        map: [["@", "./src"]],
        extensions: [".ts", ".js"]
      }
    }
  }
}
