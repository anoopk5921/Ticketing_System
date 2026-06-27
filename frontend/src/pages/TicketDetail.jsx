import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';

const PRIORITIES = [
  { value: 'normal', label: 'Normal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
];

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [actionBy, setActionBy] = useState('');
  const [images, setImages] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [updateForm, setUpdateForm] = useState({});
  const [forwardTo, setForwardTo] = useState('');
  const [remarks, setRemarks] = useState('');

  const load = async () => {
    try {
      const data = await api.getTicket(id);
      setTicket(data);
      setUpdateForm({
        ticket_description: data.ticket_description,
        details: data.details || '',
        complaint_category_id: data.complaint_category_id,
        location_id: data.location_id,
        priority: data.priority || 'normal',
      });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    api.getEmployees().then(setEmployees);
    api.getCategories().then(setCategories);
    api.getLocations().then(setLocations);
  }, [id]);

  const buildFormData = (extra = {}, { includeDocuments = false } = {}) => {
    const fd = new FormData();
    fd.append('action_by', actionBy);
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
    });
    images.forEach(img => fd.append('images', img));
    if (includeDocuments) {
      documents.forEach(doc => fd.append('files', doc));
    }
    return fd;
  };

  const resetModal = () => {
    setModal(null);
    setImages([]);
    setDocuments([]);
    setRemarks('');
    setForwardTo('');
    setError('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const fd = buildFormData({ ...updateForm, remarks }, { includeDocuments: documents.length > 0 });
      await api.updateTicket(id, fd);
      setMessage('Ticket updated successfully');
      resetModal();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleForward = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const fd = buildFormData({ forward_to: forwardTo, remarks });
      await api.forwardTicket(id, fd);
      setMessage('Ticket forwarded successfully');
      resetModal();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const fd = buildFormData({ remarks });
      await api.closeTicket(id, fd);
      setMessage('Ticket closed successfully');
      resetModal();
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!ticket) return <div>Loading...</div>;

  const isClosed = ticket.status === 'closed';
  const imageUrl = (path) => `/${path}`;
  const priorityLabel = (p) => (p || 'normal').charAt(0).toUpperCase() + (p || 'normal').slice(1);
  const imageAttachments = ticket.attachments.filter(a => a.file_type !== 'file');
  const fileAttachments = ticket.attachments.filter(a => a.file_type === 'file');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Ticket: {ticket.ticket_no}</h2>
        <button className="btn" onClick={() => navigate('/tickets')}>Back to List</button>
      </div>

      {message && <div className="success">{message}</div>}
      {error && !modal && <div className="error">{error}</div>}

      <div className="card">
        <div className="form-row">
          <div className="form-group"><label>Status</label><div><span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span></div></div>
          <div className="form-group"><label>Priority</label><div><span className={`badge badge-priority-${ticket.priority || 'normal'}`}>{priorityLabel(ticket.priority)}</span></div></div>
          <div className="form-group"><label>Date</label><div>{ticket.ticket_date}</div></div>
          <div className="form-group"><label>Category</label><div>{ticket.category_name}</div></div>
          <div className="form-group"><label>Location</label><div>{ticket.location_name}</div></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Raising Dept</label><div>{ticket.raising_dept_name}</div></div>
          <div className="form-group"><label>Raised By</label><div>{ticket.raising_employee_name}</div></div>
          <div className="form-group"><label>Assigned To</label><div>{ticket.assignee_name}</div></div>
        </div>
        <div className="form-group"><label>Description</label><div>{ticket.ticket_description}</div></div>
        <div className="form-group"><label>Details</label><div>{ticket.details || '-'}</div></div>

        {fileAttachments.length > 0 && (
          <div className="form-group">
            <label>Documents</label>
            <div>
              {fileAttachments.map(a => (
                <a key={a.id} href={imageUrl(a.file_path)} target="_blank" rel="noreferrer" className="btn" style={{ marginRight: 8, marginBottom: 8, display: 'inline-block' }}>
                  {a.file_name}
                </a>
              ))}
            </div>
          </div>
        )}

        {imageAttachments.length > 0 && (
          <div className="form-group">
            <label>Pictures</label>
            <div className="image-preview">
              {imageAttachments.map(a => (
                <a key={a.id} href={imageUrl(a.file_path)} target="_blank" rel="noreferrer">
                  <img src={imageUrl(a.file_path)} alt={a.file_name} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isClosed && (
        <div className="card">
          <label>Action By (Your Employee ID)</label>
          <select value={actionBy} onChange={e => setActionBy(e.target.value)} style={{ maxWidth: 300, marginBottom: 12 }}>
            <option value="">-- Select Employee --</option>
            {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name}</option>)}
          </select>
          <div>
            <button className="btn btn-primary" disabled={!actionBy} onClick={() => setModal('update')}>Update Ticket</button>
            <button className="btn btn-warning" disabled={!actionBy} onClick={() => setModal('forward')}>Forward Ticket</button>
            <button className="btn btn-success" disabled={!actionBy} onClick={() => setModal('close')}>Close Ticket</button>
          </div>
        </div>
      )}

      {ticket.history.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Ticket History</h3>
          {ticket.history.map(h => (
            <div key={h.id} className="history-item">
              <span className="action">{h.action}</span> — {h.remarks}
              <div className="time">{new Date(h.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={resetModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>
              {modal === 'update' && 'Update Ticket'}
              {modal === 'forward' && 'Forward Ticket'}
              {modal === 'close' && 'Close Ticket'}
            </h3>

            <form onSubmit={modal === 'update' ? handleUpdate : modal === 'forward' ? handleForward : handleClose}>
              {modal === 'update' && (
                <>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Description</label>
                    <input value={updateForm.ticket_description} onChange={e => setUpdateForm(p => ({ ...p, ticket_description: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Details</label>
                    <textarea value={updateForm.details} onChange={e => setUpdateForm(p => ({ ...p, details: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Category</label>
                      <select value={updateForm.complaint_category_id} onChange={e => setUpdateForm(p => ({ ...p, complaint_category_id: e.target.value }))}>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.category_description}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <select value={updateForm.location_id} onChange={e => setUpdateForm(p => ({ ...p, location_id: e.target.value }))}>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Priority</label>
                    <select value={updateForm.priority || 'normal'} onChange={e => setUpdateForm(p => ({ ...p, priority: e.target.value }))} required>
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {modal === 'forward' && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>Forward To</label>
                  <select value={forwardTo} onChange={e => setForwardTo(e.target.value)} required>
                    <option value="">-- Select Employee --</option>
                    {employees.filter(e => e.emp_id !== ticket.assigned_to).map(e => (
                      <option key={e.emp_id} value={e.emp_id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Remarks</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>

              {modal === 'update' && (
                <>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Upload Document</label>
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.ppt,.pptx" multiple onChange={e => setDocuments(Array.from(e.target.files))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Upload Pictures</label>
                    <input type="file" accept="image/*" multiple onChange={e => setImages(Array.from(e.target.files))} />
                  </div>
                </>
              )}

              {modal !== 'update' && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>Upload Pictures</label>
                  <input type="file" accept="image/*" multiple onChange={e => setImages(Array.from(e.target.files))} />
                </div>
              )}

              {error && <div className="error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="btn" onClick={resetModal}>Cancel</button>
                <button type="submit" className={`btn ${modal === 'close' ? 'btn-success' : 'btn-primary'}`}>
                  {modal === 'update' ? 'Update' : modal === 'forward' ? 'Forward' : 'Close Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
