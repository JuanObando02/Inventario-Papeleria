import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const AdminReports = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [sesiones, setSesiones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vista, setVista] = useState('cerradas'); // 'cerradas' | 'abiertas'

    // Estado para el Modal de Detalle
    const [selectedSesionId, setSelectedSesionId] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    // 1. Cargar Lista
    useEffect(() => {
        if (user?.rol !== 'ADMIN') {
            navigate('/menu');
            return;
        }

        const fetchSesiones = async () => {
            setLoading(true);
            try {
                let url = 'ventas/admin/reportes/cajas/';
                if (vista === 'abiertas') url += '?estado=abiertas';
                const res = await api.get(url);
                setSesiones(res.data);
            } catch (error) {
                console.error("Error cargando reportes", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSesiones();
    }, [user, navigate, vista]);

    // 2. Cargar Detalle de una sesión
    const verDetalle = async (id) => {
        setSelectedSesionId(id);
        setLoadingDetalle(true);
        try {
            const res = await api.get(`ventas/admin/reportes/cajas/${id}/`);
            setDetalle(res.data);
        } catch (error) {
            console.error("Error cargando detalle", error);
            alert("No se pudo cargar el detalle.");
        } finally {
            setLoadingDetalle(false);
        }
    };

    const cerrarModal = () => {
        setSelectedSesionId(null);
        setDetalle(null);
    };

    const anularVenta = async (ventaId) => {
        const motivo = prompt("Motivo de la anulación de la venta #" + ventaId + ":");
        if (!motivo || !motivo.trim()) return;

        try {
            await api.post(`ventas/anular/${ventaId}/`, { motivo: motivo.trim() });
            alert("Venta anulada correctamente. El stock fue devuelto.");
            // Recargar el detalle para reflejar la anulación
            verDetalle(selectedSesionId);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || "No se pudo anular la venta.");
        }
    };

    // --- RENDERIZADO ---
    if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

    return (
        <div className="container mt-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>📊 Reportes de Cierre de Caja</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            {/* TOGGLE CERRADAS / ABIERTAS */}
            <div className="btn-group mb-3">
                <button
                    className={`btn ${vista === 'cerradas' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setVista('cerradas')}
                >
                    Cajas Cerradas
                </button>
                <button
                    className={`btn ${vista === 'abiertas' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setVista('abiertas')}
                >
                    Cajas Abiertas
                </button>
            </div>

            <div className="card shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>ID</th>
                                    <th>{vista === 'abiertas' ? 'Fecha Apertura' : 'Fecha Cierre'}</th>
                                    <th>Usuario</th>
                                    <th>Sede</th>
                                    <th className="text-end">Diferencia</th>
                                    <th className="text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sesiones.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-4">
                                            {vista === 'abiertas' ? 'No hay cajas abiertas en este momento.' : 'No hay cierres registrados.'}
                                        </td>
                                    </tr>
                                ) : (
                                    sesiones.map(s => {
                                        const dif = parseFloat(s.diferencia);
                                        const color = dif === 0 ? 'text-primary' : (dif < 0 ? 'text-danger' : 'text-success');
                                        const fecha = new Date(vista === 'abiertas' ? s.fecha_apertura : s.fecha_cierre).toLocaleString();

                                        return (
                                            <tr key={s.id}>
                                                <td>#{s.id}</td>
                                                <td>{fecha}</td>
                                                <td>{s.usuario_nombre}</td>
                                                <td><span className="badge bg-info text-dark">{s.sede_nombre}</span></td>
                                                <td className={`text-end fw-bold ${color}`}>
                                                    {vista === 'abiertas' ? (
                                                        <span className="badge bg-success">EN CURSO</span>
                                                    ) : (
                                                        `$${dif.toLocaleString()}`
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => verDetalle(s.id)}
                                                    >
                                                        Ver Detalle
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL DETALLE (Implementación Manual simple con CSS absolute o fixed) */}
            {selectedSesionId && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-xl modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Detalle Cierre #{selectedSesionId}</h5>
                                <button type="button" className="btn-close" onClick={cerrarModal}></button>
                            </div>
                            <div className="modal-body bg-light">
                                {loadingDetalle ? (
                                    <div className="text-center py-5"><div className="spinner-border"></div></div>
                                ) : detalle && (
                                    <div className="row g-4">

                                        {/* 1. RESUMEN FINANCIERO */}
                                        <div className="col-md-4">
                                            <div className="card shadow-sm h-100">
                                                <div className="card-header bg-primary text-white">
                                                    Resumen de Dinero
                                                </div>
                                                <ul className="list-group list-group-flush">
                                                    <li className="list-group-item d-flex justify-content-between">
                                                        <span>Base Inicial:</span>
                                                        <strong>${parseFloat(detalle.monto_base).toLocaleString()}</strong>
                                                    </li>
                                                    <li className="list-group-item d-flex justify-content-between">
                                                        <span>Ventas (Sistema):</span>
                                                        <strong>+ ${parseFloat(detalle.total_ventas_sistema).toLocaleString()}</strong>
                                                    </li>
                                                    <li className="list-group-item d-flex justify-content-between bg-light fw-bold">
                                                        <span>Total Esperado:</span>
                                                        <span>${parseFloat(detalle.total_esperado).toLocaleString()}</span>
                                                    </li>
                                                    <li className="list-group-item d-flex justify-content-between">
                                                        <span>Dinero Reportado:</span>
                                                        <strong>${parseFloat(detalle.dinero_fisico_declarado || 0).toLocaleString()}</strong>
                                                    </li>
                                                    <li className={`list-group-item d-flex justify-content-between fw-bold text-white ${parseFloat(detalle.diferencia || 0) < 0 ? 'bg-danger' : (parseFloat(detalle.diferencia || 0) > 0 ? 'bg-success' : 'bg-info')}`}>
                                                        <span>Diferencia:</span>
                                                        <span>${parseFloat(detalle.diferencia || 0).toLocaleString()}</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>

                                        {/* 2. LISTA DE VENTAS */}
                                        <div className="col-md-8">
                                            <div className="card shadow-sm">
                                                <div className="card-header bg-white fw-bold">
                                                    Desglose de Ventas
                                                </div>
                                                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                                    <table className="table table-sm table-striped mb-0">
                                                        <thead className="table-light sticky-top">
                                                            <tr>
                                                                <th>Hora</th>
                                                                <th>Método</th>
                                                                <th>Productos</th>
                                                                <th className="text-end">Total</th>
                                                                {detalle.activa && <th className="text-center">Acción</th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {detalle.ventas.map(v => (
                                                                <tr key={v.id} className={v.anulada ? 'table-danger' : ''} style={v.anulada ? { textDecoration: 'line-through', opacity: 0.6 } : {}}>
                                                                    <td>{v.hora}</td>
                                                                    <td>
                                                                        <span className="badge bg-secondary">{v.metodo_pago}</span>
                                                                        {v.anulada && (
                                                                            <span className="badge bg-danger ms-1" title={v.motivo_anulacion}>ANULADA</span>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        <ul className="list-unstyled mb-0 small">
                                                                            {v.detalles.map((d, idx) => (
                                                                                <li key={idx}>
                                                                                    {d.cantidad}x {d.producto_nombre} (${parseFloat(d.subtotal).toLocaleString()})
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </td>
                                                                    <td className="text-end fw-bold align-middle">
                                                                        ${parseFloat(v.total).toLocaleString()}
                                                                    </td>
                                                                    {detalle.activa && (
                                                                        <td className="text-center align-middle">
                                                                            {!v.anulada && (
                                                                                <button
                                                                                    className="btn btn-sm btn-outline-danger"
                                                                                    style={{ textDecoration: 'none' }}
                                                                                    onClick={() => anularVenta(v.id)}
                                                                                >
                                                                                    Anular
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={cerrarModal}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReports;
