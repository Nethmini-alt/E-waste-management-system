// ASP.NET Core's [ApiController] auto-validation (via FluentValidation here)
// returns failures as a ValidationProblemDetails body shaped like:
// { title: "...", errors: { "Category": ["Category is required."], ... } }
// This flattens that into a plain array of messages the UI can just render.
export function parseApiValidationErrors(error: unknown): string[] {
  const response = (error as { response?: { data?: unknown } })?.response;
  const data = response?.data as
    | { errors?: Record<string, string[]>; message?: string; title?: string }
    | undefined;

  if (data?.errors) {
    return Object.values(data.errors).flat();
  }

  if (data?.message) {
    return [data.message];
  }

  if (data?.title) {
    return [data.title];
  }

  return ['Something went wrong. Please check your details and try again.'];
}