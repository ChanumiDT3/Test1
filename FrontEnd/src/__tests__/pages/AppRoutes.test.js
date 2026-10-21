import { fireEvent, screen, within } from '@testing-library/react';
import { AppRoutes } from '../../App';
import { renderWithProviders } from '../../testUtils/renderWithProviders';

describe('routed maintenance workflow', () => {
  test('records a CNC reading and shows a critical breach banner', () => {
    renderWithProviders(<AppRoutes />, { route: '/log-reading' });

    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '95' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record reading' }));

    expect(
      screen.getByText('Threshold breached — CNC-01 is At Risk. Critical alert raised.')
    ).toBeInTheDocument();
  });

  test('shows alert fields and converts an unassigned alert to its work order', () => {
    renderWithProviders(<AppRoutes />, { route: '/alerts' });

    expect(screen.getByText('CONV-02')).toBeInTheDocument();
    expect(screen.getByText('Drive vibration')).toBeInTheDocument();
    expect(screen.getByText('5.2 mm/s / 4.5 mm/s')).toBeInTheDocument();
    expect(screen.getByText('Plan within 3 days: Inspect for imbalance, misalignment, loose mounts and bearing wear; verify the vibration sensor.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create work order' }));

    expect(screen.getByRole('heading', { name: 'WO-000003' })).toBeInTheDocument();
  });

  test('filters navigation and write controls by role', () => {
    renderWithProviders(<AppRoutes />, {
      route: '/log-reading',
      userId: 3,
    });

    expect(screen.queryByText('Alert queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Work orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  test('shows seeded dashboard counts for a manager', () => {
    renderWithProviders(<AppRoutes />, { route: '/dashboard', userId: 4 });

    expect(screen.getByRole('heading', { name: 'Maintenance dashboard' })).toBeInTheDocument();
    expect(screen.getByText('At risk')).toBeInTheDocument();
    expect(screen.getByText('Critical alerts')).toBeInTheDocument();
    expect(screen.getByText('High alerts')).toBeInTheDocument();
    expect(screen.getByText('Overdue work orders')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'At risk' })).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Critical alerts' })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'High alerts' })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Overdue work orders' })).getByText('1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create work order|Close work order/ })).not.toBeInTheDocument();
  });

  test('records ordered part availability, notes, quantity used, and closes a work order', () => {
    renderWithProviders(<AppRoutes />, { route: '/work-orders/2' });

    fireEvent.change(screen.getByLabelText('Availability for Hydraulic oil filter'), { target: { value: 'ordered' } });
    fireEvent.change(screen.getByLabelText('Notes for Hydraulic oil filter'), { target: { value: 'Replacement approved' } });
    fireEvent.change(screen.getByLabelText('Quantity used for Hydraulic oil filter'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Resolution note'), { target: { value: 'Replaced the hydraulic oil filter.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close work order' }));

    expect(screen.getByText(/Closed .*Resolution: Replaced the hydraulic oil filter\./)).toBeInTheDocument();
    expect(screen.getAllByText('ordered')).toHaveLength(2);
    expect(screen.getByText('Replacement approved')).toBeInTheDocument();
  });

  test('shows an inline duplicate asset-code error during registration', () => {
    renderWithProviders(<AppRoutes />, { route: '/equipment/new' });

    fireEvent.change(screen.getByLabelText('Asset code'), { target: { value: 'CNC-01' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Duplicate machine' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Bay C' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'CNC machine' } });
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Spindle temperature' } });
    fireEvent.change(screen.getByPlaceholderText('Unit'), { target: { value: 'C' } });
    fireEvent.change(screen.getByPlaceholderText('Threshold'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save equipment' }));

    expect(screen.getByText('Asset code already exists')).toBeInTheDocument();
  });
});
