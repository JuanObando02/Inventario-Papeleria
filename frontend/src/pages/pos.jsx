import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const POS = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // ESTADOS
    const [productos, setProductos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [carrito, setCarrito] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [sesionCajaId, setSesionCajaId] = useState(null);
    const [sedeSesion, setSedeSesion] = useState(null);
    const [sedeVisual, setSedeVisual] = useState(null);
    const [listaSedes, setListaSedes] = useState([]);

    const [metodoPago, setMetodoPago] = useState('EFECTIVO');

    // Filtros
    const [filtroTipo, setFiltroTipo] = useState('TODOS');
    const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
    const [listaCategorias, setListaCategorias] = useState([]);

    // Estados para Ancheta Dinámica
    const [anchetaIndex, setAnchetaIndex] = useState(null); // Índice del item en carrito
    const [busquedaComp, setBusquedaComp] = useState('');
    const [mostrarModal, setMostrarModal] = useState(false);

    // 1. CARGA INICIAL
    useEffect(() => {
        const inicializarPOS = async () => {
            try {
                // 1. Primero verificamos estado de caja
                const resCaja = await api.get('ventas/estado-caja/');

                if (!resCaja.data.abierta) {
                    alert("⚠️ No tienes una caja abierta. Serás redirigido a apertura.");
                    navigate('/apertura-caja');
                    return;
                }

                setSesionCajaId(resCaja.data.id);
                setSedeSesion(resCaja.data.sede_id);
                setSedeVisual(resCaja.data.sede_id); // Por defecto vemos lo de la caja

                // 2. Cargar Productos de esa sede
                cargarProductos(resCaja.data.sede_id);

                // 3. Si es Admin, cargamos la lista de Sedes para el selector
                if (user?.rol === 'ADMIN') {
                    const resSedes = await api.get('inventario/sedes/');
                    setListaSedes(resSedes.data);
                }

                // 4. Cargar Categorías para el filtro
                const resCats = await api.get('inventario/categorias/');
                setListaCategorias(resCats.data);

            } catch (error) {
                console.error("Error cargando datos:", error);
                alert("Error de conexión. Intenta recargar.");
            } finally {
                setCargando(false);
            }
        };
        inicializarPOS();
    }, [navigate, user]);

    const cargarProductos = async (idSede) => {
        try {
            const res = await api.get(`inventario/listar-pos/?sede_id=${idSede}`);
            setProductos(res.data);
        } catch (error) {
            console.error("Error cargando productos", error);
        }
    };

    const cambiarSedeVisual = (nuevoId) => {
        setSedeVisual(parseInt(nuevoId));
        setCarrito([]); // Limpiamos carrito para evitar mezclar stocks
        cargarProductos(nuevoId);
    };

    // 2. FILTROS
    const productosFiltrados = productos.filter(p => {
        // Filtro por búsqueda (nombre o códigos)
        const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            (p.codigo_barras && p.codigo_barras.includes(busqueda)) ||
            (p.codigo_interno && p.codigo_interno.includes(busqueda));

        // Filtro por tipo
        const matchTipo = filtroTipo === 'TODOS' || p.tipo === filtroTipo;

        // Filtro por categoría
        const matchCategoria = filtroCategoria === 'TODAS' || p.categoria === parseInt(filtroCategoria);

        return matchBusqueda && matchTipo && matchCategoria;
    });

    // 3. LOGICA CARRITO
    const agregarAlCarrito = (producto) => {
        const existeIndex = carrito.findIndex(item => item.id === producto.id);

        // Validar Stock
        const esServicioOAncheta = producto.tipo === 'SERVICIO' || producto.tipo === 'ANCHETA';
        if (!esServicioOAncheta && producto.stock <= 0) {
            alert("Producto sin stock disponible");
            return;
        }

        if (existeIndex !== -1) {
            const existe = carrito[existeIndex];
            if (!esServicioOAncheta && existe.cantidad >= producto.stock) {
                alert("No hay más stock disponible");
                return;
            }
            const nuevoCarrito = [...carrito];
            nuevoCarrito[existeIndex].cantidad += 1;
            setCarrito(nuevoCarrito);
        } else {
            const nuevoItem = {
                ...producto,
                cantidad: 1,
                precio_base_ancheta: producto.tipo === 'ANCHETA' ? parseFloat(producto.precio_venta) : 0,
                margen_ancheta: 0, // Porcentaje de comisión
                precio_servicio_ancheta: producto.tipo === 'ANCHETA' ? parseFloat(producto.precio_venta) : 0, // El valor que tendrá el "servicio" de la ancheta
                componentes: [],
                kit_uuid: producto.tipo === 'ANCHETA' ? crypto.randomUUID() : null
            };
            const nuevoCarrito = [...carrito, nuevoItem];
            setCarrito(nuevoCarrito);

            // Si es Ancheta, abrir editor inmediatamente
            if (producto.tipo === 'ANCHETA') {
                setAnchetaIndex(nuevoCarrito.length - 1);
                setMostrarModal(true);
            }
        }
    };

    const recalcularPreciosAncheta = (item) => {
        const subtotalComponentes = item.componentes.reduce((acc, c) => acc + (c.precio_venta * c.cantidad), 0);

        // El valor del servicio es: Precio Base + (Subtotal Componentes * Margen / 100)
        const valorComision = Math.round(subtotalComponentes * (item.margen_ancheta / 100));
        item.precio_servicio_ancheta = item.precio_base_ancheta + valorComision;

        // El precio total visual de la ancheta para el carrito es: Componentes + Servicio
        item.precio_venta = subtotalComponentes + item.precio_servicio_ancheta;
    };

    const actualizarComponente = (prodComp, operacion) => {
        if (anchetaIndex === null) return;

        const nuevoCarrito = [...carrito];
        const item = nuevoCarrito[anchetaIndex];
        const indexComp = item.componentes.findIndex(c => c.producto_id === prodComp.id);

        if (operacion === 'SUMAR') {
            if (prodComp.stock <= 0) return alert("Componente sin stock");
            if (indexComp !== -1) {
                item.componentes[indexComp].cantidad += 1;
            } else {
                item.componentes.push({
                    producto_id: prodComp.id,
                    nombre: prodComp.nombre,
                    precio_venta: parseFloat(prodComp.precio_venta),
                    cantidad: 1
                });
            }
        } else {
            if (indexComp !== -1) {
                if (item.componentes[indexComp].cantidad > 1) {
                    item.componentes[indexComp].cantidad -= 1;
                } else {
                    item.componentes.splice(indexComp, 1);
                }
            }
        }

        recalcularPreciosAncheta(item);
        setCarrito(nuevoCarrito);
    };

    const actualizarMargenAncheta = (nuevoMargen) => {
        if (anchetaIndex === null) return;
        const nuevoCarrito = [...carrito];
        const item = nuevoCarrito[anchetaIndex];

        item.margen_ancheta = parseFloat(nuevoMargen) || 0;

        recalcularPreciosAncheta(item);
        setCarrito(nuevoCarrito);
    };

    const eliminarDelCarrito = (id) => {
        setCarrito(carrito.filter(item => item.id !== id));
    };

    const totalVenta = carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0);

    // 4. LOGICA DE COBRO (CONECTADA AL BACKEND)
    const handleCobrar = async () => {
        if (!sesionCajaId) return alert("❌ Error crítico: No se detectó sesión de caja.");
        if (carrito.length === 0) return alert("El carrito está vacío.");

        if (sedeVisual !== sedeSesion) {
            return alert("⚠️ Estás visualizando inventario de OTRA Sede.\n\nPara vender, debes estar en la misma sede donde abriste caja.\nVuelve a seleccionar tu Sede original.");
        }

        // Aplanar estructura Anchetas -> Backend espera lista plana con UUIDs
        let detallesPayload = [];

        carrito.forEach(item => {
            if (item.tipo === 'ANCHETA') {
                // 1. Agregar el "Servicio de Armado" / Padre
                detallesPayload.push({
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_servicio_ancheta, // Valor dinámico del servicio
                    kit_uuid: item.kit_uuid
                });

                // 2. Agregar sus componentes (Item plano con mismo UUID)
                item.componentes.forEach(comp => {
                    detallesPayload.push({
                        producto_id: comp.producto_id,
                        cantidad: comp.cantidad * item.cantidad, // Multiplicar por cant de anchetas
                        precio_unitario: comp.precio_venta,
                        kit_uuid: item.kit_uuid
                    });
                });

            } else {
                // Producto normal
                detallesPayload.push({
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_venta,
                    kit_uuid: null
                });
            }
        });

        const ventaData = {
            sesion_caja: sesionCajaId,
            metodo_pago: metodoPago,
            detalles: detallesPayload
        };

        try {
            const response = await api.post('ventas/crear/', ventaData);

            if (response.status === 201) {
                alert(`✅ ¡Venta registrada! Total: $${totalVenta.toLocaleString()}`);
                setCarrito([]); // Limpiar carrito

                // Recargar inventario
                cargarProductos(sedeVisual);
            }
        } catch (error) {
            console.error(error);
            const mensaje = error.response?.data?.error || "Error al procesar la venta.";
            alert("❌ " + mensaje);
        }
    };

    // --- RENDERIZADO (HTML) ---
    return (
        <div className="container-fluid vh-100 d-flex flex-column overflow-hidden">
            {/* BARRA SUPERIOR */}
            <nav className="navbar navbar-dark bg-primary px-3 shadow-sm">
                <span className="navbar-brand mb-0 h1">📦 Punto de Venta</span>
                <div className="d-flex align-items-center gap-3">

                    {/* SELECTOR DE SEDE (ADMIN) */}
                    {user?.rol === 'ADMIN' && listaSedes.length > 0 && (
                        <select
                            className={`form-select form-select-sm ${sedeVisual !== sedeSesion ? 'bg-warning text-dark fw-bold' : 'bg-light text-dark'}`}
                            value={sedeVisual || ''}
                            onChange={(e) => cambiarSedeVisual(e.target.value)}
                            style={{ maxWidth: '200px' }}
                        >
                            {listaSedes.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.nombre} {s.id === sedeSesion ? '(CAJA)' : ''}
                                </option>
                            ))}
                        </select>
                    )}

                    {sesionCajaId && <span className="badge bg-success">Caja #{sesionCajaId}</span>}
                    <span className="text-white">| {user?.username}</span>
                    <button className="btn btn-sm btn-danger" onClick={() => navigate('/menu')}>Volver al Menú</button>
                </div>
            </nav>

            <div className="row flex-grow-1 overflow-hidden">

                {/* IZQUIERDA: PRODUCTOS */}
                <div className="col-md-8 p-4 bg-light overflow-auto h-100">
                    <div className="mb-4">
                        <input
                            type="text"
                            className="form-control form-control-lg shadow-sm"
                            style={{ borderRadius: '15px', border: 'none' }}
                            placeholder="🔍 Buscar producto por nombre o código..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* FILTROS AVANZADOS */}
                    <div className="row g-2 mb-4">
                        <div className="col-lg-7 col-md-12">
                            <label className="form-label small fw-bold text-muted mb-1 px-2">Filtrar por Tipo</label>
                            <div className="d-flex gap-2" role="group">
                                {[
                                    { id: 'TODOS', label: 'Todo', icon: '🌐' },
                                    { id: 'FISICO', label: 'Físicos', icon: '📦' },
                                    { id: 'ANCHETA', label: 'Anchetas', icon: '🎁' },
                                    { id: 'SERVICIO', label: 'Servicios', icon: '⚙️' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        className={`btn btn-sm flex-fill py-2 fw-bold border-0 shadow-sm transition-all ${filtroTipo === t.id ? 'btn-dark text-white' : 'btn-white bg-white text-muted'}`}
                                        style={{ borderRadius: '12px' }}
                                        onClick={() => setFiltroTipo(t.id)}
                                    >
                                        <span className="me-1">{t.icon}</span> {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-lg-5 col-md-12">
                            <label className="form-label small fw-bold text-muted mb-1 px-2">Categoría</label>
                            <select
                                className="form-select form-select-sm shadow-sm py-2 border-0"
                                style={{ borderRadius: '12px', cursor: 'pointer' }}
                                value={filtroCategoria}
                                onChange={(e) => setFiltroCategoria(e.target.value)}
                            >
                                <option value="TODAS">📁 Todas las categorías</option>
                                {listaCategorias.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {cargando ? (
                        <div className="text-center mt-5">
                            <div className="spinner-border text-primary"></div>
                            <p>Cargando catálogo...</p>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {productosFiltrados.map(prod => (
                                <div key={prod.id} className="col-md-3 col-sm-4 col-6">
                                    <div
                                        className={`card h-100 border-0 shadow-sm position-relative overflow-hidden ${(prod.tipo !== 'SERVICIO' && prod.tipo !== 'ANCHETA' && prod.stock <= 0) ? 'opacity-50' : ''}`}
                                        style={{
                                            cursor: (prod.tipo === 'SERVICIO' || prod.tipo === 'ANCHETA' || prod.stock > 0) ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            borderRadius: '16px',
                                            background: prod.tipo === 'ANCHETA'
                                                ? 'linear-gradient(135deg, #fdfcfb 0%, #e2d1f9 100%)'
                                                : prod.tipo === 'SERVICIO'
                                                    ? 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
                                                    : (prod.stock <= 0) ? '#f8f9fa' : '#ffffff'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (prod.tipo === 'SERVICIO' || prod.tipo === 'ANCHETA' || prod.stock > 0) {
                                                e.currentTarget.style.transform = 'translateY(-8px)';
                                                e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.12)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 .125rem .25rem rgba(0,0,0,.075)';
                                        }}
                                        onClick={() => (prod.tipo === 'SERVICIO' || prod.tipo === 'ANCHETA' || prod.stock > 0) && agregarAlCarrito(prod)}
                                    >
                                        <div className="card-body text-center p-3 d-flex flex-column align-items-center justify-content-between">
                                            <div className="mb-2 w-100 text-center">
                                                {prod.tipo === 'ANCHETA' ? (
                                                    <span className="badge rounded-pill text-dark mb-2" style={{ backgroundColor: '#d1b3ff', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px' }}>✨ PERSONALIZABLE</span>
                                                ) : prod.tipo === 'SERVICIO' ? (
                                                    <span className="badge rounded-pill text-dark mb-2" style={{ backgroundColor: '#b3e5fc', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px' }}>⚙️ SERVICIO</span>
                                                ) : (
                                                    <span className="badge rounded-pill text-dark mb-2" style={{ backgroundColor: '#e0e0e0', fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.5px' }}>📦 FISICO</span>
                                                )}
                                                <h6 className="card-title fw-bold mb-1 px-1" style={{ color: '#2d3436', fontSize: '0.9rem', lineHeight: '1.2' }}>
                                                    {prod.nombre}
                                                </h6>
                                            </div>

                                            {prod.tipo !== 'ANCHETA' ? (
                                                <div className="my-2">
                                                    <span className="fs-4 fw-bold text-primary" style={{ letterSpacing: '-0.5px' }}>
                                                        ${parseFloat(prod.precio_venta).toLocaleString()}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="my-2 py-1">
                                                    <span className="text-muted small fw-bold">Precios Dinámicos</span>
                                                </div>
                                            )}

                                            <div className="w-100 pt-2 border-top mt-auto">
                                                {prod.tipo === 'SERVICIO' ? (
                                                    <small className="text-secondary fw-bold">Servicios</small>
                                                ) : prod.tipo === 'ANCHETA' ? (
                                                    <small className="text-primary fw-bold">🎁 Crear Ancheta Nueva</small>
                                                ) : (
                                                    <div className="d-flex flex-column align-items-center">
                                                        {prod.stock > 0 ? (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className={`rounded-circle ${prod.stock > 5 ? 'bg-success' : 'bg-warning'}`} style={{ width: '10px', height: '10px', boxShadow: `0 0 5px ${prod.stock > 5 ? '#28a745' : '#fd7e14'}` }}></div>
                                                                <small className={prod.stock > 5 ? "text-success fw-bold" : "text-warning fw-bold"}>
                                                                    {prod.stock} disp.
                                                                </small>
                                                            </div>
                                                        ) : (
                                                            <small className="text-danger fw-bold">❌ Agotado</small>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* DERECHA: CARRITO */}
                <div className="col-md-4 bg-white border-start d-flex flex-column p-0 h-100 shadow-lg">
                    <div className="p-3 bg-light border-bottom">
                        <h4 className="mb-0">🛒 Ticket de Venta</h4>
                    </div>

                    <div className="flex-grow-1 overflow-auto p-3">
                        {carrito.length === 0 ? (
                            <div className="text-center text-muted mt-5">
                                <p>Escanea o selecciona productos</p>
                            </div>
                        ) : (
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Prod</th>
                                        <th>Cant</th>
                                        <th>Subtotal</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {carrito.map((item, idx) => (
                                        <tr key={`${item.id}-${idx}`}>
                                            <td className="text-truncate" style={{ maxWidth: '120px' }}>
                                                {item.nombre}
                                                {item.tipo === 'ANCHETA' && (
                                                    <div className="small text-muted">
                                                        <button
                                                            className="btn btn-link btn-sm p-0 text-decoration-none"
                                                            onClick={() => { setAnchetaIndex(idx); setMostrarModal(true); }}
                                                        >
                                                            🔧 Editar Componentes
                                                        </button>
                                                        {item.componentes.map(c => (
                                                            <div key={c.producto_id}>• {c.cantidad}x {c.nombre}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="fw-bold text-center">{item.cantidad}</td>
                                            <td>${(item.precio_venta * item.cantidad).toLocaleString()}</td>
                                            <td>
                                                <button
                                                    className="btn btn-outline-danger btn-sm py-0 px-1"
                                                    onClick={() => eliminarDelCarrito(item.id)}
                                                >
                                                    &times;
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="p-4 bg-light border-top">
                        <div className="mb-3">
                            <label className="form-label fw-bold">Método de Pago:</label>
                            <select
                                className="form-select"
                                value={metodoPago}
                                onChange={(e) => setMetodoPago(e.target.value)}
                            >
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="TRANSFERENCIA">Transferencia / QR</option>
                                <option value="TARJETA">Tarjeta</option>
                            </select>
                        </div>

                        <div className="d-flex justify-content-between mb-3">
                            <span className="fs-4 text-muted">Total a Pagar:</span>
                            <span className="fs-1 fw-bold text-success">${totalVenta.toLocaleString()}</span>
                        </div>
                        <div className="d-grid gap-2">
                            <button
                                className="btn btn-success btn-lg py-3"
                                disabled={carrito.length === 0 || !sesionCajaId}
                                onClick={handleCobrar}
                            >
                                💸 COBRAR
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCarrito([])}
                            >
                                Cancelar / Limpiar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* MODAL CONFIGURACIÓN ANCHETA */}
            {mostrarModal && anchetaIndex !== null && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header bg-dark text-white">
                                <h5 className="modal-title">Configurar Ancheta: {carrito[anchetaIndex].nombre}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setMostrarModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-6 border-end">
                                        <h6>🔍 Agregar Componentes</h6>
                                        <input
                                            type="text"
                                            className="form-control mb-2"
                                            placeholder="Buscar producto..."
                                            value={busquedaComp}
                                            onChange={(e) => setBusquedaComp(e.target.value)}
                                        />
                                        <div className="overflow-auto" style={{ maxHeight: '300px' }}>
                                            <table className="table table-hover table-sm">
                                                <tbody>
                                                    {productos
                                                        .filter(p =>
                                                            p.tipo === 'FISICO' && (
                                                                p.nombre.toLowerCase().includes(busquedaComp.toLowerCase()) ||
                                                                (p.codigo_interno && p.codigo_interno.toLowerCase().includes(busquedaComp.toLowerCase())) ||
                                                                (p.codigo_barras && p.codigo_barras.toLowerCase().includes(busquedaComp.toLowerCase()))
                                                            )
                                                        )
                                                        .map(p => (
                                                            <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => actualizarComponente(p, 'SUMAR')}>
                                                                <td>
                                                                    <strong>{p.nombre}</strong><br />
                                                                    <small className="text-muted">{p.codigo_interno}</small>
                                                                </td>
                                                                <td className="text-primary fw-bold">${parseFloat(p.precio_venta).toLocaleString()}</td>
                                                                <td><span className="badge bg-secondary">Stock: {p.stock}</span></td>
                                                            </tr>
                                                        ))
                                                    }
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <h6>🎁 Contenido Actual</h6>
                                        {carrito[anchetaIndex].componentes.length === 0 ? (
                                            <p className="text-muted">Aún no hay componentes agregados.</p>
                                        ) : (
                                            <ul className="list-group">
                                                {carrito[anchetaIndex].componentes.map(c => (
                                                    <li key={c.producto_id} className="list-group-item d-flex justify-content-between align-items-center">
                                                        <div>
                                                            {c.nombre}
                                                            <div className="small text-muted">${c.precio_venta.toLocaleString()} c/u</div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <button className="btn btn-sm btn-outline-danger" onClick={() => actualizarComponente(c, 'RESTAR')}>-</button>
                                                            <span className="fw-bold">{c.cantidad}</span>
                                                            <button className="btn btn-sm btn-outline-primary" onClick={() => actualizarComponente(c, 'SUMAR')}>+</button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <div className="mt-auto border-top pt-3 bg-light p-3 rounded">
                                            <div className="row align-items-center mb-2">
                                                <div className="col-8">
                                                    <label className="form-label small mb-0 fw-bold">Mano de Obra / Comisión (%)</label>
                                                </div>
                                                <div className="col-4">
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={carrito[anchetaIndex].margen_ancheta}
                                                            onChange={(e) => actualizarMargenAncheta(e.target.value)}
                                                        />
                                                        <span className="input-group-text">%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="d-flex justify-content-between small text-muted mb-1">
                                                <span>Subtotal Componentes:</span>
                                                <span>${carrito[anchetaIndex].componentes.reduce((acc, c) => acc + (c.precio_venta * c.cantidad), 0).toLocaleString()}</span>
                                            </div>
                                            <div className="d-flex justify-content-between small text-muted mb-1">
                                                <span>Valor Servicio (Base + Comis.):</span>
                                                <span>${carrito[anchetaIndex].precio_servicio_ancheta.toLocaleString()}</span>
                                            </div>
                                            <div className="d-flex justify-content-between fs-4 fw-bold text-success border-top pt-2">
                                                <span>Total Ancheta:</span>
                                                <span>${parseFloat(carrito[anchetaIndex].precio_venta).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-primary" onClick={() => setMostrarModal(false)}>Listo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default POS;