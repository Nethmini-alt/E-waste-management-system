// TC-C-R01 — display helpers used on every Processing screen.
import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatKg, formatMoney, formatSignedKg, shortId } from '../utils/format';

describe('TC-C-R01 format helpers', () => {
  it('formats money in rupees with two decimals and thousands separators', () => {
    expect(formatMoney(482.5)).toBe('Rs. 482.50');
    expect(formatMoney(150000)).toBe('Rs. 150,000.00');
    expect(formatMoney(0)).toBe('Rs. 0.00');
  });

  it('formats weights with up to two decimals', () => {
    expect(formatKg(11.5)).toBe('11.5 kg');
    expect(formatKg(2)).toBe('2 kg');
    expect(formatKg(0.005)).toBe('0.01 kg'); // rounded to 0.01 kg
    expect(formatKg(1234.567)).toBe('1,234.57 kg');
  });

  it('shows a + sign only for positive discrepancies', () => {
    expect(formatSignedKg(0.3)).toBe('+0.3 kg');
    expect(formatSignedKg(-0.3)).toBe('-0.3 kg');
    expect(formatSignedKg(0)).toBe('0 kg');
  });

  it('shortens ids and shows a dash when there is no id', () => {
    expect(shortId('3fa85f64-5717-4562-b3fc-2c963f66afa6')).toBe('3fa85f64…');
    expect(shortId(null)).toBe('—');
    expect(shortId(undefined)).toBe('—');
    expect(shortId('')).toBe('—');
  });

  it('shows a dash for missing or invalid dates instead of "Invalid Date"', () => {
    for (const bad of [null, undefined, '', 'not-a-date']) {
      expect(formatDate(bad)).toBe('—');
      expect(formatDateTime(bad)).toBe('—');
    }
  });

  it('treats an API timestamp without a time zone as UTC', () => {
    // ASP.NET can send "2026-10-08T00:30:00" (no Z). It must read as the same moment as the "Z" form.
    expect(formatDateTime('2026-10-08T00:30:00')).toBe(formatDateTime('2026-10-08T00:30:00Z'));
    expect(formatDate('2026-10-08T00:30:00')).toBe(formatDate('2026-10-08T00:30:00Z'));
  });
});
