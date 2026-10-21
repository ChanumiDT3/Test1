import { evaluateReading } from '../../domain/breachDetection';
import { scoreBreach, severityForRatio } from '../../domain/priority';
import { dueDateForPriority, validateClosure } from '../../domain/workOrderRules';

describe('DEC-05 breach detection', () => {
  test('treats equality as safe and reports a maximum-limit breach only above the threshold', () => {
    expect(evaluateReading({ limitType: 'max_limit', threshold: 80, value: 80 })).toEqual({
      effectiveValue: 80,
      isBreach: false,
      exceedanceRatio: 0,
    });
    expect(evaluateReading({ limitType: 'max_limit', threshold: 80, value: 95 })).toEqual({
      effectiveValue: 95,
      isBreach: true,
      exceedanceRatio: 0.1875,
    });
  });

  test('uses a service baseline and rejects readings below it', () => {
    expect(
      evaluateReading({
        limitType: 'service_interval',
        threshold: 500,
        baselineValue: 12000,
        value: 12500,
      })
    ).toEqual({ effectiveValue: 500, isBreach: false, exceedanceRatio: 0 });
    expect(
      evaluateReading({
        limitType: 'service_interval',
        threshold: 500,
        baselineValue: 12000,
        value: 11999,
      })
    ).toEqual({ error: 'Reading is below the last service meter value' });
  });
});

describe('DEC-06 priority scoring', () => {
  test.each([
    [0.05, 'low', 'medium', 1],
    [0.05, 'medium', 'medium', 2],
    [0.05, 'high', 'high', 3],
    [0.1, 'low', 'medium', 2],
    [0.1, 'medium', 'high', 4],
    [0.1, 'high', 'critical', 6],
    [0.25, 'low', 'high', 3],
    [0.25, 'medium', 'critical', 6],
    [0.25, 'high', 'critical', 9],
  ])('maps ratio %s and %s criticality to %s/%s', (ratio, criticality, priority, score) => {
    expect(scoreBreach(ratio, criticality)).toEqual({ priority, score });
  });

  test('honours the 0.10 and 0.25 severity edges exactly', () => {
    expect(severityForRatio(0.099999)).toBe(1);
    expect(severityForRatio(0.1)).toBe(2);
    expect(severityForRatio(0.249999)).toBe(2);
    expect(severityForRatio(0.25)).toBe(3);
  });
});

describe('DEC-09 and DEC-10 work-order rules', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const openOrder = { id: 8, status: 'open' };
  const parts = [{ id: 2, workOrderId: 8, quantityUsed: 0 }];
  const serviceParameter = { limitType: 'service_interval', baselineValue: 12000 };

  test('derives due dates from the alert priority', () => {
    expect(dueDateForPriority('critical', now)).toBe('2026-10-22');
    expect(dueDateForPriority('high', now)).toBe('2026-10-24');
    expect(dueDateForPriority('medium', now)).toBe('2026-10-28');
  });

  test('requires a resolution and used parts or an explicit no-parts declaration', () => {
    expect(validateClosure(openOrder, parts, {}, serviceParameter)).toMatchObject({
      field: 'resolutionNote',
    });
    expect(
      validateClosure(openOrder, parts, { resolutionNote: 'Replaced the bearing' }, serviceParameter)
    ).toMatchObject({ field: 'parts' });
    expect(
      validateClosure(
        openOrder,
        parts,
        { resolutionNote: 'Inspected and lubricated', noPartsUsed: true },
        serviceParameter
      )
    ).toBeNull();
  });

  test('rejects a service reset below the prior baseline', () => {
    expect(
      validateClosure(
        openOrder,
        parts,
        {
          resolutionNote: 'Replaced the bearing',
          noPartsUsed: true,
          meterReadingAtService: 11999,
        },
        serviceParameter
      )
    ).toMatchObject({ field: 'meterReadingAtService' });
  });
});
