import { ACTIVE_ALERT_STATES } from '../domain/constants';
import { PRIORITY_RANK } from '../domain/priority';
import { isOverdue } from '../utils/dates';

const item = (items, id) => items.find((entry) => entry.id === Number(id)) || null;
const active = (alert) => ACTIVE_ALERT_STATES.includes(alert.state);

// PUBLIC_INTERFACE
export function engineers(state) {
  /** Return users eligible to receive a work order. */
  return state.users.filter((user) => user.role === 'engineer');
}

// PUBLIC_INTERFACE
export function equipmentSummaries(state) {
  /** Return active equipment enriched with active-alert summaries. */
  return state.equipment.filter((equipment) => equipment.isActive).map((equipment) => {
    const alerts = state.alerts.filter((alert) => alert.equipmentId === equipment.id && active(alert));
    return { ...equipment, activeAlertCount: alerts.length, highestActivePriority: alerts.sort((a, b) => b.priorityScore - a.priorityScore)[0]?.priority || null };
  });
}

// PUBLIC_INTERFACE
export function getEquipmentDetail(state, id) {
  /** Return one machine, its parameters, and active alerts. */
  const equipment = item(state.equipment, id);
  return equipment ? { equipment, parameters: state.parameters.filter((parameter) => parameter.equipmentId === equipment.id), activeAlerts: state.alerts.filter((alert) => alert.equipmentId === equipment.id && active(alert)) } : null;
}

// PUBLIC_INTERFACE
export function readingsForEquipment(state, equipmentId, parameterId = null) {
  /** Return a machine's readings newest first, optionally for one parameter. */
  return state.readings.filter((reading) => reading.equipmentId === Number(equipmentId) && (!parameterId || reading.parameterId === Number(parameterId))).map((reading) => ({ ...reading, parameter: item(state.parameters, reading.parameterId), loggedByName: item(state.users, reading.loggedBy)?.name || 'Unknown' })).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

// PUBLIC_INTERFACE
export function activeAlerts(state, { priority = '', states = ACTIVE_ALERT_STATES } = {}) {
  /** Return alert rows enriched with machine, parameter, and linked work order. */
  return state.alerts.filter((alert) => states.includes(alert.state) && (!priority || alert.priority === priority)).map((alert) => ({ ...alert, equipment: item(state.equipment, alert.equipmentId), parameter: item(state.parameters, alert.parameterId), workOrder: state.workOrders.find((order) => order.alertId === alert.id) || null })).sort((a, b) => b.priorityScore - a.priorityScore || b.lastBreachedAt.localeCompare(a.lastBreachedAt));
}

// PUBLIC_INTERFACE
export function workOrderSummaries(state, { status = '', priority = '' } = {}) {
  /** Return work orders enriched with display data and overdue state. */
  return state.workOrders.filter((order) => (!status || order.status === status) && (!priority || order.priority === priority)).map((order) => ({ ...order, equipment: item(state.equipment, order.equipmentId), assigneeName: item(state.users, order.assigneeId)?.name || 'Unassigned', overdue: isOverdue(order.dueDate, order.status, new Date()) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// PUBLIC_INTERFACE
export function getWorkOrderDetail(state, id) {
  /** Return an order and all of its linked domain entities. */
  const workOrder = item(state.workOrders, id);
  if (!workOrder) return null;
  return { workOrder, equipment: item(state.equipment, workOrder.equipmentId), parameter: item(state.parameters, workOrder.parameterId), alert: item(state.alerts, workOrder.alertId), parts: state.parts.filter((part) => part.workOrderId === workOrder.id), assigneeName: item(state.users, workOrder.assigneeId)?.name || 'Unassigned' };
}

// PUBLIC_INTERFACE
export function dashboardSummary(state) {
  /** Calculate dashboard counts, overdue orders, lead time, and top risks. */
  const activeAlerts = state.alerts.filter(active);
  const equipmentByStatus = { healthy: 0, at_risk: 0 };
  state.equipment.filter((equipment) => equipment.isActive).forEach((equipment) => { equipmentByStatus[equipment.status] += 1; });
  const alertsByPriority = { critical: 0, high: 0, medium: 0 };
  activeAlerts.forEach((alert) => { alertsByPriority[alert.priority] += 1; });
  const workOrdersByStatus = { open: 0, in_progress: 0, closed: 0 };
  state.workOrders.forEach((order) => { workOrdersByStatus[order.status] += 1; });
  const hours = state.workOrders.map((order) => {
    const alert = item(state.alerts, order.alertId);
    return alert ? (new Date(order.createdAt) - new Date(alert.firstBreachedAt)) / 3600000 : null;
  }).filter((value) => Number.isFinite(value));
  const topAtRisk = state.equipment.filter((equipment) => equipment.status === 'at_risk').map((equipment) => {
    const alerts = activeAlerts.filter((alert) => alert.equipmentId === equipment.id);
    return { equipment, activeAlertCount: alerts.length, highestActivePriority: alerts.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])[0]?.priority || 'medium' };
  }).slice(0, 5);
  return { equipmentByStatus, alertsByPriority, workOrdersByStatus, overdueCount: state.workOrders.filter((order) => isOverdue(order.dueDate, order.status, new Date())).length, avgHoursBreachToWorkOrder: hours.length ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10 : null, topAtRisk };
}
