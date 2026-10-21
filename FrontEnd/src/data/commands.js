import { ACTIVE_ALERT_STATES, AVAILABILITY, CRITICALITIES, KINDS } from '../domain/constants';
import { evaluateReading, limitTypeForKind } from '../domain/breachDetection';
import { scoreBreach } from '../domain/priority';
import { buildSuggestedAction } from '../domain/suggestedActions';
import { dueDateForPriority, formatWoNumber, validateClosure } from '../domain/workOrderRules';
import { can, NOT_AUTHORISED } from '../domain/permissions';
import { isValidYmd, toYmd } from '../utils/dates';

const fail = (message, field) => ({ error: field ? { message, field } : { message } });
const text = (value) => String(value ?? '').trim();
const numeric = (value) => value !== '' && value !== null && Number.isFinite(Number(value));
const replace = (items, id, item) => items.map((current) => (current.id === id ? item : current));
const allowed = (ctx, capability) => can(ctx?.actor?.role, capability) ? null : fail(NOT_AUTHORISED);
const statusFor = (parameters, equipmentId) => parameters.some((item) => item.equipmentId === equipmentId && item.isActive && item.inBreach) ? 'at_risk' : 'healthy';

function parameterInput(input, equipmentId, id) {
  const kind = input.kind;
  const limitType = limitTypeForKind(kind);
  return {
    id, equipmentId, name: text(input.name), kind, limitType, unit: text(input.unit),
    threshold: Number(input.threshold),
    baselineValue: limitType === 'service_interval' ? Number(input.baselineValue || 0) : 0,
    inBreach: false, lastValue: null, lastReadingAt: null, isActive: true,
  };
}
function validateParameter(input, fieldPrefix = '') {
  if (!text(input.name)) return fail('Parameter name is required', `${fieldPrefix}name`);
  if (!KINDS.includes(input.kind)) return fail('Select a parameter kind', `${fieldPrefix}kind`);
  if (!numeric(input.threshold) || Number(input.threshold) <= 0) return fail('Threshold must be greater than 0', `${fieldPrefix}threshold`);
  return null;
}

// PUBLIC_INTERFACE
export function registerEquipment(state, input = {}, ctx) {
  /** Register equipment and its initial parameters for an engineer. */
  const denied = allowed(ctx, 'manageEquipment');
  if (denied) return denied;
  for (const field of ['assetCode', 'name', 'location', 'equipmentType']) if (!text(input[field])) return fail('This field is required', field);
  if (!CRITICALITIES.includes(input.criticality)) return fail('Select a criticality', 'criticality');
  if (state.equipment.some((item) => item.assetCode.toLowerCase() === text(input.assetCode).toLowerCase())) return fail('Asset code already exists', 'assetCode');
  const definitions = Array.isArray(input.parameters) ? input.parameters : [];
  const names = new Set();
  for (let index = 0; index < definitions.length; index += 1) {
    const invalid = validateParameter(definitions[index], `parameters.${index}.`);
    if (invalid) return invalid;
    const name = text(definitions[index].name).toLowerCase();
    if (names.has(name)) return fail('Parameter name already exists on this machine', `parameters.${index}.name`);
    names.add(name);
  }
  const equipment = {
    id: state.nextId.equipment, assetCode: text(input.assetCode).toUpperCase(), name: text(input.name),
    location: text(input.location), equipmentType: text(input.equipmentType), criticality: input.criticality,
    status: 'healthy', lastServiceDate: input.lastServiceDate || null, isActive: true, createdAt: ctx.now.toISOString(),
  };
  const parameters = definitions.map((definition, index) => parameterInput(definition, equipment.id, state.nextId.parameter + index));
  return {
    state: { ...state, equipment: [...state.equipment, equipment], parameters: [...state.parameters, ...parameters], nextId: { ...state.nextId, equipment: equipment.id + 1, parameter: state.nextId.parameter + parameters.length } },
    result: { equipment, parameters },
  };
}

// PUBLIC_INTERFACE
export function updateEquipment(state, { id, patch = {} } = {}, ctx) {
  /** Update editable equipment fields while preserving immutable asset code. */
  const denied = allowed(ctx, 'manageEquipment');
  if (denied) return denied;
  const current = state.equipment.find((item) => item.id === Number(id));
  if (!current) return fail('Equipment not found');
  if (patch.assetCode !== undefined && text(patch.assetCode).toLowerCase() !== current.assetCode.toLowerCase()) return fail('Asset code cannot be changed', 'assetCode');
  if (patch.criticality !== undefined && !CRITICALITIES.includes(patch.criticality)) return fail('Select a criticality', 'criticality');
  const equipment = { ...current, ...patch, assetCode: current.assetCode };
  return { state: { ...state, equipment: replace(state.equipment, current.id, equipment) }, result: { equipment } };
}

// PUBLIC_INTERFACE
export function addParameter(state, { equipmentId, input = {} } = {}, ctx) {
  /** Add one parameter to an existing machine. */
  const denied = allowed(ctx, 'manageEquipment');
  if (denied) return denied;
  if (!state.equipment.some((item) => item.id === Number(equipmentId))) return fail('Equipment not found');
  const invalid = validateParameter(input);
  if (invalid) return invalid;
  if (state.parameters.some((item) => item.equipmentId === Number(equipmentId) && item.name.toLowerCase() === text(input.name).toLowerCase())) return fail('Parameter name already exists on this machine', 'name');
  const parameter = parameterInput(input, Number(equipmentId), state.nextId.parameter);
  return { state: { ...state, parameters: [...state.parameters, parameter], nextId: { ...state.nextId, parameter: parameter.id + 1 } }, result: { parameter } };
}

// PUBLIC_INTERFACE
export function updateParameter(state, { id, patch = {} } = {}, ctx) {
  /** Update an existing parameter while retaining its immutable kind. */
  const denied = allowed(ctx, 'manageEquipment');
  if (denied) return denied;
  const current = state.parameters.find((item) => item.id === Number(id));
  if (!current) return fail('Parameter not found');
  if (patch.kind !== undefined && patch.kind !== current.kind) return fail('Parameter kind cannot be changed', 'kind');
  const candidate = { ...current, ...patch, kind: current.kind };
  if (!text(candidate.name)) return fail('Parameter name is required', 'name');
  if (!numeric(candidate.threshold) || Number(candidate.threshold) <= 0) return fail('Threshold must be greater than 0', 'threshold');
  if (state.parameters.some((item) => item.id !== current.id && item.equipmentId === current.equipmentId && item.name.toLowerCase() === text(candidate.name).toLowerCase())) return fail('Parameter name already exists on this machine', 'name');
  candidate.threshold = Number(candidate.threshold);
  candidate.baselineValue = Number(candidate.baselineValue || 0);
  let parameters = replace(state.parameters, current.id, candidate);
  const equipment = replace(state.equipment, current.equipmentId, { ...state.equipment.find((item) => item.id === current.equipmentId), status: statusFor(parameters, current.equipmentId) });
  return { state: { ...state, parameters, equipment }, result: { parameter: candidate } };
}

// PUBLIC_INTERFACE
export function logReading(state, { parameterId, value, note = '' } = {}, ctx) {
  /** Append a timestamped reading and create or aggregate an alert on breach. */
  const denied = allowed(ctx, 'logReading');
  if (denied) return denied;
  const parameter = state.parameters.find((item) => item.id === Number(parameterId));
  const equipment = parameter && state.equipment.find((item) => item.id === parameter.equipmentId);
  if (!parameter) return fail('Parameter not found', 'parameterId');
  if (!equipment || !parameter.isActive || !equipment.isActive) return fail('Machine or parameter is inactive', 'parameterId');
  if (!numeric(value)) return fail('Enter a numeric value', 'value');
  const evaluation = evaluateReading({ ...parameter, value: Number(value) });
  if (evaluation.error) return fail(evaluation.error, 'value');
  const now = ctx.now.toISOString();
  const reading = { id: state.nextId.reading, equipmentId: equipment.id, parameterId: parameter.id, value: Number(value), effectiveValue: evaluation.effectiveValue, thresholdAtReading: parameter.threshold, isBreach: evaluation.isBreach, note: text(note), loggedBy: ctx.actor.id, loggedAt: now };
  let parameters = replace(state.parameters, parameter.id, { ...parameter, lastValue: reading.value, lastReadingAt: now, inBreach: parameter.inBreach || evaluation.isBreach });
  let alerts = state.alerts;
  let workOrders = state.workOrders;
  let breaches = state.breaches;
  const nextId = { ...state.nextId, reading: reading.id + 1 };
  let alert = null;
  let breach = null;
  if (evaluation.isBreach) {
    const score = scoreBreach(evaluation.exceedanceRatio, equipment.criticality);
    const existing = alerts.find((item) => item.parameterId === parameter.id && ACTIVE_ALERT_STATES.includes(item.state));
    if (existing) {
      const escalate = score.score > existing.priorityScore;
      alert = { ...existing, currentValue: evaluation.effectiveValue, exceedanceRatio: evaluation.exceedanceRatio, lastBreachedAt: now, breachCount: existing.breachCount + 1, ...(escalate ? { priority: score.priority, priorityScore: score.score, suggestedAction: buildSuggestedAction(parameter.kind, score.priority) } : {}) };
      alerts = replace(alerts, existing.id, alert);
      if (escalate) workOrders = workOrders.map((item) => item.alertId === alert.id && item.status !== 'closed' ? { ...item, priority: alert.priority } : item);
    } else {
      alert = { id: nextId.alert, equipmentId: equipment.id, parameterId: parameter.id, currentValue: evaluation.effectiveValue, safeValue: parameter.threshold, unit: parameter.unit, exceedanceRatio: evaluation.exceedanceRatio, priority: score.priority, priorityScore: score.score, suggestedAction: buildSuggestedAction(parameter.kind, score.priority), state: 'open', breachCount: 1, firstBreachedAt: now, lastBreachedAt: now, resolvedAt: null };
      alerts = [...alerts, alert];
      nextId.alert += 1;
    }
    breach = { id: nextId.breach, readingId: reading.id, alertId: alert.id, equipmentId: equipment.id, parameterId: parameter.id, measuredValue: reading.value, effectiveValue: reading.effectiveValue, safeValue: parameter.threshold, exceedanceRatio: evaluation.exceedanceRatio, detectedAt: now };
    breaches = [...breaches, breach];
    nextId.breach += 1;
  }
  const equipmentNext = { ...equipment, status: statusFor(parameters, equipment.id) };
  return { state: { ...state, readings: [...state.readings, reading], parameters, equipment: replace(state.equipment, equipment.id, equipmentNext), alerts, workOrders, breaches, nextId }, result: { reading, breach, alert, equipmentStatus: equipmentNext.status } };
}

// PUBLIC_INTERFACE
export function createWorkOrderFromAlert(state, { alertId } = {}, ctx) {
  /** Idempotently create a work order from an active alert. */
  const denied = allowed(ctx, 'manageWorkOrders');
  if (denied) return denied;
  const alert = state.alerts.find((item) => item.id === Number(alertId));
  if (!alert) return fail('Alert not found');
  const existing = state.workOrders.find((item) => item.alertId === alert.id);
  if (existing) return { state, result: { workOrder: existing, created: false } };
  if (alert.state === 'resolved') return fail('Alert is already resolved');
  const parameter = state.parameters.find((item) => item.id === alert.parameterId);
  const equipment = state.equipment.find((item) => item.id === alert.equipmentId);
  const workOrder = { id: state.nextId.workOrder, woNumber: formatWoNumber(state.nextId.workOrder), alertId: alert.id, equipmentId: equipment.id, parameterId: parameter.id, faultDescription: `${parameter.name} reading ${alert.currentValue} ${parameter.unit} exceeds safe ${alert.safeValue} ${parameter.unit} on ${equipment.assetCode}. Breaches recorded: ${alert.breachCount}. Suggested action: ${alert.suggestedAction}`, priority: alert.priority, assigneeId: ctx.actor.id, dueDate: dueDateForPriority(alert.priority, ctx.now), status: 'open', resolutionNote: '', noPartsUsed: false, createdBy: ctx.actor.id, createdAt: ctx.now.toISOString(), closedBy: null, closedAt: null };
  return { state: { ...state, alerts: replace(state.alerts, alert.id, { ...alert, state: 'in_progress' }), workOrders: [...state.workOrders, workOrder], nextId: { ...state.nextId, workOrder: workOrder.id + 1 } }, result: { workOrder, created: true } };
}

function mutableWorkOrder(state, id, ctx) {
  const denied = allowed(ctx, 'manageWorkOrders');
  if (denied) return denied;
  const workOrder = state.workOrders.find((item) => item.id === Number(id));
  if (!workOrder) return fail('Work order not found');
  return workOrder.status === 'closed' ? fail('Work order is closed') : { workOrder };
}

// PUBLIC_INTERFACE
export function updateWorkOrder(state, { id, patch = {} } = {}, ctx) {
  /** Update assignee, due date, status, or fault description on an open order. */
  const loaded = mutableWorkOrder(state, id, ctx);
  if (loaded.error) return loaded;
  if (patch.assigneeId !== undefined && !state.users.some((item) => item.id === Number(patch.assigneeId) && item.role === 'engineer')) return fail('Assignee must be an engineer', 'assigneeId');
  if (patch.dueDate !== undefined && !isValidYmd(patch.dueDate)) return fail('Enter a valid due date', 'dueDate');
  if (patch.status !== undefined && !['open', 'in_progress'].includes(patch.status)) return fail('Status must be open or in progress', 'status');
  const workOrder = { ...loaded.workOrder, ...patch, assigneeId: patch.assigneeId === undefined ? loaded.workOrder.assigneeId : Number(patch.assigneeId) };
  return { state: { ...state, workOrders: replace(state.workOrders, workOrder.id, workOrder) }, result: { workOrder } };
}

// PUBLIC_INTERFACE
export function addPart(state, { workOrderId, input = {} } = {}, ctx) {
  /** Add a checklist part to an open work order. */
  const loaded = mutableWorkOrder(state, workOrderId, ctx);
  if (loaded.error) return loaded;
  if (!text(input.partName)) return fail('Part name is required', 'partName');
  if (!AVAILABILITY.includes(input.availability)) return fail('Availability must be yes, no or ordered', 'availability');
  const part = { id: state.nextId.part, workOrderId: Number(workOrderId), partName: text(input.partName), partNumber: text(input.partNumber), quantityRequired: Number(input.quantityRequired || 1), availability: input.availability, notes: text(input.notes), quantityUsed: 0 };
  return { state: { ...state, parts: [...state.parts, part], nextId: { ...state.nextId, part: part.id + 1 } }, result: { part } };
}

// PUBLIC_INTERFACE
export function updatePart(state, { workOrderId, partId, patch = {} } = {}, ctx) {
  /** Update an existing checklist part on an open work order. */
  const loaded = mutableWorkOrder(state, workOrderId, ctx);
  if (loaded.error) return loaded;
  const current = state.parts.find((item) => item.id === Number(partId) && item.workOrderId === Number(workOrderId));
  if (!current) return fail('Part not found');
  if (patch.availability !== undefined && !AVAILABILITY.includes(patch.availability)) return fail('Availability must be yes, no or ordered', 'availability');
  const part = { ...current, ...patch };
  return { state: { ...state, parts: replace(state.parts, part.id, part) }, result: { part } };
}

// PUBLIC_INTERFACE
export function removePart(state, { workOrderId, partId } = {}, ctx) {
  /** Remove an open work-order checklist part. */
  const loaded = mutableWorkOrder(state, workOrderId, ctx);
  if (loaded.error) return loaded;
  return { state: { ...state, parts: state.parts.filter((item) => item.id !== Number(partId)) }, result: { partId: Number(partId) } };
}

// PUBLIC_INTERFACE
export function closeWorkOrder(state, { id, payload = {} } = {}, ctx) {
  /** Close a work order, resolve its alert, and reset its serviced parameter. */
  const loaded = mutableWorkOrder(state, id, ctx);
  if (loaded.error) return loaded;
  const parts = state.parts.filter((item) => item.workOrderId === loaded.workOrder.id);
  const parameter = state.parameters.find((item) => item.id === loaded.workOrder.parameterId);
  const invalid = validateClosure(loaded.workOrder, parts, payload, parameter);
  if (invalid) return { error: invalid };
  const used = new Map((payload.partsUsed || []).map((item) => [Number(item.partId), Number(item.quantityUsed || 0)]));
  const nextParts = state.parts.map((item) => used.has(item.id) ? { ...item, quantityUsed: used.get(item.id) } : item);
  const resetParameter = { ...parameter, inBreach: false, baselineValue: parameter.limitType === 'service_interval' ? Number(payload.meterReadingAtService || parameter.lastValue || parameter.baselineValue) : parameter.baselineValue };
  const equipment = state.equipment.find((item) => item.id === loaded.workOrder.equipmentId);
  const parameters = replace(state.parameters, parameter.id, resetParameter);
  const workOrder = { ...loaded.workOrder, status: 'closed', resolutionNote: text(payload.resolutionNote), noPartsUsed: payload.noPartsUsed === true, closedBy: ctx.actor.id, closedAt: ctx.now.toISOString() };
  const refreshedEquipment = { ...equipment, lastServiceDate: toYmd(ctx.now), status: statusFor(parameters, equipment.id) };
  return { state: { ...state, parts: nextParts, parameters, equipment: replace(state.equipment, equipment.id, refreshedEquipment), alerts: replace(state.alerts, workOrder.alertId, { ...state.alerts.find((item) => item.id === workOrder.alertId), state: 'resolved', resolvedAt: ctx.now.toISOString() }), workOrders: replace(state.workOrders, workOrder.id, workOrder) }, result: { workOrder } };
}
