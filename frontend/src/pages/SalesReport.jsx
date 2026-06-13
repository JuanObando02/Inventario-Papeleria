import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

// Fechas en hora LOCAL (toISOString usa UTC y cambia de día en la noche)
const formatoFecha = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const hoyISO = () => formatoFecha(new Date());

const inicioSemanaISO = () => {
    const d = new Date();
    const dia = d.getDay(); // 0 = domingo
    const diff = dia === 0 ? 6 : dia - 1; // lunes como inicio
    d.setDate(d.getDate() - diff);
    return formatoFecha(d);
};

const inicioMesISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const SalesReport = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [desde, setDesde] = useState(hoyISO());
    const [hasta, setHasta] = useState(hoyISO());
    const [filtroSede, setFiltroSede] = useState('');
    const [sedes, setSedes] = useState([]);

    const [datos, setDatos] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ordenarPor, setOrdenarPor] = useState('ingresos'); // cantidad | ingresos | utilidad

    useEffect(() => {
        if (user?.rol !== 'ADMIN') {
            navigate('/menu');
            return;
        }
        api.get('inventario/sedes/').then(res => setSedes(res.data));
    }, [user, navigate]);

    const cargarReporte = useCallback(async () => {
        setLoading(true);
        try {
            let url = `ventas/admin/reportes/ventas/?desde=${desde}&hasta=${hasta}`;
            if (filtroSede) url += `&sede_id=${filtroSede}`;
            const res = await api.get(url);
            setDatos(res.data);
        } catch (error) {
            console.error("Error cargando reporte", error);
            alert(error.response?.data?.error || "Error cargando el reporte.");
        } finally {
            setLoading(false);
        }
    }, [desde, hasta, filtroSede]);

    useEffect(() => {
        cargarReporte();
    }, [cargarReporte]);

    const aplicarPreset = (preset) => {
        if (preset === 'hoy') { setDesde(hoyISO()); setHasta(hoyISO()); }
        if (preset === 'semana') { setDesde(inicioSemanaISO()); setHasta(hoyISO()); }
        if (preset === 'mes') { setDesde(inicioMesISO()); setHasta(hoyISO()); }
    };

    const productosOrdenados = [...(datos?.productos || [])].sort(
        (a, b) => parseFloat(b[ordenarPor]) - parseFloat(a[ordenarPor])
    );

    const thOrdenable = (campo, label) => (
        <th
            className="text-end"
            style={{ cursor: 'pointer' }}
            onClick={() => setOrdenarPor(campo)}
            title="Click para ordenar"
        >
            {label} {ordenarPor === campo ? '▼' : ''}
        </th>
    );

    return (
        <div className="container mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>📈 Reporte de Ventas</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            {/* FILTROS */}
            <div className="card shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label fw-bold">Desde</label>
                            <input type="date" className="form-control" value={desde} onChange={e => setDesde(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-bold">Hasta</label>
                            <input type="date" className="form-control" value={hasta} onChange={e => setHasta(e.target.value)} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-bold">Sede</label>
                            <select className="form-select" value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
                                <option value="">Todas las Sedes</option>
                                {sedes.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <div className="btn-group w-100">
                                <button className="btn btn-outline-primary" onClick={() => aplicarPreset('hoy')}>Hoy</button>
                                <button className="btn btn-outline-primary" onClick={() => aplicarPreset('semana')}>Semana</button>
                                <button className="btn btn-outline-primary" onClick={() => aplicarPreset('mes')}>Mes</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center mt-5"><div className="spinner-border"></div></div>
            ) : datos && (
                <>
                    {/* RESUMEN */}
                    <div className="row g-3 mb-4">
                        <div className="col-md-4">
                            <div className="card text-white bg-primary h-100">
                                <div className="card-header">Total Vendido</div>
                                <div className="card-body">
                                    <h3 className="card-title display-6">${parseFloat(datos.resumen.total_vendido).toLocaleString()}</h3>
                                    <p className="card-text small">{datos.resumen.numero_ventas} ventas en el periodo</p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card text-white bg-success h-100">
                                <div className="card-header">Utilidad Estimada</div>
                                <div className="card-body">
                                    <h3 className="card-title display-6">${parseFloat(datos.resumen.utilidad_total).toLocaleString()}</h3>
                                    <p className="card-text small">Ingresos menos costo de los productos</p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card h-100">
                                <div className="card-header fw-bold">Por Método de Pago</div>
                                <ul className="list-group list-group-flush">
                                    {datos.por_metodo.length === 0 ? (
                                        <li className="list-group-item text-muted">Sin ventas</li>
                                    ) : (
                                        datos.por_metodo.map(m => (
                                            <li key={m.metodo_pago} className="list-group-item d-flex justify-content-between">
                                                <span><span className="badge bg-secondary me-2">{m.metodo_pago}</span>{m.numero} ventas</span>
                                                <strong>${parseFloat(m.total).toLocaleString()}</strong>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* TABLA POR PRODUCTO */}
                    <div className="card shadow">
                        <div className="card-header bg-white fw-bold">Ventas por Producto</div>
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                <table className="table table-hover table-striped align-middle mb-0">
                                    <thead className="table-dark sticky-top">
                                        <tr>
                                            <th>Producto</th>
                                            <th>Código</th>
                                            {thOrdenable('cantidad', 'Cantidad')}
                                            {thOrdenable('ingresos', 'Ingresos')}
                                            {thOrdenable('utilidad', 'Utilidad')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productosOrdenados.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center py-5">No hubo ventas en el periodo seleccionado.</td>
                                            </tr>
                                        ) : (
                                            productosOrdenados.map(p => (
                                                <tr key={p.producto_id}>
                                                    <td className="fw-bold">{p.nombre}</td>
                                                    <td className="text-muted small">{p.codigo_interno}</td>
                                                    <td className="text-end">{p.cantidad.toLocaleString()}</td>
                                                    <td className="text-end fw-bold text-primary">${parseFloat(p.ingresos).toLocaleString()}</td>
                                                    <td className={`text-end fw-bold ${parseFloat(p.utilidad) >= 0 ? 'text-success' : 'text-danger'}`}>
                                                        ${parseFloat(p.utilidad).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SalesReport;
