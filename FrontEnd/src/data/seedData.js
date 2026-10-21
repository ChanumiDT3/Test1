import { limitTypeForKind, evaluateReading } from '../domain/breachDetection';
import { scoreBreach } from '../domain/priority';
import { buildSuggestedAction } from '../domain/suggestedActions';
import { daysAgo, hoursAgo, toYmd } from '../utils/dates';

// PUBLIC_INTERFACE
export const USERS = [
  { id: 1, name: 'Erin Engineer', role: 'engineer' },
  { id: 2, name: 'Sam Engineer', role: 'engineer' },
  { id: 3, name: 'Olu Operator', role: 'operator' },
  { id: 4, name: 'Maya Manager', role: 'manager' },
];

const parameter = (id, equipmentId, name, kind, unit, threshold, baselineValue = 0, lastValue = null) => ({
  id,
  equipmentId,
  name,
  kind,
  unit,
  threshold,
  baselineValue,
  limitType: limitTypeForKind(kind),
  inBreach: false,
  lastValue,
  lastReadingAt: null,
  isActive: true,
});

// PUBLIC_INTERFACE
export function buildSeedData(now = new Date()) {
  /** Build the complete, resettable in-memory demonstration state. */
  const equipment = [
    { id: 1, assetCode: 'CNC-01', name: '5-Axis CNC Mill', location: 'Bay A', equipmentType: 'CNC machine', criticality: 'high', status: 'healthy', lastServiceDate: toYmd(daysAgo(now, 30)), isActive: true, createdAt: daysAgo(now, 400).toISOString() },
    { id: 2, assetCode: 'CONV-02', name: 'Assembly Conveyor', location: 'Line 1', equipmentType: 'Conveyor', criticality: 'medium', status: 'at_risk', lastServiceDate: toYmd(daysAgo(now, 60)), isActive: true, createdAt: daysAgo(now, 380).toISOString() },
    { id: 3, assetCode: 'PRESS-03', name: 'Hydraulic Press 200T', location: 'Bay B', equipmentType: 'Press', criticality: 'high', status: 'at_risk', lastServiceDate: toYmd(daysAgo(now, 45)), isActive: true, createdAt: daysAgo(now, 360).toISOString() },
    { id: 4, assetCode: 'COMP-04', name: 'Screw Air Compressor', location: 'Utility room', equipmentType: 'Compressor', criticality: 'low', status: 'healthy', lastServiceDate: toYmd(daysAgo(now, 10)), isActive: true, createdAt: daysAgo(now, 300).toISOString() },
  ];
  const parameters = [
    parameter(1, 1, 'Spindle temperature', 'temperature', 'C', 80, 0, 72),
    parameter(2, 1, 'Spindle vibration', 'vibration', 'mm/s', 7.1, 0, 4.1),
    parameter(3, 1, 'Runtime hours', 'runtime_hours', 'h', 500, 12000, 12340),
    parameter(4, 2, 'Motor temperature', 'temperature', 'C', 75, 0, 63),
    parameter(5, 2, 'Drive vibration', 'vibration', 'mm/s', 4.5, 0, 5.2),
    parameter(6, 2, 'Runtime hours', 'runtime_hours', 'h', 1000, 30000, 30420),
    parameter(7, 3, 'Hydraulic oil temperature', 'temperature', 'C', 60, 0, 66),
    parameter(8, 3, 'Hydraulic pressure', 'pressure', 'bar', 210, 0, 192),
    parameter(9, 3, 'Stroke count', 'cycle_count', 'cycles', 50000, 1200000, 1231500),
    parameter(10, 4, 'Discharge temperature', 'temperature', 'C', 100, 0, 88),
    parameter(11, 4, 'Vibration', 'vibration', 'mm/s', 6, 0, 2.6),
    parameter(12, 4, 'Runtime hours', 'runtime_hours', 'h', 2000, 8000, 8650),
  ];

  const readingRows = [
    [1, 1, 68, 6 * 24, 3], [1, 1, 72, 20, 1],
    [1, 2, 3.8, 5 * 24, 3], [1, 2, 4.1, 26, 1],
    [1, 3, 12290, 5 * 24, 3], [1, 3, 12340, 24, 3],
    [2, 4, 61, 6 * 24, 3], [2, 4, 63, 2 * 24, 3],
    [2, 5, 4.2, 3 * 24, 3], [2, 5, 4.9, 2 * 24, 3], [2, 5, 5.2, 6, 1],
    [2, 6, 30380, 4 * 24, 3], [2, 6, 30420, 30, 3],
    [3, 7, 55, 6 * 24, 3], [3, 7, 58, 5 * 24, 3], [3, 7, 66, 76, 3],
    [3, 8, 188, 6 * 24, 3], [3, 8, 192, 2 * 24, 1],
    [3, 9, 1229000, 4 * 24, 3], [3, 9, 1231500, 28, 3],
    [4, 10, 108, 12 * 24, 3], [4, 10, 86, 5 * 24, 3], [4, 10, 88, 26, 3],
    [4, 11, 2.4, 6 * 24, 3], [4, 11, 2.6, 2 * 24, 3],
    [4, 12, 8600, 4 * 24, 3], [4, 12, 8650, 25, 3],
  ];
  const readings = readingRows
    .sort((a, b) => b[3] - a[3])
    .map(([equipmentId, parameterId, value, ageHours, loggedBy], index) => {
      const p = parameters.find((item) => item.id === parameterId);
      const result = evaluateReading({ ...p, value });
      return {
        id: index + 1, equipmentId, parameterId, value, effectiveValue: result.effectiveValue,
        thresholdAtReading: p.threshold, isBreach: result.isBreach, note: '', loggedBy,
        loggedAt: hoursAgo(now, ageHours).toISOString(),
      };
    });

  const openVibration = readings.filter((item) => item.parameterId === 5 && item.isBreach);
  const pressBreach = readings.find((item) => item.parameterId === 7 && item.isBreach);
  const compressorBreach = readings.find((item) => item.parameterId === 10 && item.isBreach);
  parameters.find((item) => item.id === 5).inBreach = true;
  parameters.find((item) => item.id === 7).inBreach = true;
  const makeAlert = (id, equipmentId, p, breachRows, state) => {
    const latest = breachRows[breachRows.length - 1];
    const ratio = (latest.effectiveValue - p.threshold) / p.threshold;
    const score = scoreBreach(ratio, equipment.find((item) => item.id === equipmentId).criticality);
    return {
      id, equipmentId, parameterId: p.id, currentValue: latest.effectiveValue, safeValue: p.threshold,
      unit: p.unit, exceedanceRatio: ratio, priority: score.priority, priorityScore: score.score,
      suggestedAction: buildSuggestedAction(p.kind, score.priority), state, breachCount: breachRows.length,
      firstBreachedAt: breachRows[0].loggedAt, lastBreachedAt: latest.loggedAt,
      resolvedAt: state === 'resolved' ? daysAgo(now, 10).toISOString() : null,
    };
  };
  const alerts = [
    makeAlert(1, 4, parameters.find((item) => item.id === 10), [compressorBreach], 'resolved'),
    makeAlert(2, 3, parameters.find((item) => item.id === 7), [pressBreach], 'in_progress'),
    makeAlert(3, 2, parameters.find((item) => item.id === 5), openVibration, 'open'),
  ];
  const breaches = [
    ...openVibration.map((item, index) => ({ id: index + 1, readingId: item.id, alertId: 3, equipmentId: 2, parameterId: 5, measuredValue: item.value, effectiveValue: item.effectiveValue, safeValue: 4.5, exceedanceRatio: (item.effectiveValue - 4.5) / 4.5, detectedAt: item.loggedAt })),
    { id: 3, readingId: pressBreach.id, alertId: 2, equipmentId: 3, parameterId: 7, measuredValue: 66, effectiveValue: 66, safeValue: 60, exceedanceRatio: 0.1, detectedAt: pressBreach.loggedAt },
    { id: 4, readingId: compressorBreach.id, alertId: 1, equipmentId: 4, parameterId: 10, measuredValue: 108, effectiveValue: 108, safeValue: 100, exceedanceRatio: 0.08, detectedAt: compressorBreach.loggedAt },
  ];
  const workOrders = [
    { id: 1, woNumber: 'WO-000001', alertId: 1, equipmentId: 4, parameterId: 10, faultDescription: 'Discharge temperature was above its safe limit.', priority: 'medium', assigneeId: 1, dueDate: toYmd(daysAgo(now, 5)), status: 'closed', resolutionNote: 'Cleaned cooler fins and replaced thermostatic valve', noPartsUsed: false, createdBy: 1, createdAt: daysAgo(now, 11).toISOString(), closedBy: 1, closedAt: daysAgo(now, 10).toISOString() },
    { id: 2, woNumber: 'WO-000002', alertId: 2, equipmentId: 3, parameterId: 7, faultDescription: 'Hydraulic oil temperature reading 66 C exceeds safe limit 60 C.', priority: 'critical', assigneeId: 2, dueDate: toYmd(daysAgo(now, 2)), status: 'in_progress', resolutionNote: '', noPartsUsed: false, createdBy: 1, createdAt: daysAgo(now, 3).toISOString(), closedBy: null, closedAt: null },
  ];
  const parts = [
    { id: 1, workOrderId: 1, partName: 'Thermostatic valve', partNumber: 'TV-220', quantityRequired: 1, availability: 'yes', notes: '', quantityUsed: 1 },
    { id: 2, workOrderId: 2, partName: 'Hydraulic oil filter', partNumber: 'HF-410', quantityRequired: 1, availability: 'yes', notes: '', quantityUsed: 0 },
    { id: 3, workOrderId: 2, partName: 'Pump seal kit', partNumber: 'PSK-75', quantityRequired: 1, availability: 'ordered', notes: 'ETA 2 days', quantityUsed: 0 },
  ];
  return {
    users: USERS.map((user) => ({ ...user })), equipment, parameters, readings, breaches, alerts, workOrders, parts,
    nextId: { equipment: 5, parameter: 13, reading: readings.length + 1, breach: 5, alert: 4, workOrder: 3, part: 4 },
  };
}
