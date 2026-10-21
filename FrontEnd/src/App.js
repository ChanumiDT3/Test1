import React, { useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { MaintenanceDataProvider, useMaintenance } from './data/MaintenanceDataContext';
import { SessionProvider, useSession } from './session/SessionContext';
import { RequireCapability } from './session/RequireCapability';
import { KINDS } from './domain/constants';
import { roleHome } from './domain/permissions';
import { formatDate, formatDateTime, formatValue, titleCase } from './utils/format';
import { PriorityBadge } from './components/PriorityBadge';
import { StatusBadge } from './components/StatusBadge';

const Nav = ({ to, children, capability }) => {
  const { can } = useSession();
  return !capability || can(capability) ? <Link to={to}>{children}</Link> : null;
};

function Layout({ children }) {
  const { user, users, setUserId } = useSession();
  const { actions } = useMaintenance();
  const navigate = useNavigate();
  const switchUser = (event) => {
    const selected = users.find((entry) => entry.id === Number(event.target.value));
    setUserId(selected.id);
    navigate(roleHome(selected.role));
  };
  return <div className="app-shell">
    <aside className="sidebar"><h1>Predictive<br />Maintenance</h1><p className="muted">Signal → alert → action</p>
      <nav aria-label="Main navigation"><Nav to="/dashboard" capability="viewDashboard">Dashboard</Nav><Nav to="/equipment" capability="viewEquipment">Equipment</Nav><Nav to="/log-reading" capability="logReading">Log reading</Nav><Nav to="/alerts" capability="viewAlerts">Alert queue</Nav><Nav to="/work-orders" capability="viewWorkOrders">Work orders</Nav></nav>
    </aside>
    <main><header className="topbar"><div><strong>Acting as</strong><select value={user.id} onChange={switchUser} aria-label="Acting as">{users.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} — {titleCase(entry.role)}</option>)}</select></div><button className="button button-secondary" onClick={() => { actions.resetDemoData(); navigate(roleHome(user.role)); }}>Reset demo data</button></header>{children}</main>
  </div>;
}

function Page({ title, children, action }) {
  return <section className="page"><div className="page-heading"><div><h2>{title}</h2></div>{action}</div>{children}</section>;
}

function Dashboard() {
  const { select } = useMaintenance();
  const summary = select.dashboardSummary();
  return <Page title="Maintenance dashboard"><div className="metrics"><Metric label="Healthy equipment" value={summary.equipmentByStatus.healthy} /><Metric label="At risk" value={summary.equipmentByStatus.at_risk} tone="danger" /><Metric label="Critical alerts" value={summary.alertsByPriority.critical} tone="danger" /><Metric label="High alerts" value={summary.alertsByPriority.high} tone="warning" /><Metric label="Overdue work orders" value={summary.overdueCount} tone="danger" /><Metric label="Avg. breach to order" value={summary.avgHoursBreachToWorkOrder === null ? '—' : `${summary.avgHoursBreachToWorkOrder} h`} /></div><h3>Top at-risk machines</h3><Table headers={['Machine', 'Open alerts', 'Highest priority']}>{summary.topAtRisk.map((entry) => <tr key={entry.equipment.id}><td><Link to={`/equipment/${entry.equipment.id}`}>{entry.equipment.assetCode} — {entry.equipment.name}</Link></td><td>{entry.activeAlertCount}</td><td><PriorityBadge priority={entry.highestActivePriority} /></td></tr>)}</Table></Page>;
}
const Metric = ({ label, value, tone = '' }) => <article aria-label={label} className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong></article>;
const Table = ({ headers, children }) => <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;

function EquipmentList() {
  const { select } = useMaintenance();
  const { can } = useSession();
  const [search, setSearch] = useState('');
  const equipment = select.equipmentSummaries().filter((entry) => `${entry.assetCode} ${entry.name} ${entry.location}`.toLowerCase().includes(search.toLowerCase()));
  return <Page title="Equipment register" action={can('manageEquipment') && <Link className="button" to="/equipment/new">Register equipment</Link>}><input aria-label="Search equipment" placeholder="Search equipment" value={search} onChange={(event) => setSearch(event.target.value)} /><Table headers={['Asset code', 'Name', 'Location', 'Type', 'Criticality', 'Status', 'Alerts']} >{equipment.map((entry) => <tr key={entry.id}><td><Link to={`/equipment/${entry.id}`}>{entry.assetCode}</Link></td><td>{entry.name}</td><td>{entry.location}</td><td>{entry.equipmentType}</td><td>{titleCase(entry.criticality)}</td><td><StatusBadge status={entry.status} /></td><td>{entry.activeAlertCount}</td></tr>)}</Table></Page>;
}

function EquipmentForm() {
  const { id } = useParams();
  const { actions, select } = useMaintenance();
  const navigate = useNavigate();
  const existing = id ? select.getEquipmentDetail(id)?.equipment : null;
  const [form, setForm] = useState(existing ? { ...existing } : { assetCode: '', name: '', location: '', equipmentType: '', criticality: 'medium', parameters: [{ name: '', kind: 'temperature', unit: '', threshold: '', baselineValue: '' }] });
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = (event) => {
    event.preventDefault();
    const result = existing ? actions.updateEquipment(existing.id, form) : actions.registerEquipment(form);
    if (!result.ok) { setError(result.error.message); return; }
    navigate(`/equipment/${result.result.equipment.id}`);
  };
  const addParameter = () => setForm((current) => ({ ...current, parameters: [...current.parameters, { name: '', kind: 'temperature', unit: '', threshold: '', baselineValue: '' }] }));
  return <Page title={existing ? `Edit ${existing.assetCode}` : 'Register equipment'}><form onSubmit={save} className="form-grid"><label>Asset code<input required disabled={Boolean(existing)} value={form.assetCode} onChange={(event) => update('assetCode', event.target.value)} /></label><label>Name<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label><label>Location<input required value={form.location} onChange={(event) => update('location', event.target.value)} /></label><label>Equipment type<input required list="types" value={form.equipmentType} onChange={(event) => update('equipmentType', event.target.value)} /><datalist id="types"><option>CNC machine</option><option>Conveyor</option><option>Press</option><option>Compressor</option></datalist></label><label>Criticality<select value={form.criticality} onChange={(event) => update('criticality', event.target.value)}>{['low', 'medium', 'high'].map((value) => <option key={value}>{value}</option>)}</select></label>{!existing && <><div className="form-section"><h3>Health parameters</h3>{form.parameters.map((parameter, index) => <div className="parameter-row" key={index}><input required placeholder="Name" value={parameter.name} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry) }))} /><select value={parameter.kind} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((entry, i) => i === index ? { ...entry, kind: event.target.value } : entry) }))}>{KINDS.map((kind) => <option key={kind} value={kind}>{titleCase(kind)}</option>)}</select><input placeholder="Unit" value={parameter.unit} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((entry, i) => i === index ? { ...entry, unit: event.target.value } : entry) }))} /><input required type="number" placeholder="Threshold" value={parameter.threshold} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((entry, i) => i === index ? { ...entry, threshold: event.target.value } : entry) }))} /></div>)}<button type="button" className="button button-secondary" onClick={addParameter}>Add parameter</button></div></>} {error && <p className="banner error">{error}</p>}<button className="button" type="submit">Save equipment</button></form></Page>;
}

function ReadingForm({ equipmentId: initialEquipmentId }) {
  const { state, actions } = useMaintenance();
  const activeEquipment = state.equipment.filter((equipment) => equipment.isActive);
  const [equipmentId, setEquipmentId] = useState(Number(initialEquipmentId) || activeEquipment[0]?.id || '');
  const parameters = state.parameters.filter((parameter) => parameter.equipmentId === Number(equipmentId) && parameter.isActive);
  const [parameterId, setParameterId] = useState(parameters[0]?.id || '');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState(null);
  const changeEquipment = (event) => { const next = Number(event.target.value); setEquipmentId(next); setParameterId(state.parameters.find((parameter) => parameter.equipmentId === next && parameter.isActive)?.id || ''); };
  const submit = (event) => { event.preventDefault(); const result = actions.logReading({ parameterId, value, note }); if (!result.ok) { setMessage({ error: result.error.message }); return; } const currentEquipment = state.equipment.find((equipment) => equipment.id === Number(equipmentId)); setMessage(result.result.alert ? { warning: `Threshold breached — ${currentEquipment.assetCode} is At Risk. ${titleCase(result.result.alert.priority)} alert raised.` } : { success: 'Reading recorded.' }); setValue(''); setNote(''); };
  return <form onSubmit={submit} className="reading-form"><label>Machine<select value={equipmentId} onChange={changeEquipment}>{activeEquipment.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.assetCode} — {equipment.name}</option>)}</select></label><label>Parameter<select value={parameterId} onChange={(event) => setParameterId(Number(event.target.value))}>{parameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.name} ({parameter.threshold} {parameter.unit})</option>)}</select></label><label>Value<input required inputMode="decimal" type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} /></label><label>Note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} /></label>{message && <p className={`banner ${message.error ? 'error' : message.warning ? 'warning' : 'success'}`}>{message.error || message.warning || message.success}</p>}<button className="button" type="submit">Record reading</button></form>;
}
function EquipmentDetail() {
  const { id } = useParams(); const { select } = useMaintenance(); const { can } = useSession(); const detail = select.getEquipmentDetail(id);
  if (!detail) return <NotFound />;
  const readings = select.readingsForEquipment(id);
  return <Page title={`${detail.equipment.assetCode} — ${detail.equipment.name}`} action={can('manageEquipment') && <Link className="button button-secondary" to={`/equipment/${id}/edit`}>Edit equipment</Link>}><p>{detail.equipment.location} · {detail.equipment.equipmentType} · Last service: {formatDate(detail.equipment.lastServiceDate)} <StatusBadge status={detail.equipment.status} /></p><h3>Health parameters</h3><Table headers={['Parameter', 'Limit', 'Last value', 'State']}>{detail.parameters.map((parameter) => <tr key={parameter.id}><td>{parameter.name}</td><td>{formatValue(parameter.threshold, parameter.unit)}</td><td>{formatValue(parameter.lastValue, parameter.unit)}</td><td>{parameter.inBreach ? 'In breach' : 'Normal'}</td></tr>)}</Table>{can('logReading') && <><h3>Log a reading</h3><ReadingForm equipmentId={id} /></>}<h3>Reading history</h3><Table headers={['When', 'Parameter', 'Value', 'Logged by', 'Result']}>{readings.map((reading) => <tr className={reading.isBreach ? 'breach-row' : ''} key={reading.id}><td>{formatDateTime(reading.loggedAt)}</td><td>{reading.parameter?.name}</td><td>{formatValue(reading.value, reading.parameter?.unit)}</td><td>{reading.loggedByName}</td><td>{reading.isBreach ? 'Breach' : 'Normal'}</td></tr>)}</Table></Page>;
}
function Alerts() {
  const { select, actions } = useMaintenance(); const { can } = useSession(); const navigate = useNavigate(); const [priority, setPriority] = useState(''); const alerts = select.activeAlerts({ priority });
  const convert = (alert) => { const result = actions.createWorkOrderFromAlert(alert.id); if (result.ok) navigate(`/work-orders/${result.result.workOrder.id}`); };
  return <Page title="Alert queue"><label>Priority filter<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{['critical', 'high', 'medium'].map((value) => <option key={value}>{value}</option>)}</select></label><Table headers={['Asset', 'Parameter', 'Current / safe', 'Breaches', 'Priority', 'Suggested action', 'Action']}>{alerts.map((alert) => <tr key={alert.id}><td>{alert.equipment.assetCode}</td><td>{alert.parameter.name}</td><td>{formatValue(alert.currentValue, alert.unit)} / {formatValue(alert.safeValue, alert.unit)}</td><td>{alert.breachCount}</td><td><PriorityBadge priority={alert.priority} /></td><td>{alert.suggestedAction}</td><td>{can('manageWorkOrders') && <button className="button button-small" onClick={() => convert(alert)}>{alert.workOrder ? 'Open work order' : 'Create work order'}</button>}</td></tr>)}</Table></Page>;
}
function WorkOrders() {
  const { select } = useMaintenance(); const orders = select.workOrderSummaries();
  return <Page title="Work orders"><Table headers={['Number', 'Machine', 'Priority', 'Assignee', 'Due date', 'Status']}>{orders.map((order) => <tr key={order.id}><td><Link to={`/work-orders/${order.id}`}>{order.woNumber}</Link></td><td>{order.equipment?.assetCode}</td><td><PriorityBadge priority={order.priority} /></td><td>{order.assigneeName}</td><td className={order.overdue ? 'overdue' : ''}>{formatDate(order.dueDate)}</td><td><StatusBadge status={order.status} /></td></tr>)}</Table></Page>;
}
function WorkOrderDetail() {
  const { id } = useParams(); const { select, actions, state } = useMaintenance(); const { can } = useSession(); const detail = select.getWorkOrderDetail(id); const [error, setError] = useState(''); const [newPart, setNewPart] = useState({ partName: '', partNumber: '', quantityRequired: 1, availability: 'yes', notes: '' }); const [closure, setClosure] = useState({ resolutionNote: '', noPartsUsed: false });
  if (!detail) return <NotFound />;
  const { workOrder, equipment, parts } = detail;
  const update = (patch) => { const result = actions.updateWorkOrder(workOrder.id, patch); if (!result.ok) setError(result.error.message); };
  const updatePart = (part, patch) => { const result = actions.updatePart(workOrder.id, part.id, patch); if (!result.ok) setError(result.error.message); };
  const addPart = (event) => { event.preventDefault(); const result = actions.addPart(workOrder.id, newPart); if (!result.ok) { setError(result.error.message); return; } setNewPart({ partName: '', partNumber: '', quantityRequired: 1, availability: 'yes', notes: '' }); };
  const close = (event) => { event.preventDefault(); const result = actions.closeWorkOrder(workOrder.id, { resolutionNote: closure.resolutionNote, noPartsUsed: closure.noPartsUsed, partsUsed: parts.map((part) => ({ partId: part.id, quantityUsed: part.quantityUsed })) }); if (!result.ok) setError(result.error.message); };
  const canClose = closure.resolutionNote.trim() && (closure.noPartsUsed || parts.some((part) => Number(part.quantityUsed) > 0));
  return <Page title={workOrder.woNumber}><p><Link to={`/equipment/${equipment.id}`}>{equipment.assetCode} — {equipment.name}</Link> · <PriorityBadge priority={workOrder.priority} /> · <StatusBadge status={workOrder.status} /></p><p>{workOrder.faultDescription}</p>{error && <p className="banner error">{error}</p>}{can('manageWorkOrders') && workOrder.status !== 'closed' && <div className="form-grid compact"><label>Assignee<select value={workOrder.assigneeId} onChange={(event) => update({ assigneeId: event.target.value })}>{state.users.filter((user) => user.role === 'engineer').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>Due date<input type="date" value={workOrder.dueDate} onChange={(event) => update({ dueDate: event.target.value })} /></label><label>Status<select value={workOrder.status} onChange={(event) => update({ status: event.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option></select></label></div>}<h3>Parts checklist</h3><Table headers={['Part', 'Required', 'Availability', 'Notes', 'Used', '']}>{parts.map((part) => <tr key={part.id}><td>{can('manageWorkOrders') && workOrder.status !== 'closed' ? <input aria-label={`Part name for ${part.partName}`} value={part.partName} onChange={(event) => updatePart(part, { partName: event.target.value })} /> : part.partName}</td><td>{can('manageWorkOrders') && workOrder.status !== 'closed' ? <input aria-label={`Quantity required for ${part.partName}`} min="1" type="number" value={part.quantityRequired} onChange={(event) => updatePart(part, { quantityRequired: event.target.value })} /> : part.quantityRequired}</td><td>{can('manageWorkOrders') && workOrder.status !== 'closed' ? <select aria-label={`Availability for ${part.partName}`} value={part.availability} onChange={(event) => updatePart(part, { availability: event.target.value })}><option value="yes">yes</option><option value="no">no</option><option value="ordered">ordered</option></select> : part.availability}</td><td>{can('manageWorkOrders') && workOrder.status !== 'closed' ? <input aria-label={`Notes for ${part.partName}`} value={part.notes} onChange={(event) => updatePart(part, { notes: event.target.value })} /> : part.notes || '—'}</td><td>{can('manageWorkOrders') && workOrder.status !== 'closed' ? <input aria-label={`Quantity used for ${part.partName}`} min="0" type="number" value={part.quantityUsed} onChange={(event) => updatePart(part, { quantityUsed: event.target.value })} /> : part.quantityUsed}</td><td>{can('manageWorkOrders') && workOrder.status !== 'closed' && <button className="link-button" onClick={() => actions.removePart(workOrder.id, part.id)}>Remove</button>}</td></tr>)}</Table>{can('manageWorkOrders') && workOrder.status !== 'closed' && <><form className="form-grid compact" onSubmit={addPart}><h4>Add checklist part</h4><label>Part name<input required value={newPart.partName} onChange={(event) => setNewPart({ ...newPart, partName: event.target.value })} /></label><label>Part number<input value={newPart.partNumber} onChange={(event) => setNewPart({ ...newPart, partNumber: event.target.value })} /></label><label>Quantity required<input required min="1" type="number" value={newPart.quantityRequired} onChange={(event) => setNewPart({ ...newPart, quantityRequired: event.target.value })} /></label><label>Availability<select value={newPart.availability} onChange={(event) => setNewPart({ ...newPart, availability: event.target.value })}><option value="yes">yes</option><option value="no">no</option><option value="ordered">ordered</option></select></label><label>Notes<input value={newPart.notes} onChange={(event) => setNewPart({ ...newPart, notes: event.target.value })} /></label><button className="button button-secondary" type="submit">Add part</button></form><form className="form-grid compact" onSubmit={close}><h4>Close work order</h4><label>Resolution note<textarea required value={closure.resolutionNote} onChange={(event) => setClosure({ ...closure, resolutionNote: event.target.value })} /></label><label><input type="checkbox" checked={closure.noPartsUsed} onChange={(event) => setClosure({ ...closure, noPartsUsed: event.target.checked })} /> No parts used</label><button className="button" type="submit" disabled={!canClose}>Close work order</button></form></>}{workOrder.status === 'closed' && <p className="banner success">Closed {formatDateTime(workOrder.closedAt)}. Resolution: {workOrder.resolutionNote}</p>}</Page>;
}
function LogReading() { return <Page title="Log a reading"><ReadingForm /></Page>; }
function NotFound() { return <Page title="Page not found"><Link className="button" to="/">Go to home</Link></Page>; }
function Home() { const { user } = useSession(); return <Navigate to={roleHome(user.role)} replace />; }

// PUBLIC_INTERFACE
export function AppRoutes() {
  /** Define all routes rendered inside the session and data providers. */
  return <Layout><Routes><Route path="/" element={<Home />} /><Route path="/dashboard" element={<RequireCapability capability="viewDashboard"><Dashboard /></RequireCapability>} /><Route path="/equipment" element={<RequireCapability capability="viewEquipment"><EquipmentList /></RequireCapability>} /><Route path="/equipment/new" element={<RequireCapability capability="manageEquipment"><EquipmentForm /></RequireCapability>} /><Route path="/equipment/:id" element={<RequireCapability capability="viewEquipment"><EquipmentDetail /></RequireCapability>} /><Route path="/equipment/:id/edit" element={<RequireCapability capability="manageEquipment"><EquipmentForm /></RequireCapability>} /><Route path="/log-reading" element={<RequireCapability capability="logReading"><LogReading /></RequireCapability>} /><Route path="/alerts" element={<RequireCapability capability="viewAlerts"><Alerts /></RequireCapability>} /><Route path="/work-orders" element={<RequireCapability capability="viewWorkOrders"><WorkOrders /></RequireCapability>} /><Route path="/work-orders/:id" element={<RequireCapability capability="viewWorkOrders"><WorkOrderDetail /></RequireCapability>} /><Route path="*" element={<NotFound />} /></Routes></Layout>;
}

// PUBLIC_INTERFACE
export default function App() {
  /** Mount the browser router, role session, and in-memory maintenance store. */
  return <BrowserRouter><SessionProvider><MaintenanceDataProvider><AppRoutes /></MaintenanceDataProvider></SessionProvider></BrowserRouter>;
}
