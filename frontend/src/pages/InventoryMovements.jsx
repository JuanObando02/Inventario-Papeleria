import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const InventoryMovements = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Estado del Formulario
    const [tipo, setTipo] = useState('ENTRADA');
    const [producto, setProducto] = useState(null); // Objeto producto seleccionado
    const [cantidad, setCantidad] = useState('');
    const [sedeOrigen, setSedeOrigen] = useState('');
    const [sedeDestino, setSedeDestino] = useState('');
    const [motivo, setMonto] = useState('');
    // Nuevo estado para el Costo Unitario
    const [costoUnitario, setCostoUnitario] = useState('');

    // Datos Auxiliares
    const [sedes, setSedes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState([]);

    // UI Helpers
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [pestana, setPestana] = useState('registrar'); // 'registrar' | 'historial'

    // Estado del Historial
    const [movimientos, setMovimientos] = useState([]);
    const [totalMovimientos, setTotalMovimientos] = useState(0);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [filtroQ, setFiltroQ] = useState('');
    const [filtroSede, setFiltroSede] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroDesde, setFiltroDesde] = useState('');
    const [filtroHasta, setFiltroHasta] = useState('');

    const LIMITE = 25;

    const construirUrlHistorial = (offset) => {
        let url = `inventario/movimientos/?limit=${LIMITE}&offset=${offset}`;
        if (filtroQ.trim()) url += `&q=${encodeURIComponent(filtroQ.trim())}`;
        if (filtroSede) url += `&sede_id=${filtroSede}`;
        if (filtroTipo) url += `&tipo=${filtroTipo}`;
        if (filtroDesde) url += `&desde=${filtroDesde}`;
        if (filtroHasta) url += `&hasta=${filtroHasta}`;
        return url;
    };

    // Cargar historial (con debounce para el texto)
    useEffect(() => {
        if (pestana !== 'historial') return;
        const timeoutId = setTimeout(async () => {
            setLoadingHistorial(true);
            try {
                const res = await api.get(construirUrlHistorial(0));
                setMovimientos(res.data.results);
                setTotalMovimientos(res.data.count);
            } catch (error) {
                console.error("Error cargando historial", error);
            } finally {
                setLoadingHistorial(false);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pestana, filtroQ, filtroSede, filtroTipo, filtroDesde, filtroHasta]);

    const cargarMas = async () => {
        setLoadingHistorial(true);
        try {
            const res = await api.get(construirUrlHistorial(movimientos.length));
            setMovimientos([...movimientos, ...res.data.results]);
            setTotalMovimientos(res.data.count);
        } catch (error) {
            console.error("Error cargando más movimientos", error);
        } finally {
            setLoadingHistorial(false);
        }
    };

    const badgeTipo = (t) => {
        const colores = { ENTRADA: 'bg-success', SALIDA: 'bg-danger', TRASLADO: 'bg-primary', VENTA: 'bg-secondary' };
        return <span className={`badge ${colores[t] || 'bg-dark'}`}>{t}</span>;
    };

    // 1. Cargar Sedes
    useEffect(() => {
        if (user?.rol !== 'ADMIN') {
            navigate('/menu');
            return;
        }
        api.get('inventario/sedes/').then(res => setSedes(res.data));
    }, [user, navigate]);

    // 2. Buscador de Productos (mágia de PriceCheck)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (busqueda.length > 2) {
                api.get(`inventario/buscar-publico/?q=${busqueda}`)
                    .then(res => setResultados(res.data))
                    .catch(console.error);
            } else {
                setResultados([]);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [busqueda]);

    const seleccionarProducto = (prod) => {
        if (prod.tipo === 'SERVICIO' || prod.tipo === 'ANCHETA') {
            alert(`🚫 No puedes gestionar inventario de un ${prod.tipo}. Estos tipos de producto no manejan stock físico directo.`);
            return;
        }
        setProducto(prod);

        // Si es una entrada, pre-llenamos el costo con el actual
        if (tipo === 'ENTRADA') {
            setCostoUnitario(prod.precio_venta); // Ojo: ¿precio_venta o precio_costo? La API POS devuelve precio_venta.
            // El endpoint 'inventario/buscar-publico/' usa ProductoPOSSerializer que NO devuelve precio_costo por seguridad?
            // Vamos a revisar el serializer. Si no lo devuelve, tocará dejarlo vacio o pedirlo.
            // Revisando ProductoPOSSerializer en serializers.py... solo devuelve: 'id', 'nombre', 'precio_venta', 'codigo_barras', 'codigo_interno', 'tipo', 'stock'
            // Entonces por defecto lo dejamos vacío para que el usuario lo ingrese, o 0.
            setCostoUnitario('');
        }

        setBusqueda('');
        setResultados([]);
    };

    // 3. Enviar Formulario
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMensaje(null);

        if (!producto) return alert("Selecciona un producto");
        if (!sedeOrigen) return alert("Selecciona Sede Origen o donde ocurre el movimiento");
        if (tipo === 'TRASLADO' && !sedeDestino) return alert("Selecciona Sede Destino");

        const data = {
            tipo,
            producto: producto.id,
            cantidad: parseInt(cantidad),
            sede_origen: parseInt(sedeOrigen),
            motivo
        };

        if (tipo === 'TRASLADO') {
            data.sede_destino = parseInt(sedeDestino);
        }

        // Si es Entrada, agregamos el costo unitario
        if (tipo === 'ENTRADA' && costoUnitario) {
            data.costo_unitario = parseFloat(costoUnitario);
        }

        try {
            await api.post('inventario/movimientos/crear/', data);
            setMensaje({ tipo: 'success', text: '✅ Movimiento registrado con éxito' });
            // Reset parcial
            setCantidad('');
            setMonto('');
            setCostoUnitario('');
            setProducto(null);
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || "Error al procesar movimiento";
            setMensaje({ tipo: 'danger', text: `❌ ${JSON.stringify(errorMsg)}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>📦 Gestión de Inventario</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            {/* PESTAÑAS */}
            <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                    <button className={`nav-link ${pestana === 'registrar' ? 'active' : ''}`} onClick={() => setPestana('registrar')}>
                        📝 Registrar
                    </button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link ${pestana === 'historial' ? 'active' : ''}`} onClick={() => setPestana('historial')}>
                        📜 Historial
                    </button>
                </li>
            </ul>

            {pestana === 'historial' && (
                <>
                    {/* FILTROS HISTORIAL */}
                    <div className="card shadow-sm mb-3">
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    <label className="form-label fw-bold">Producto</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="🔍 Nombre o código..."
                                        value={filtroQ}
                                        onChange={(e) => setFiltroQ(e.target.value)}
                                    />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label fw-bold">Sede</label>
                                    <select className="form-select" value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
                                        <option value="">Todas</option>
                                        {sedes.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label fw-bold">Tipo</label>
                                    <select className="form-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                                        <option value="">Todos</option>
                                        <option value="ENTRADA">Entrada</option>
                                        <option value="SALIDA">Salida</option>
                                        <option value="TRASLADO">Traslado</option>
                                        <option value="VENTA">Venta</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label fw-bold">Desde</label>
                                    <input type="date" className="form-control" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label fw-bold">Hasta</label>
                                    <input type="date" className="form-control" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABLA HISTORIAL */}
                    <div className="card shadow">
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                <table className="table table-hover table-striped align-middle mb-0">
                                    <thead className="table-dark sticky-top">
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Producto</th>
                                            <th className="text-center">Cant.</th>
                                            <th>Origen</th>
                                            <th>Destino</th>
                                            <th>Usuario</th>
                                            <th>Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movimientos.length === 0 && !loadingHistorial ? (
                                            <tr>
                                                <td colSpan="8" className="text-center py-5">No hay movimientos con estos filtros.</td>
                                            </tr>
                                        ) : (
                                            movimientos.map(m => (
                                                <tr key={m.id}>
                                                    <td className="small">{new Date(m.fecha).toLocaleString()}</td>
                                                    <td>{badgeTipo(m.tipo)}</td>
                                                    <td className="fw-bold">{m.producto_nombre} <small className="text-muted">({m.codigo_interno})</small></td>
                                                    <td className="text-center">{m.cantidad}</td>
                                                    <td><span className="badge bg-light text-dark border">{m.sede_origen_nombre}</span></td>
                                                    <td>{m.sede_destino_nombre ? <span className="badge bg-light text-dark border">{m.sede_destino_nombre}</span> : '—'}</td>
                                                    <td className="small">{m.usuario_nombre}</td>
                                                    <td className="small text-muted">{m.motivo}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="card-footer text-center">
                            {loadingHistorial ? (
                                <div className="spinner-border spinner-border-sm"></div>
                            ) : movimientos.length < totalMovimientos ? (
                                <button className="btn btn-outline-primary btn-sm" onClick={cargarMas}>
                                    Cargar más ({movimientos.length} de {totalMovimientos})
                                </button>
                            ) : (
                                <span className="text-muted small">{totalMovimientos} movimientos en total</span>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="card shadow" style={pestana === 'registrar' ? {} : { display: 'none' }}>
                <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">Registrar Movimiento</h5>
                </div>
                <div className="card-body">

                    {mensaje && (
                        <div className={`alert alert-${mensaje.tipo} alert-dismissible fade show`}>
                            {mensaje.text}
                            <button type="button" className="btn-close" onClick={() => setMensaje(null)}></button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>

                        {/* TIPO DE MOVIMIENTO */}
                        <div className="mb-3">
                            <label className="form-label fw-bold">Tipo de Movimiento</label>
                            <div className="d-flex gap-3" role="group">
                                <div className="flex-fill">
                                    <input type="radio" className="btn-check" name="btnradio" id="btnEntrada"
                                        autoComplete="off" checked={tipo === 'ENTRADA'} onChange={() => setTipo('ENTRADA')} />
                                    <label className={`btn w-100 py-2 fw-bold ${tipo === 'ENTRADA' ? 'btn-success shadow-sm' : 'btn-outline-success'}`} htmlFor="btnEntrada">
                                        📥 Entrada (Compra)
                                    </label>
                                </div>

                                <div className="flex-fill">
                                    <input type="radio" className="btn-check" name="btnradio" id="btnSalida"
                                        autoComplete="off" checked={tipo === 'SALIDA'} onChange={() => setTipo('SALIDA')} />
                                    <label className={`btn w-100 py-2 fw-bold ${tipo === 'SALIDA' ? 'btn-danger shadow-sm' : 'btn-outline-danger'}`} htmlFor="btnSalida">
                                        📤 Salida (Baja/Pérdida)
                                    </label>
                                </div>

                                <div className="flex-fill">
                                    <input type="radio" className="btn-check" name="btnradio" id="btnTraslado"
                                        autoComplete="off" checked={tipo === 'TRASLADO'} onChange={() => setTipo('TRASLADO')} />
                                    <label className={`btn w-100 py-2 fw-bold ${tipo === 'TRASLADO' ? 'btn-primary shadow-sm' : 'btn-outline-primary'}`} htmlFor="btnTraslado">
                                        🚚 Traslado entre Sedes
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* PRODUCTO SEARCH */}
                        <div className="mb-3 position-relative">
                            <label className="form-label fw-bold">Producto</label>
                            {producto ? (
                                <div className="input-group">
                                    <span className="form-control bg-light fw-bold text-success">{producto.nombre}</span>
                                    <button className="btn btn-outline-danger" type="button" onClick={() => setProducto(null)}>&times;</button>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="🔍 Buscar por nombre o código..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                />
                            )}

                            {/* RESULTADOS SEARCH DROPDOWN */}
                            {resultados.length > 0 && !producto && (
                                <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 1000 }}>
                                    {resultados.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className="list-group-item list-group-item-action"
                                            onClick={() => seleccionarProducto(p)}
                                        >
                                            <strong>{p.nombre}</strong> <small className="text-muted">({p.codigo_interno})</small>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="row">
                            {/* SEDE ORIGEN */}
                            <div className="col-md-6 mb-3">
                                <label className="form-label fw-bold">
                                    {tipo === 'ENTRADA' ? 'Sede donde ingresa el stock' : 'Sede de Origen (Donde sale)'}
                                </label>
                                <select
                                    className="form-select"
                                    value={sedeOrigen}
                                    onChange={(e) => setSedeOrigen(e.target.value)}
                                    required
                                >
                                    <option value="">Seleccione Sede...</option>
                                    {sedes.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* SEDE DESTINO (SOLO TRASLADOS) */}
                            {tipo === 'TRASLADO' && (
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-bold text-primary">Sede Destino (Donde entra)</label>
                                    <select
                                        className="form-select border-primary"
                                        value={sedeDestino}
                                        onChange={(e) => setSedeDestino(e.target.value)}
                                        required
                                    >
                                        <option value="">Seleccione Destino...</option>
                                        {sedes.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label fw-bold">Cantidad</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={cantidad}
                                    onChange={(e) => setCantidad(e.target.value)}
                                    min="1"
                                    required
                                />
                            </div>

                            {/* COSTO UNITARIO (SOLO ENTRADAS) */}
                            {tipo === 'ENTRADA' && (
                                <div className="col-md-4 mb-3">
                                    <label className="form-label fw-bold text-success">Costo Unitario (Compra)</label>
                                    <div className="input-group">
                                        <span className="input-group-text">$</span>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={costoUnitario}
                                            onChange={(e) => setCostoUnitario(e.target.value)}
                                            placeholder="Costo actual..."
                                        />
                                    </div>
                                    <div className="form-text">Dejar vacío para mantener el promedio actual.</div>
                                </div>
                            )}

                            <div className="col-md-8 mb-3">
                                <label className="form-label fw-bold">Motivo / Referencia</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: Factura compra #123, Error de conteo..."
                                    value={motivo}
                                    onChange={(e) => setMonto(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="d-grid mt-3">
                            <button type="submit" className="btn btn-dark btn-lg" disabled={loading}>
                                {loading ? 'Procesando...' : '💾 Registrar Movimiento'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default InventoryMovements;
