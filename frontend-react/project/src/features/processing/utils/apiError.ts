/**
 * One place that turns whatever the API (or the network) throws into a sentence for the UI.
 *
 * The backend answers with:
 *  - ProblemDetails from GlobalExceptionHandler:  { title, detail, status }
 *  - ValidationProblemDetails from FluentValidation auto-validation: { title, status, errors: { Field: [msg] } }
 *  - a bare string for Unauthorized("...")
 *  - { message } from the Collection/Auth controllers
 * Duck-typed on purpose so this file does not need to import axios.
 */

interface ApiErrorBody {
  title?: string;
  detail?: string;
  message?: string;
  status?: number;
  errors?: Record<string, string[] | string>;
}

interface ErrorLike {
  message?: string;
  response?: { status?: number; data?: unknown };
  request?: unknown;
}

const MAX_VALIDATION_MESSAGES = 3;

const prettyField = (field: string): string =>
  field
    .replace(/\[(\d+)\]/g, (_m, i: string) => ` ${Number(i) + 1}`)
    .replace(/\./g, ' › ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

const validationMessages = (errors: NonNullable<ApiErrorBody['errors']>): string[] =>
  Object.entries(errors).flatMap(([field, msgs]) =>
    (Array.isArray(msgs) ? msgs : [msgs]).map((m) => (field ? `${prettyField(field)}: ${m}` : m)),
  );

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (typeof error === 'string') return error || fallback;
  if (!error || typeof error !== 'object') return fallback;

  const err = error as ErrorLike;
  const response = err.response;

  // Request left the browser but nothing came back (API down, CORS, offline).
  if (!response) {
    return err.request ? 'Cannot reach the server. Check that the API is running and try again.' : err.message || fallback;
  }

  const status = response.status;
  const data = response.data;

  if (typeof data === 'string' && data.trim()) return data;

  if (data && typeof data === 'object') {
    const body = data as ApiErrorBody;

    if (body.errors && typeof body.errors === 'object') {
      const msgs = validationMessages(body.errors);
      if (msgs.length > 0) {
        const shown = msgs.slice(0, MAX_VALIDATION_MESSAGES).join(' • ');
        return msgs.length > MAX_VALIDATION_MESSAGES ? `${shown} (+${msgs.length - MAX_VALIDATION_MESSAGES} more)` : shown;
      }
    }

    // 5xx detail is an exception message — show the friendly title instead.
    if (status !== undefined && status >= 500) return body.title || fallback;

    if (body.detail) return body.detail;
    if (body.message) return body.message;
    if (body.title) return body.title;
  }

  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do this.';
  if (status === 404) return 'The requested resource was not found.';
  return fallback;
}

/** HTTP status of an API error, or undefined for network errors / non-API errors. */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as ErrorLike).response?.status;
}
