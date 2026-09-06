const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const stylistic = require('@stylistic/eslint-plugin');

// Preserve ESLint 7.32.0 + typescript-eslint 3.10.1 recommended rules,
// followed by the original .eslintrc.json overrides. Do not use the current
// recommended presets: upgrading the toolchain must not change lint policy.
// Sources: eslint@7.32.0/conf/eslint-recommended.js and
// typescript-eslint@3.10.1/packages/eslint-plugin/src/configs/{eslint-recommended,recommended}.ts.
module.exports = [
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    linterOptions: { reportUnusedDisableDirectives: false },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@stylistic': stylistic,
    },
    rules: {
      "constructor-super": "off",
      "for-direction": "error",
      "getter-return": "off",
      "no-async-promise-executor": "error",
      "no-case-declarations": "error",
      "no-class-assign": "error",
      "no-compare-neg-zero": "error",
      "no-cond-assign": "error",
      "no-const-assign": "off",
      "no-constant-condition": [
        "error",
        {
          "checkLoops": "all"
        }
      ],
      "no-control-regex": "error",
      "no-debugger": "error",
      "no-delete-var": "error",
      "no-dupe-args": "off",
      "no-dupe-class-members": "off",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "off",
      "no-duplicate-case": "error",
      "no-empty": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-ex-assign": "error",
      "no-extra-boolean-cast": "error",
      "no-extra-semi": "off",
      "no-fallthrough": "error",
      "no-func-assign": "off",
      "no-global-assign": "error",
      "no-import-assign": "off",
      "no-inner-declarations": [
        "error",
        "functions",
        {
          "blockScopedFunctions": "disallow"
        }
      ],
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-misleading-character-class": "error",
      "no-mixed-spaces-and-tabs": "error",
      "no-new-symbol": "off",
      "no-obj-calls": "off",
      "no-octal": "error",
      "no-prototype-builtins": "error",
      "no-redeclare": "off",
      "no-regex-spaces": "error",
      "no-self-assign": "error",
      "no-setter-return": "off",
      "no-shadow-restricted-names": "error",
      "no-sparse-arrays": "error",
      "no-this-before-super": "off",
      "no-undef": "off",
      "no-unexpected-multiline": "error",
      "no-unreachable": "off",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "off",
      "no-unused-labels": "error",
      "no-unused-vars": "off",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-with": "error",
      "require-yield": "error",
      "use-isnan": "error",
      "valid-typeof": "off",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false
        }
      ],
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "no-array-constructor": "off",
      "@typescript-eslint/no-array-constructor": "error",
      "no-empty-function": "off",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-extra-non-null-assertion": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "@typescript-eslint/no-misused-new": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-this-alias": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "caughtErrors": "none"
        }
      ],
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/prefer-namespace-keyword": "error",
      "@typescript-eslint/triple-slash-reference": "error",
      "@typescript-eslint/naming-convention": "warn",
      "semi": "off",
      "curly": "warn",
      "object-curly-spacing": [
        "warn",
        "always"
      ],
      "eqeqeq": "warn",
      "no-throw-literal": "warn",
      "quotes": [
        2,
        "single",
        {
          "avoidEscape": true
        }
      ],
      "no-trailing-spaces": "error",
      "keyword-spacing": [
        "error",
        {
          "before": true,
          "after": true
        }
      ],
      "max-len": [
        "warn",
        {
          "code": 120
        }
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@stylistic/semi": "warn",
      "@stylistic/no-extra-semi": "error",
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          "types": {
            "String": {
              "message": "Use string instead",
              "fixWith": "string"
            },
            "Boolean": {
              "message": "Use boolean instead",
              "fixWith": "boolean"
            },
            "Number": {
              "message": "Use number instead",
              "fixWith": "number"
            },
            "Symbol": {
              "message": "Use symbol instead",
              "fixWith": "symbol"
            },
            "Function": "Declare the function signature explicitly.",
            "Object": "Use Record<string, unknown> or unknown instead.",
            "{}": "Use Record<string, unknown> or unknown instead.",
            "object": "Use Record<string, unknown> instead."
          }
        }
      ]
    },
  },
];
