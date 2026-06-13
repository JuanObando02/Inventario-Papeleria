import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Login from './pages/Login';
import POS from './pages/pos';
import MainMenu from './pages/MainMenu';
import OpenBox from './pages/OpenBox';
import CloseBox from './pages/CloseBox';
import AdminReports from './pages/AdminReports';
import SalesReport from './pages/SalesReport';
import PriceCheck from './pages/PriceCheck';
import InventoryMovements from './pages/InventoryMovements';
import CreateProduct from './pages/CreateProduct';
import EditProduct from './pages/EditProduct';
import AdminInventory from './pages/AdminInventory';
import StockAlerts from './pages/StockAlerts';

const RutaPrivada = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />; //si hay user renderiza children si no redirige a login
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/menu" element={<RutaPrivada><MainMenu /></RutaPrivada>} />
          <Route path="/apertura-caja" element={<RutaPrivada><OpenBox /></RutaPrivada>} />
          <Route path="/cerrar-caja" element={<RutaPrivada><CloseBox /></RutaPrivada>} />
          <Route path="/admin/reportes" element={<RutaPrivada><AdminReports /></RutaPrivada>} />
          <Route path="/admin/reportes-ventas" element={<RutaPrivada><SalesReport /></RutaPrivada>} />
          <Route path="/admin/inventario" element={<RutaPrivada><InventoryMovements /></RutaPrivada>} />
          <Route path="/admin/inventario-global" element={<RutaPrivada><AdminInventory /></RutaPrivada>} />
          <Route path="/admin/crear-producto" element={<RutaPrivada><CreateProduct /></RutaPrivada>} />
          <Route path="/admin/editar-producto" element={<RutaPrivada><EditProduct /></RutaPrivada>} />
          <Route path="/verificador" element={<RutaPrivada><PriceCheck /></RutaPrivada>} />
          <Route path="/alertas-stock" element={<RutaPrivada><StockAlerts /></RutaPrivada>} />
          <Route path="/pos" element={<RutaPrivada><POS /></RutaPrivada>} />

          <Route path="*" element={<Navigate to="/menu" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
