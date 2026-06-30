import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';

import Departments, { Roles, Employees, Categories, Locations } from './pages/Masters';

import TicketList from './pages/TicketList';

import NewTicket from './pages/NewTicket';

import TicketDetail from './pages/TicketDetail';

import Login from './pages/Login';

import { isAuthenticated, getAuthUser } from './auth';

import { logout } from './api';



function ProtectedLayout({ children }) {

  if (!isAuthenticated()) {

    return <Navigate to="/login" replace />;

  }



  const user = getAuthUser();



  const handleLogout = async () => {

    await logout();

    window.location.href = '/login';

  };



  return (

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



      <div className="content-area">

        <header className="app-header">

          <div className="app-header-user">

            <span className="user-name">{user?.name}</span>

            <button type="button" className="btn btn-sm header-logout" onClick={handleLogout}>Logout</button>

          </div>

        </header>

        <main className="main">

          {children}

        </main>

      </div>

    </div>

  );

}



function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route path="/login" element={

          isAuthenticated() ? <Navigate to="/tickets" replace /> : <Login />

        } />

        <Route path="/" element={<Navigate to="/tickets" replace />} />

        <Route path="/tickets" element={<ProtectedLayout><TicketList /></ProtectedLayout>} />

        <Route path="/tickets/new" element={<ProtectedLayout><NewTicket /></ProtectedLayout>} />

        <Route path="/tickets/:id" element={<ProtectedLayout><TicketDetail /></ProtectedLayout>} />

        <Route path="/masters/departments" element={<ProtectedLayout><Departments /></ProtectedLayout>} />

        <Route path="/masters/roles" element={<ProtectedLayout><Roles /></ProtectedLayout>} />

        <Route path="/masters/employees" element={<ProtectedLayout><Employees /></ProtectedLayout>} />

        <Route path="/masters/categories" element={<ProtectedLayout><Categories /></ProtectedLayout>} />

        <Route path="/masters/locations" element={<ProtectedLayout><Locations /></ProtectedLayout>} />

      </Routes>

    </BrowserRouter>

  );

}



export default App;


