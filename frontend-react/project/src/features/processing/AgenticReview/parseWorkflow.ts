import type { AnalyzerResult, MatcherResult, PlanInfo, ValidatorResult } from './types';

/**
 * The agents' results are stored as JSON text. Their property casing differs (results are PascalCase,
 * the plan is camelCase), and the format belongs to the agent services, so every field is read
 * case-insensitively and anything missing or malformed simply comes back as null.
 */
const parseObject = (json: string | null): Record<string, unknown> | null => {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const pick = (obj: Record<string, unknown> | null, key: string): unknown => {
  if (!obj) return undefined;
  const wanted = key.toLowerCase();
  const found = Object.keys(obj).find((k) => k.toLowerCase() === wanted);
  return found === undefined ? undefined : obj[found];
};

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const asNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export const parseAnalyzerResult = (json: string | null): AnalyzerResult | null => {
  const o = parseObject(json);
  if (!o) return null;
  return {
    wasteCategory: asString(pick(o, 'wasteCategory')),
    hazardLevel: asString(pick(o, 'hazardLevel')),
    estimatedVolumeKg: asNumber(pick(o, 'estimatedVolumeKg')),
    estimatedValueUsd: asNumber(pick(o, 'estimatedValueUsd')),
    confidenceScore: asNumber(pick(o, 'confidenceScore')),
  };
};

export const parseValidatorResult = (json: string | null): ValidatorResult | null => {
  const o = parseObject(json);
  if (!o) return null;
  const reasons = pick(o, 'reasons');
  return {
    approvedForAutoAssignment: asBool(pick(o, 'approvedForAutoAssignment')),
    requiresHumanApproval: asBool(pick(o, 'requiresHumanApproval')),
    reasons: Array.isArray(reasons) ? reasons.filter((r): r is string => typeof r === 'string') : [],
  };
};

export const parseMatcherResult = (json: string | null): MatcherResult | null => {
  const o = parseObject(json);
  if (!o) return null;
  return {
    recommendedCollectorId: asString(pick(o, 'recommendedCollectorId')),
    autoAssign: asBool(pick(o, 'autoAssign')),
    ambiguous: asBool(pick(o, 'ambiguous')),
    reasoning: asString(pick(o, 'reasoning')),
  };
};

export const parsePlanInfo = (json: string | null): PlanInfo | null => {
  const o = parseObject(json);
  if (!o) return null;
  return { skipMatcher: asBool(pick(o, 'skipMatcher')), reasoning: asString(pick(o, 'reasoning')) };
};
