import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Departments, { Roles, Employees, Categories, Locations } from './pages/Masters';
import TicketList from './pages/TicketList';
import NewTicket from './pages/NewTicket';
import TicketDetail from './pages/TicketDetail';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <h1>Ticketing System</h1>

          <div className="section-title">Tickets</div>
          <NavLink to="/tickets" className={({ isActive }) => isActive ? 'active' : ''}>All Tickets</NavLink>
          <NavLink to="/tickets/new" className={({ isActive }) => isActive ? 'active' : ''}>New Ticket</NavLink>

          <div className="section-title">Masters</div>
          <NavLink to="/masters/departments" className={({ isActive }) => isActive ? 'active' : ''}>Departments</NavLink>
          <NavLink to="/masters/roles" className={({ isActive }) => isActive ? 'active' : ''}>Roles</NavLink>
          <NavLink to="/masters/employees" className={({ isActive }) => isActive ? 'active' : ''}>Employees</NavLink>
          <NavLink to="/masters/categories" className={({ isActive }) => isActive ? 'active' : ''}>Categories</NavLink>
          <NavLink to="/masters/locations" className={({ isActive }) => isActive ? 'active' : ''}>Locations</NavLink>
        </nav>

        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/tickets" replace />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/new" element={<NewTicket />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/masters/departments" element={<Departments />} />
            <Route path="/masters/roles" element={<Roles />} />
            <Route path="/masters/employees" element={<Employees />} />
            <Route path="/masters/categories" element={<Categories />} />
            <Route path="/masters/locations" element={<Locations />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
