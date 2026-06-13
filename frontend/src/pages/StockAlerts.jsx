import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const StockAlerts = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const esAdmin = user?.rol === 'ADMIN';

    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroSede, setFiltroSede] = useState('');
    const [sedes, setSedes] = useState([]);
    const [editando, setEditando] = useState({}); // { [inventarioId]: valor del input }
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        if (esAdmin) {
            api.get('inventario/sedes/').then(res => setSedes(res.data));
        }
    }, [esAdmin]);

    const cargarAlertas = useCallback(async () => {
        setLoading(true);
        try {
            let url = 'inventario/alertas-stock/';
            if (filtroSede) url += `?sede_id=${filtroSede}`;
            const res = await api.get(url);
            setAlertas(res.data);
        } catch (error) {
            console.error("Error cargando alertas", error);
        } finally {
            setLoading(false);
        }
    }, [filtroSede]);

    useEffect(() => {
        cargarAlertas();
    }, [cargarAlertas]);

    const guardarMinimo = async (item) => {
        const nuevoValor = editando[item.id];
        if (nuevoValor === undefined || nuevoValor === '' || parseInt(nuevoValor) === item.stock_minimo) {
            setEditando(prev => { const copia = { ...prev }; delete copia[item.id]; return copia; });
            return;
        }
        try {
            await api.patch(`inventario/inventarios/${item.id}/`, { stock_minimo: parseInt(nuevoValor) });
            setMensaje({ tipo: 'success', text: `Mínimo de "${item.producto_nombre}" actualizado.` });
            setEditando(prev => { const copia = { ...prev }; delete copia[item.id]; return copia; });
            cargarAlertas();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.error || "No se pudo actualizar el mínimo.";
            setMensaje({ tipo: 'danger', text: msg });
        }
    };

    if (loading && alertas.length === 0) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

    return (
        <div className="container mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>⚠️ Productos por Reponer</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            {mensaje && (
                <div className={`alert alert-${mensaje.tipo} alert-dismissible fade show`}>
                    {mensaje.text}
                    <button type="button" className="btn-close" onClick={() => setMensaje(null)}></button>
                </div>
            )}

            {esAdmin && (
                <div className="card shadow-sm mb-4">
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label fw-bold">Filtrar por Sede</label>
                                <select
                                    className="form-select"
                                    value={filtroSede}
                                    onChange={(e) => setFiltroSede(e.target.value)}
                                >
                                    <option value="">Todas las Sedes</option>
                                    {sedes.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card shadow">
                <div className="card-body p-0">
                    <div className="table-responsive" style={{ maxHeight: '600px' }}>
                        <table className="table table-hover table-striped align-middle mb-0">
                            <thead className="table-dark sticky-top">
                                <tr>
                                    <th>Sede</th>
                                    <th>Producto</th>
                                    <th>Código</th>
                                    <th className="text-center">Stock Actual</th>
                                    <th className="text-center">Mínimo</th>
                                    <th>Ubicación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alertas.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-5">
                                            🎉 No hay productos por debajo del mínimo.
                                        </td>
                                    </tr>
                                ) : (
                                    alertas.map(item => (
                                        <tr key={item.id}>
                                            <td><span className="badge bg-secondary">{item.sede_nombre}</span></td>
                                            <td className="fw-bold">{item.producto_nombre}</td>
                                            <td className="text-muted small">{item.codigo_interno}</td>
                                            <td className="text-center fs-5">
                                                <span className={`badge ${item.stock_actual === 0 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                                    {item.stock_actual}
                                                </span>
                                            </td>
                                            <td className="text-center" style={{ width: '120px' }}>
                                                {esAdmin ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="form-control form-control-sm text-center"
                                                        value={editando[item.id] !== undefined ? editando[item.id] : item.stock_minimo}
                                                        onChange={(e) => setEditando(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        onBlur={() => guardarMinimo(item)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                                    />
                                                ) : (
                                                    item.stock_minimo
                                                )}
                                            </td>
                                            <td className="text-muted small">{item.ubicacion || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockAlerts;
