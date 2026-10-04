type Environment = Record<string, string | undefined>;

function deployed(source: Environment): boolean {
  return (
    source.NODE_ENV === "production" ||
    source.VERCEL === "1" ||
    source.VERCEL_ENV === "production" ||
    source.VERCEL_ENV === "preview"
  );
}

/** Database stores remain the application backend; prototype is a local tooling opt-in. */
export function validatePersistenceConfiguration(
  source: Environment = process.env,
): void {
  const backend = source.BOOKMAX_PERSISTENCE ?? "database";
  if (!["database", "prototype", "file"].includes(backend)) {
    throw new Error("Unknown BOOKMAX_PERSISTENCE backend.");
  }
  if (
    backend !== "database" &&
    (deployed(source) || source.NODE_ENV !== "development")
  ) {
    throw new Error(
      "Prototype/file persistence is available only in explicit local development.",
    );
  }
}

export function assertPrototypePersistenceAllowed(
  source: Environment = process.env,
): void {
  validatePersistenceConfiguration(source);
  // Test memory never enables file writes; VITEST cannot override production restrictions.
  if (source.NODE_ENV === "test" && !deployed(source)) return;
  if (
    source.NODE_ENV !== "development" ||
    !["prototype", "file"].includes(source.BOOKMAX_PERSISTENCE ?? "")
  ) {
    throw new Error(
      "Set BOOKMAX_PERSISTENCE=prototype explicitly for local development.",
    );
  }
}

export function prototypeFilePersistenceEnabled(): boolean {
  assertPrototypePersistenceAllowed();
  return process.env.NODE_ENV === "development";
}
