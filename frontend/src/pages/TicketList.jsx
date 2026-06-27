import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';

export default function TicketList() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await api.getTickets();
      setTickets(data);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const statusLabel = (s) => s.replace('_', ' ');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Tickets</h2>
        <button className="btn btn-primary" onClick={() => navigate('/tickets/new')}>
          + New Ticket
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Ticket No</th>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Location</th>
              <th>Raised By</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}>
                <td>{t.ticket_no}</td>
                <td>{t.ticket_date}</td>
                <td>{t.ticket_description}</td>
                <td>{t.category_name}</td>
                <td>{t.location_name}</td>
                <td>{t.raising_employee_name}</td>
                <td>{t.assignee_name}</td>
                <td><span className={`badge badge-${t.status}`}>{statusLabel(t.status)}</span></td>
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/tickets/${t.id}`)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888' }}>No tickets found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
