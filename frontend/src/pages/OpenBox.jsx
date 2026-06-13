import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const OpenBox = () => {
    const [monto, setMonto] = useState('');
    const [sedes, setSedes] = useState([]);
    const [selectedSede, setSelectedSede] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const fetchSedes = async () => {
            try {
                const res = await api.get('inventario/sedes/');
                setSedes(res.data);
                if (res.data.length > 0) {
                    // Pre-seleccionar la primera
                    setSelectedSede(res.data[0].id);
                }
            } catch (error) {
                console.error("Error cargando sedes", error);
            }
        };

        if (user?.rol === 'ADMIN') {
            fetchSedes();
        }
    }, [user]);

    const handleAbrir = async (e) => {
        e.preventDefault();
        try {
            const payload = { saldo_inicial: monto };

            // Si es Admin, agregamos la sede seleccionada
            if (user?.rol === 'ADMIN') {
                if (!selectedSede) {
                    alert("Por favor selecciona una Sede");
                    return;
                }
                payload.sede_id = selectedSede;
            }

            await api.post('ventas/abrir-caja/', payload);
            alert("✅ Caja abierta exitosamente");
            navigate('/menu');
        } catch (error) {
            console.error(error);
            alert("Error abriendo caja: " + (error.response?.data?.error || "Error desconocido"));
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
            <div className="card shadow p-4" style={{ maxWidth: '400px', width: '100%' }}>
                <h3 className="text-center mb-4">💰 Apertura de Caja</h3>
                <p className="text-muted text-center">
                    {user?.rol === 'ADMIN'
                        ? 'Admin: Selecciona Sede y Base'
                        : 'Ingresa el dinero base para iniciar turno.'}
                </p>

                <form onSubmit={handleAbrir}>
                    {user?.rol === 'ADMIN' && (
                        <div className="mb-3">
                            <label className="form-label fw-bold">Sede:</label>
                            <select
                                className="form-select"
                                value={selectedSede}
                                onChange={(e) => setSelectedSede(e.target.value)}
                            >
                                {sedes.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label fw-bold">Saldo Inicial ($)</label>
                        <input
                            type="number"
                            className="form-control form-control-lg text-center"
                            placeholder="Ej: 50000"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            required
                            min="0"
                        />
                    </div>
                    <button className="btn btn-success w-100 btn-lg">Abrir Turno</button>
                </form>
            </div>
        </div>
    );
};

export default OpenBox;