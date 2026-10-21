import {
  addPart,
  closeWorkOrder,
  createWorkOrderFromAlert,
  logReading,
  registerEquipment,
  updateWorkOrder,
} from '../../data/commands';
import { buildSeedData } from '../../data/seedData';
import { scoreBreach } from '../../domain/priority';

const now = new Date('2026-10-21T12:00:00.000Z');
const engineer = { id: 1, role: 'engineer' };
const operator = { id: 3, role: 'operator' };
const engineerContext = { now, actor: engineer };
const operatorContext = { now, actor: operator };

describe('seed data', () => {
  test('links every breach to its alert and keeps machine status aligned to active parameter breaches', () => {
    const state = buildSeedData(now);

    state.breaches.forEach((breach) => {
      expect(state.alerts.find((alert) => alert.id === breach.alertId)).toBeTruthy();
    });
    state.equipment.forEach((equipment) => {
      const hasBreach = state.parameters.some(
        (parameter) =>
          parameter.equipmentId === equipment.id && parameter.isActive && parameter.inBreach
      );
      expect(equipment.status).toBe(hasBreach ? 'at_risk' : 'healthy');
    });
    state.alerts.forEach((alert) => {
      const equipment = state.equipment.find((item) => item.id === alert.equipmentId);
      expect(scoreBreach(alert.exceedanceRatio, equipment.criticality)).toEqual({
        priority: alert.priority,
        score: alert.priorityScore,
      });
    });
  });
});

describe('maintenance commands', () => {
  test('rejects a duplicate asset code and parameter name', () => {
    const state = buildSeedData(now);
    const duplicateAsset = registerEquipment(
      state,
      {
        assetCode: ' cnc-01 ',
        name: 'Duplicate mill',
        location: 'Bay A',
        equipmentType: 'CNC machine',
        criticality: 'high',
        parameters: [],
      },
      engineerContext
    );
    expect(duplicateAsset.error).toMatchObject({
      message: 'Asset code already exists',
      field: 'assetCode',
    });

    const duplicateParameter = registerEquipment(
      state,
      {
        assetCode: 'CNC-05',
        name: 'New mill',
        location: 'Bay C',
        equipmentType: 'CNC machine',
        criticality: 'medium',
        parameters: [
          { name: 'Temperature', kind: 'temperature', unit: 'C', threshold: 80 },
          { name: ' temperature ', kind: 'temperature', unit: 'C', threshold: 81 },
        ],
      },
      engineerContext
    );
    expect(duplicateParameter.error).toMatchObject({
      message: 'Parameter name already exists on this machine',
    });
  });

  test('appends a normal reading without an alert and preserves historical rows', () => {
    const state = buildSeedData(now);
    const result = logReading(state, { parameterId: 1, value: 80, note: 'At limit' }, engineerContext);

    expect(result.error).toBeUndefined();
    expect(result.result.reading).toMatchObject({
      value: 80,
      isBreach: false,
      loggedBy: engineer.id,
      loggedAt: now.toISOString(),
    });
    expect(result.result.alert).toBeNull();
    expect(result.state.readings).toHaveLength(state.readings.length + 1);
    expect(result.state.breaches).toEqual(state.breaches);
  });

  test('creates, aggregates, and never downgrades an active alert', () => {
    const state = buildSeedData(now);
    const first = logReading(state, { parameterId: 1, value: 95 }, engineerContext);

    expect(first.result.equipmentStatus).toBe('at_risk');
    expect(first.result.alert).toMatchObject({ priority: 'critical', breachCount: 1 });
    expect(first.state.breaches).toHaveLength(state.breaches.length + 1);

    const second = logReading(
      first.state,
      { parameterId: 1, value: 85 },
      { now: new Date('2026-10-21T13:00:00.000Z'), actor: engineer }
    );

    expect(second.result.alert).toMatchObject({ priority: 'critical', breachCount: 2 });
    expect(second.state.alerts.filter((alert) => alert.parameterId === 1)).toHaveLength(1);
  });

  test('allows an operator to log but never to create a work order', () => {
    const state = buildSeedData(now);
    const reading = logReading(state, { parameterId: 1, value: 75 }, operatorContext);
    expect(reading.error).toBeUndefined();

    const conversion = createWorkOrderFromAlert(state, { alertId: 3 }, operatorContext);
    expect(conversion.error).toMatchObject({ message: 'Not authorised' });
  });

  test('converts an alert once, validates editable fields, and locks a closed order', () => {
    const state = buildSeedData(now);
    const created = createWorkOrderFromAlert(state, { alertId: 3 }, engineerContext);

    expect(created.result).toMatchObject({ created: true });
    expect(created.result.workOrder).toMatchObject({
      woNumber: 'WO-000003',
      alertId: 3,
      equipmentId: 2,
      parameterId: 5,
      priority: 'high',
      assigneeId: engineer.id,
    });

    const repeated = createWorkOrderFromAlert(created.state, { alertId: 3 }, engineerContext);
    expect(repeated.result).toMatchObject({ created: false, workOrder: created.result.workOrder });

    const invalidAssignee = updateWorkOrder(
      created.state,
      { id: created.result.workOrder.id, patch: { assigneeId: 3 } },
      engineerContext
    );
    expect(invalidAssignee.error).toMatchObject({ field: 'assigneeId' });

    const invalidPart = addPart(
      created.state,
      { workOrderId: created.result.workOrder.id, input: { partName: 'Bearing', availability: 'maybe' } },
      engineerContext
    );
    expect(invalidPart.error).toMatchObject({ field: 'availability' });

    const closed = closeWorkOrder(
      state,
      {
        id: 2,
        payload: {
          resolutionNote: 'Replaced the oil filter',
          partsUsed: [{ partId: 2, quantityUsed: 1 }],
        },
      },
      engineerContext
    );
    expect(closed.result.workOrder.status).toBe('closed');
    expect(closed.state.alerts.find((alert) => alert.id === 2)).toMatchObject({ state: 'resolved' });
    expect(closed.state.equipment.find((equipment) => equipment.id === 3).lastServiceDate).toBe(
      '2026-10-21'
    );
    expect(
      updateWorkOrder(closed.state, { id: 2, patch: { status: 'open' } }, engineerContext).error
    ).toMatchObject({ message: 'Work order is closed' });
  });
});
