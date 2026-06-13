import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const CloseBox = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();

    const [caja, setCaja] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dineroFisico, setDineroFisico] = useState('');
    const [resumen, setResumen] = useState(null);

    // 1. Obtener estado actual de la caja
    useEffect(() => {
        const fetchEstado = async () => {
            try {
                const res = await api.get('ventas/estado-caja/');
                if (!res.data.abierta) {
                    alert("No tienes una caja abierta.");
                    navigate('/menu');
                    return;
                }
                setCaja(res.data);
            } catch (error) {
                console.error("Error obteniendo estado de caja", error);
                alert("Error de conexión");
                navigate('/menu');
            } finally {
                setLoading(false);
            }
        };
        fetchEstado();
    }, [navigate]);

    // 2. Manejar el Cierre
    const handleCerrar = async (e) => {
        e.preventDefault();

        if (!caja?.id) return;
        if (!dineroFisico) return alert("Ingresa el dinero contado.");

        try {
            const res = await api.put(`ventas/cerrar/${caja.id}/`, {
                dinero_fisico_declarado: dineroFisico
            });

            // Mostrar resumen
            setResumen(res.data);

        } catch (error) {
            console.error(error);
            alert("Error cerrando caja: " + (error.response?.data?.error || "Desconocido"));
        }
    };

    const finalizar = () => {
        logout(); // Cerramos sesión de usuario también por seguridad
        navigate('/login');
    };

    if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

    if (resumen) {
        return (
            <div className="container mt-5">
                <div className="card shadow border-success">
                    <div className="card-header bg-success text-white">
                        <h2 className="mb-0">✅ Caja Cerrada</h2>
                    </div>
                    <div className="card-body text-center">
                        <h4 className="mb-4">El turno ha finalizado correctamente.</h4>
                        <p className="text-muted">La información ha sido guardada.</p>

                        <button className="btn btn-primary btn-lg mt-4" onClick={finalizar}>
                            Salir y Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
            <div className="card shadow p-4" style={{ maxWidth: '500px', width: '100%' }}>
                <h3 className="text-center mb-4">🔒 Cerrar Turno</h3>

                <div className="alert alert-info">
                    <p className="mb-0"><strong>Usuario:</strong> {user?.username}</p>
                </div>

                <form onSubmit={handleCerrar}>
                    <div className="mb-3">
                        <label className="form-label fw-bold">Dinero en Efectivo (Billetes + Monedas)</label>
                        <p className="small text-muted">Cuenta todo el dinero físico que hay en la caja y escríbelo aquí.</p>
                        <input
                            type="number"
                            className="form-control form-control-lg text-center"
                            placeholder="Ej: 154000"
                            value={dineroFisico}
                            onChange={(e) => setDineroFisico(e.target.value)}
                            required
                            min="0"
                        />
                    </div>

                    <div className="d-grid gap-2">
                        <button className="btn btn-danger btn-lg">Realizar Arqueo y Cerrar</button>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/menu')}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CloseBox;
