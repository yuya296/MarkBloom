/** @type {import('stylelint').Config} */
module.exports = {
  ignoreFiles: ["**/node_modules/**", "**/dist/**"],
  overrides: [
    {
      files: ["**/*.scss"],
      customSyntax: "postcss-scss",
    },
  ],
  rules: {
    "rule-selector-property-disallowed-list": {
      "/\\.cm-(content|line|lineWrapping|gutterElement)\\b/": [
        "line-height",
        "font-size",
        "padding-top",
        "padding-bottom",
        "transform",
        "position",
      ],
    },
  },
};
