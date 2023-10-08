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
    "@typescript-eslint/consistent-type-definitions": ["error", "type"],
    "import/prefer-default-export": "off",

    "lines-between-class-members": [
      "error",
      "always",
      { exceptAfterSingleLine: true }
    ],

    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../*"],
            message:
              "Don't use '..', please use typescript-style '@alias' import alias instead."
          }
        ]
      }
    ],
    "no-restricted-syntax": "off",
    "no-underscore-dangle": ["error", { allow: ["__type__"] }],
    "arrow-parens": ["error", "always"],
    semi: ["error", "never"],
    quotes: ["error", "double"],

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

    "import/no-unresolved": "error"
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
