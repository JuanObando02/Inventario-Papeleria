import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const AdminInventory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [datos, setDatos] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filtroSede, setFiltroSede] = useState('');
    const [sedes, setSedes] = useState([]);
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        if (user?.rol !== 'ADMIN') {
            navigate('/menu');
        }
        api.get('inventario/sedes/').then(res => setSedes(res.data));
    }, [user, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = 'inventario/admin/inventario-global/';
                if (filtroSede) url += `?sede_id=${filtroSede}`;

                const res = await api.get(url);
                setDatos(res.data);
            } catch (error) {
                console.error("Error cargando inventario", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filtroSede]);

    // Filtrado en cliente por nombre (ya que tenemos la lista completa en memoria)
    const itemsFiltrados = datos?.inventario.filter(i =>
        i.producto_nombre.toLowerCase().includes(busqueda.toLowerCase())
    ) || [];

    if (loading && !datos) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

    return (
        <div className="container mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>🏢 Panel Global de Inventario</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            {/* TARJETAS DE RESUMEN */}
            {datos?.resumen && (
                <div className="row g-3 mb-4">
                    <div className="col-md-4">
                        <div className="card text-white bg-primary h-100">
                            <div className="card-header">Unidades Totales</div>
                            <div className="card-body">
                                <h3 className="card-title display-6">
                                    {(datos.resumen.total_items || 0).toLocaleString()} <span className="fs-6">unds</span>
                                </h3>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card text-white bg-success h-100">
                            <div className="card-header">Valor Total (Costo)</div>
                            <div className="card-body">
                                <h3 className="card-title display-6">
                                    ${(datos.resumen.valor_total_costo || 0).toLocaleString()}
                                </h3>
                                <p className="card-text small">Inversión acumulada en inventario</p>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card text-dark bg-info h-100 bg-opacity-25">
                            <div className="card-header">Valor Potencial (Venta)</div>
                            <div className="card-body">
                                <h3 className="card-title display-6">
                                    ${(datos.resumen.valor_total_venta || 0).toLocaleString()}
                                </h3>
                                <p className="card-text small">Ingreso estimado si se vende todo</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FILTROS */}
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
                        <div className="col-md-8">
                            <label className="form-label fw-bold">Buscar Producto</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Escribe el nombre del producto..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLA */}
            <div className="card shadow">
                <div className="card-body p-0">
                    <div className="table-responsive" style={{ maxHeight: '600px' }}>
                        <table className="table table-hover table-striped align-middle mb-0">
                            <thead className="table-dark sticky-top">
                                <tr>
                                    <th>Sede</th>
                                    <th>Producto</th>
                                    <th className="text-center">Stock</th>
                                    <th className="text-end">Costo Unit.</th>
                                    <th className="text-end">Precio Venta</th>
                                    <th className="text-end">Total Costo</th>
                                    <th className="text-end">Total Venta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {itemsFiltrados.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5">
                                            No se encontraron productos.
                                            {filtroSede ? "" : " (¿Quizás no hay stock registrado?)"}
                                        </td>
                                    </tr>
                                ) : (
                                    itemsFiltrados.map(item => (
                                        <tr key={item.id}>
                                            <td>
                                                <span className={`badge ${item.sede_nombre === 'Todas las Sedes' ? 'bg-info' : 'bg-secondary'}`}>
                                                    {item.sede_nombre}
                                                </span>
                                            </td>
                                            <td className="fw-bold">{item.producto_nombre}</td>
                                            <td className="text-center fs-5">
                                                {item.producto_tipo === 'SERVICIO' ? (
                                                    <span className="badge bg-info text-dark">
                                                        SERVICIO
                                                    </span>
                                                ) : (
                                                    <span className={`badge ${item.stock_actual < 5 ? 'bg-danger' : 'bg-light text-dark border'}`}>
                                                        {item.stock_actual}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-end text-muted small">${parseFloat(item.producto_costo).toLocaleString()}</td>
                                            <td className="text-end text-muted small">${parseFloat(item.producto_precio).toLocaleString()}</td>
                                            <td className="text-end fw-bold text-success">${item.valor_total_costo.toLocaleString()}</td>
                                            <td className="text-end fw-bold text-primary">${item.valor_total_venta.toLocaleString()}</td>
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

export default AdminInventory;
