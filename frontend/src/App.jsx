import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import POS from './pages/pos';
import MainMenu from './pages/MainMenu';
import OpenBox from './pages/OpenBox';

const RutaPrivada = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/menu" element={<RutaPrivada><MainMenu /></RutaPrivada>} />
          <Route path="/apertura-caja" element={<RutaPrivada><OpenBox /></RutaPrivada>} />
          <Route path="/pos" element={<RutaPrivada><POS /></RutaPrivada>} />

          <Route path="*" element={<Navigate to="/menu" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
