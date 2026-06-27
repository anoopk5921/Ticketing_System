import { useState, useEffect } from 'react';
import MasterPage from '../components/MasterPage';
import * as api from '../api';

export default function Departments() {
  return (
    <MasterPage
      title="Department Master"
      fields={[
        { key: 'description', label: 'Description', idKey: 'dept_id' },
      ]}
      api={{
        list: api.getDepartments,
        create: api.createDepartment,
        update: api.updateDepartment,
        remove: api.deleteDepartment,
      }}
    />
  );
}

export function Roles() {
  return (
    <MasterPage
      title="Role Master"
      fields={[
        { key: 'role_name', label: 'Role Name', idKey: 'role_id' },
      ]}
      api={{
        list: api.getRoles,
        create: api.createRole,
        update: api.updateRole,
        remove: api.deleteRole,
      }}
    />
  );
}

export function Employees() {
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    api.getDepartments().then(setDepartments);
    api.getRoles().then(setRoles);
  }, []);

  if (departments.length === 0 || roles.length === 0) {
    return <div><h2 className="page-title">Employee Master</h2><p>Please add Departments and Roles first.</p></div>;
  }

  return (
    <MasterPage
      title="Employee Master"
      fields={[
        { key: 'name', label: 'Name', idKey: 'emp_id' },
        { key: 'user_id', label: 'User ID', idKey: 'emp_id' },
        { key: 'password', label: 'Password', type: 'password', idKey: 'emp_id' },
        {
          key: 'dept_id', label: 'Department', type: 'select', idKey: 'emp_id',
          displayKey: 'department_name',
          options: departments.map(d => ({ value: d.dept_id, label: d.description })),
        },
        {
          key: 'role_id', label: 'Role', type: 'select', idKey: 'emp_id',
          displayKey: 'role_name',
          options: roles.map(r => ({ value: r.role_id, label: r.role_name })),
        },
      ]}
      api={{
        list: api.getEmployees,
        create: api.createEmployee,
        update: api.updateEmployee,
        remove: api.deleteEmployee,
      }}
    />
  );
}

export function Categories() {
  return (
    <MasterPage
      title="Complaint Category Master"
      fields={[
        { key: 'category_description', label: 'Category Description', idKey: 'id' },
      ]}
      api={{
        list: api.getCategories,
        create: api.createCategory,
        update: api.updateCategory,
        remove: api.deleteCategory,
      }}
    />
  );
}

export function Locations() {
  return (
    <MasterPage
      title="Location Master"
      fields={[
        { key: 'location_name', label: 'Location Name', idKey: 'id' },
      ]}
      api={{
        list: api.getLocations,
        create: api.createLocation,
        update: api.updateLocation,
        remove: api.deleteLocation,
      }}
    />
  );
}
