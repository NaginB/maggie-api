import pluralize from "pluralize";
export const singularToPlural = (word: string): string =>
  word ? pluralize(word) : word;
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
