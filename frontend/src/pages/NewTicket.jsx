import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';

const PRIORITIES = [
  { value: 'normal', label: 'Normal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
];
export default function NewTicket() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [images, setImages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    ticket_date: new Date().toISOString().split('T')[0],
    raising_dept_id: '',
    raising_employee_id: '',
    complaint_category_id: '',
    location_id: '',
    ticket_description: '',
    details: '',
    assigned_to: '',
    priority: 'normal',
  });

  useEffect(() => {
    api.getDepartments().then(setDepartments);
    api.getEmployees().then(setEmployees);
    api.getCategories().then(setCategories);
    api.getLocations().then(setLocations);
  }, []);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const handleDocumentChange = (e) => {
    setDocuments(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (documents.length === 0) {
      setError('Please upload at least one document file');
      return;
    }
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (val !== '') fd.append(key, val);
      });
      images.forEach(img => fd.append('images', img));
      documents.forEach(doc => fd.append('files', doc));

      await api.createTicket(fd);
      navigate('/tickets');
    } catch (e) {
      setError(e.message);
    }
  };

  const deptEmployees = employees.filter(e => String(e.dept_id) === String(form.raising_dept_id));

  return (
    <div>
      <h2 className="page-title">Create New Ticket</h2>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.ticket_date} onChange={e => handleChange('ticket_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => handleChange('priority', e.target.value)} required>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Raising Department</label>
              <select value={form.raising_dept_id} onChange={e => { handleChange('raising_dept_id', e.target.value); handleChange('raising_employee_id', ''); }} required>
                <option value="">-- Select --</option>
                {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.description}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Raising Employee</label>
              <select value={form.raising_employee_id} onChange={e => handleChange('raising_employee_id', e.target.value)} required>
                <option value="">-- Select --</option>
                {deptEmployees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Complaint Category</label>
              <select value={form.complaint_category_id} onChange={e => handleChange('complaint_category_id', e.target.value)} required>
                <option value="">-- Select --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.category_description}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <select value={form.location_id} onChange={e => handleChange('location_id', e.target.value)} required>
                <option value="">-- Select --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ticket Description</label>
              <input value={form.ticket_description} onChange={e => handleChange('ticket_description', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Assigned To</label>
              <select value={form.assigned_to} onChange={e => handleChange('assigned_to', e.target.value)} required>
                <option value="">-- Select --</option>
                {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Details</label>
            <textarea value={form.details} onChange={e => handleChange('details', e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Upload Document *</label>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.ppt,.pptx" multiple onChange={handleDocumentChange} required />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Upload Pictures</label>
            <input type="file" accept="image/*" multiple onChange={handleImageChange} />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-primary">Create Ticket</button>
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => navigate('/tickets')}>Cancel</button>
        </form>
      </div>
    </div>
  );
}
