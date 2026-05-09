import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store';
import { AppLayout } from './ui/AppLayout';
import { Dashboard } from './ui/pages/Dashboard';
import { Attendance } from './ui/pages/Attendance';
import { AttendanceHistory } from './ui/pages/AttendanceHistory';
import { AttendanceReport } from './ui/pages/AttendanceReport';
import { Evaluations } from './ui/pages/Evaluations';
import { GradeReport } from './ui/pages/GradeReport';
import { SystemReset } from './ui/pages/SystemReset';
import { Login } from './ui/pages/Login';
import { supabase } from './data/supabase';

function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1628]">
        <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/history" element={<AttendanceHistory />} />
            <Route path="/report" element={<AttendanceReport />} />
            <Route path="/evaluations" element={<Evaluations />} />
            <Route path="/grades" element={<GradeReport />} />
            <Route path="/reset" element={<SystemReset />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
