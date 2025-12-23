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

    // Estados para manejo de Sedes (feature Admin)
    const [sedeSesion, setSedeSesion] = useState(null); // La sede donde está la CAJA ABIERTA
    const [sedeVisual, setSedeVisual] = useState(null); // La sede que estamos VIENDO
    const [listaSedes, setListaSedes] = useState([]);
    const [metodoPago, setMetodoPago] = useState('EFECTIVO');

    // 1. CARGA INICIAL
    useEffect(() => {
        const inicializarPOS = async () => {
            try {
                // 1. Primero verificamos estado de caja
                const resCaja = await api.get('ventas/estado-caja/');

                if (!resCaja.data.abierta) {
                    alert("⚠️ No tienes una caja abierta. Serás redirigido.");
                    navigate('/menu');
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
    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo_barras && p.codigo_barras.includes(busqueda))
    );

    // 3. LOGICA CARRITO
    const agregarAlCarrito = (producto) => {
        const existe = carrito.find(item => item.id === producto.id);

        // Validar Stock visualmente (Opcional, el backend valida igual)
        if (producto.tipo !== 'SERVICIO' && producto.stock <= 0) {
            alert("Producto sin stock disponible");
            return;
        }

        if (existe) {
            if (producto.tipo !== 'SERVICIO' && existe.cantidad >= producto.stock) {
                alert("No hay más stock disponible");
                return;
            }
            setCarrito(carrito.map(item =>
                item.id === producto.id
                    ? { ...item, cantidad: item.cantidad + 1 }
                    : item
            ));
        } else {
            setCarrito([...carrito, { ...producto, cantidad: 1 }]);
        }
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

        const ventaData = {
            sesion_caja: sesionCajaId,
            metodo_pago: metodoPago,
            detalles: carrito.map(item => ({
                producto_id: item.id,
                cantidad: item.cantidad
            }))
        };

        try {
            const response = await api.post('ventas/crear/', ventaData);

            if (response.status === 201) {
                alert(`✅ ¡Venta registrada! Nuevo acumulado: $${response.data.nuevo_acumulado_caja}`);
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
                            className="form-control form-control-lg"
                            placeholder="🔍 Buscar producto por nombre o código..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            autoFocus
                        />
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
                                        className={`card h-100 shadow-sm border-0 ${(prod.tipo !== 'SERVICIO' && prod.stock <= 0) ? 'opacity-50' : ''}`}
                                        style={{ cursor: (prod.tipo === 'SERVICIO' || prod.stock > 0) ? 'pointer' : 'not-allowed' }}
                                        onClick={() => (prod.tipo === 'SERVICIO' || prod.stock > 0) && agregarAlCarrito(prod)}
                                    >
                                        <div className="card-body text-center p-2 d-flex flex-column justify-content-center">
                                            <h6 className="card-title text-truncate" title={prod.nombre}>
                                                {prod.nombre}
                                            </h6>
                                            <p className="card-text text-primary fw-bold mb-0">
                                                ${parseFloat(prod.precio_venta).toLocaleString()}
                                            </p>
                                            {prod.tipo === 'SERVICIO' ? (
                                                <small className="text-info fw-bold">Servicio</small>
                                            ) : (
                                                <small className={prod.stock > 5 ? "text-success" : "text-danger"}>
                                                    Stock: {prod.stock}
                                                </small>
                                            )}
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
                                    {carrito.map(item => (
                                        <tr key={item.id}>
                                            <td className="text-truncate" style={{ maxWidth: '120px' }}>{item.nombre}</td>
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
        </div>
    );
};

export default POS;