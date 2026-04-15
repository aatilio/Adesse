import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import StudentPage from './pages/StudentPage';
import TeacherPage from './pages/TeacherPage';
import { ToastContainer } from './components/Toast';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);

  // Persist session across page refreshes
  useEffect(() => {
    const saved = localStorage.getItem('sai_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); }
      catch { localStorage.removeItem('sai_user'); }
    }
  }, []);

  const handleLogin  = (u) => setUser(u);
  const handleLogout = () => {
    localStorage.removeItem('sai_user');
    setUser(null);
  };

  return (
    <>
      <ToastContainer />
      {!user && <LoginPage onLogin={handleLogin} />}
      {user?.role === 'alumno'   && <StudentPage user={user} onLogout={handleLogout} />}
      {user?.role === 'profesor' && <TeacherPage user={user} onLogout={handleLogout} />}
    </>
  );
}
