/**
 * Validates req.body with a Zod schema and replaces it with the parsed
 * (trimmed/normalised) value. Validation errors are turned into a
 * 400 VALIDATION_ERROR response by the error handler.
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}

/** Validates the query string. Express 5 makes req.query read-only, so the result goes to req.validatedQuery. */
export function validateQuery(schema) {
  return (req, _res, next) => {
    req.validatedQuery = schema.parse(req.query ?? {});
    next();
  };
}
