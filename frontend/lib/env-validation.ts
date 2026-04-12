export function validateEnv(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_USE_LOCAL_PIPELINE === "true"
  ) {
    throw new Error(
      "[SECURITY] NEXT_PUBLIC_USE_LOCAL_PIPELINE must not be true in production. " +
        "Remove it from your production environment variables."
    );
  }
}
