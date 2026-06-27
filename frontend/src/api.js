const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// --- Masters ---
export const getDepartments = () => request('/departments/');
export const createDepartment = (data) => request('/departments/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateDepartment = (id, data) => request(`/departments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteDepartment = (id) => request(`/departments/${id}`, { method: 'DELETE' });

export const getRoles = () => request('/roles/');
export const createRole = (data) => request('/roles/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateRole = (id, data) => request(`/roles/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteRole = (id) => request(`/roles/${id}`, { method: 'DELETE' });

export const getEmployees = () => request('/employees/');
export const createEmployee = (data) => request('/employees/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateEmployee = (id, data) => request(`/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteEmployee = (id) => request(`/employees/${id}`, { method: 'DELETE' });

export const getCategories = () => request('/categories/');
export const createCategory = (data) => request('/categories/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateCategory = (id, data) => request(`/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' });

export const getLocations = () => request('/locations/');
export const createLocation = (data) => request('/locations/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const updateLocation = (id, data) => request(`/locations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const deleteLocation = (id) => request(`/locations/${id}`, { method: 'DELETE' });

// --- Tickets ---
export const getTickets = () => request('/tickets/');
export const getTicket = (id) => request(`/tickets/${id}`);

export async function createTicket(formData) {
  const res = await fetch(`${API_BASE}/tickets/`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export async function updateTicket(id, formData) {
  const res = await fetch(`${API_BASE}/tickets/${id}`, { method: 'PUT', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export async function forwardTicket(id, formData) {
  const res = await fetch(`${API_BASE}/tickets/${id}/forward`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export async function closeTicket(id, formData) {
  const res = await fetch(`${API_BASE}/tickets/${id}/close`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}
