/**
 * Contract validation utility.
 *
 * Validates data against inline JSON Schema objects from band contracts.
 * Uses lazy import of ajv to avoid loading it when not needed.
 */

/**
 * Validate data against a JSON Schema from a band contract.
 *
 * @param data - The data to validate
 * @param schema - An inline JSON Schema object
 * @param label - Human-readable label for error messages (e.g. "contract.input")
 * @returns null on success, error message string on failure
 */
export async function validateContractSchema(
  data: unknown,
  schema: Record<string, unknown>,
  label: string
): Promise<string | null> {
  const Ajv = (await import("ajv")).default;
  const ajv = new Ajv({ allErrors: true });

  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid && validate.errors) {
    const messages = validate.errors.map(
      (e) => `${e.instancePath || "/"}: ${e.message}`
    );
    return `${label} validation failed: ${messages.join("; ")}`;
  }
  return null;
}
