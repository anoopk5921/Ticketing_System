import { useState, useEffect } from 'react';

export default function MasterPage({ title, fields, api }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const emptyForm = () => {
    const obj = {};
    fields.forEach(f => { obj[f.key] = ''; });
    return obj;
  };

  const load = async () => {
    try {
      const data = await api.list();
      setItems(data);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = {};
      fields.forEach(f => {
        if (f.type === 'number') {
          payload[f.key] = Number(form[f.key]);
        } else if (f.type === 'password' && editId && !form[f.key]) {
          // skip empty password on update
        } else {
          payload[f.key] = form[f.key];
        }
      });
      if (editId) {
        await api.update(editId, payload);
        setMessage('Updated successfully');
      } else {
        await api.create(payload);
        setMessage('Created successfully');
      }
      setForm(emptyForm());
      setEditId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEdit = (item) => {
    const obj = {};
    fields.forEach(f => { obj[f.key] = f.type === 'password' ? '' : item[f.key]; });
    setForm(obj);
    setEditId(item[fields[0].idKey]);
    setMessage('');
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete?')) return;
    try {
      await api.remove(id);
      setMessage('Deleted successfully');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyForm());
    setEditId(null);
    setError('');
  };

  return (
    <div>
      <h2 className="page-title">{title}</h2>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            {fields.map(f => (
              <div className="form-group" key={f.key}>
                <label>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form[f.key] || ''} onChange={e => handleChange(f.key, e.target.value)} required>
                    <option value="">-- Select --</option>
                    {f.options.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={form[f.key] || ''}
                    onChange={e => handleChange(f.key, e.target.value)}
                    required={f.type === 'password' && editId ? false : true}
                    placeholder={f.type === 'password' && editId ? 'Leave blank to keep current' : ''}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}
          <button type="submit" className="btn btn-primary">
            {editId ? 'Update' : 'Save'}
          </button>
          {editId && (
            <button type="button" className="btn" onClick={handleCancel} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              {fields.filter(f => f.type !== 'password').map(f => <th key={f.key}>{f.label}</th>)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item[fields[0].idKey]}>
                {fields.filter(f => f.type !== 'password').map(f => (
                  <td key={f.key}>
                    {f.displayKey ? item[f.displayKey] : item[f.key]}
                  </td>
                ))}
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => handleEdit(item)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item[fields[0].idKey])}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={fields.length + 1} style={{ textAlign: 'center', color: '#888' }}>No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
