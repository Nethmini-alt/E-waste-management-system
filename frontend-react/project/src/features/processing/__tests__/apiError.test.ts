// TC-C-R02 — turning API / network failures into messages a warehouse user can act on.
import { describe, expect, it } from 'vitest';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError';

const apiError = (status: number, data: unknown) => ({ message: 'Request failed', response: { status, data } });

describe('TC-C-R02 API error messages', () => {
  it('lists FluentValidation errors with readable field names', () => {
    const msg = getApiErrorMessage(apiError(400, {
      title: 'One or more validation errors occurred.',
      errors: { 'Jobs[0].Items[1].VerifiedWeightKg': ['Enter the verified weight.'] },
    }));
    expect(msg).toBe('Jobs 1 › Items 2 › Verified Weight Kg: Enter the verified weight.');
  });

  it('shows at most three validation messages and counts the rest', () => {
    const errors = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((f) => [f, [`${f} is wrong`]]));
    expect(getApiErrorMessage(apiError(400, { errors }))).toBe('A: A is wrong • B: B is wrong • C: C is wrong (+2 more)');
  });

  it('uses the ProblemDetails detail for business-rule conflicts (409)', () => {
    const msg = getApiErrorMessage(apiError(409, { title: 'Job already received', detail: "Job '123' has already been received into inventory." }));
    expect(msg).toBe("Job '123' has already been received into inventory.");
  });

  it('hides exception details on server errors (5xx) and shows the friendly title', () => {
    const msg = getApiErrorMessage(apiError(500, { title: 'An unexpected error occurred', detail: 'NullReferenceException at Foo.Bar()' }));
    expect(msg).toBe('An unexpected error occurred');
  });

  it('explains when the API cannot be reached at all', () => {
    expect(getApiErrorMessage({ message: 'Network Error', request: {} })).toBe(
      'Cannot reach the server. Check that the API is running and try again.',
    );
  });

  it('has sensible messages for 401 / 403 / 404 without a body', () => {
    expect(getApiErrorMessage(apiError(401, undefined))).toBe('Your session has expired. Please sign in again.');
    expect(getApiErrorMessage(apiError(403, undefined))).toBe('You do not have permission to do this.');
    expect(getApiErrorMessage(apiError(404, undefined))).toBe('The requested resource was not found.');
  });

  it('accepts plain strings, { message } bodies and unknown values', () => {
    expect(getApiErrorMessage(apiError(401, 'Could not resolve the staff id.'))).toBe('Could not resolve the staff id.');
    expect(getApiErrorMessage(apiError(400, { message: 'Collector not found.' }))).toBe('Collector not found.');
    expect(getApiErrorMessage(undefined, 'Fallback')).toBe('Fallback');
    expect(getApiErrorMessage(42)).toBe('Something went wrong. Please try again.');
  });

  it('returns the HTTP status, or undefined for network errors', () => {
    expect(getApiErrorStatus(apiError(409, {}))).toBe(409);
    expect(getApiErrorStatus({ request: {} })).toBeUndefined();
    expect(getApiErrorStatus(null)).toBeUndefined();
  });
});
