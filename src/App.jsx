import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReportPage    from './pages/ReportPage';
import Navbar        from './components/Navbar';
import WeeklyReportPage from './pages/WeeklyReportPage';
import JiraTicketsPage from './pages/JiraTicketsPage';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user)          return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/"      replace />;
  return children;
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>
          } />
          <Route path="/report" element={
            <AdminRoute><Layout><ReportPage /></Layout></AdminRoute>
          } />
          <Route path="/weekly-report" element={
            <AdminRoute><Layout><WeeklyReportPage /></Layout></AdminRoute>
          } />
          <Route path="/jira-tickets" element={
            <AdminRoute><Layout><JiraTicketsPage /></Layout></AdminRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
