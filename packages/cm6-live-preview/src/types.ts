export type Range = { from: number; to: number };

export type ExcludeRanges = {
  block: Range[];
  inline: Range[];
};

export type InlineMarkRanges = {
  codeMarks: Range[];
  emphasisMarks: Range[];
  strikethroughMarks: Range[];
};
