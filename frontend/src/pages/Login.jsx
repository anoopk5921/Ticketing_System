import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import { setAuth } from '../auth';

export default function Login() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login(userId, password);
      setAuth(data.token, data.user);
      navigate('/tickets', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <h2 className="login-title">Ticketing System</h2>
        <p className="login-subtitle">Sign in with your employee credentials</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>User ID</label>
            <input value={userId} onChange={e => setUserId(e.target.value)} required autoComplete="username" />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
        </form>
      </div>
    </div>
  );
}
