/**
 * Words that mark a cadastral reference ("foglio 12 particella 340", "fg 12 mapp 340").
 * Shared by the server parser and the search field, which must not autocomplete such queries:
 * a cadastral search may download a whole comune archive the first time.
 */
export const CADASTRAL_MARKER =
  /\b(?:foglio|fg\.?|f\.|particella|part\.?|p\.|mappale|mapp\.?)(?=\s|[:=]|\d|$)/i;

export const looksCadastral = (query: string) => CADASTRAL_MARKER.test(query);
