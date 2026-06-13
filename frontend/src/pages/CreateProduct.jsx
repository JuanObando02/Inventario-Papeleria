import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const CreateProduct = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Form State
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [codigoBarras, setCodigoBarras] = useState('');
    const [codigoInterno, setCodigoInterno] = useState('');
    const [tipo, setTipo] = useState('FISICO'); // FISICO, SERVICIO, ANCHETA
    const [categoria, setCategoria] = useState('');
    const [precioCosto, setPrecioCosto] = useState('');
    const [precioVenta, setPrecioVenta] = useState('');
    const [margen, setMargen] = useState(''); // Porcentaje de ganancia
    const [unidad, setUnidad] = useState('UND');

    // Aux Data
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    // Ancheta Logic
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState([]);
    const [ingredientes, setIngredientes] = useState([]); // [{ producto_hijo: id, nombre: '', cantidad: 1, costo: 0 }]

    useEffect(() => {
        if (user?.rol !== 'ADMIN') {
            navigate('/menu');
            return;
        }
        // Cargar Categorias
        api.get('inventario/categorias/')
            .then(res => setCategorias(res.data))
            .catch(console.error);
    }, [user, navigate]);

    // Buscador para ingredientes (Solo si es Ancheta)
    useEffect(() => {
        if (tipo !== 'ANCHETA') return;
        const timeoutId = setTimeout(() => {
            if (busqueda.length > 2) {
                api.get(`inventario/admin/buscar-productos/?q=${busqueda}`)
                    .then(res => setResultados(res.data))
                    .catch(console.error);
            } else {
                setResultados([]);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [busqueda, tipo]);

    const agregarIngrediente = (prod) => {
        // Verificar si ya existe
        if (ingredientes.find(i => i.producto_hijo === prod.id)) {
            alert("Este producto ya está en la lista.");
            return;
        }
        // Agregamos con cantidad 1
        // Ahora el endpoint de admin SI trae el precio_costo
        setIngredientes([...ingredientes, {
            producto_hijo: prod.id,
            nombre: prod.nombre,
            cantidad: 1,
            precio_costo: parseFloat(prod.precio_costo || 0)
        }]);
        setBusqueda('');
        setResultados([]);
    };

    const eliminarIngrediente = (id) => {
        setIngredientes(ingredientes.filter(i => i.producto_hijo !== id));
    };

    const cambiarCantidadIngrediente = (id, cant) => {
        setIngredientes(ingredientes.map(i =>
            i.producto_hijo === id ? { ...i, cantidad: parseInt(cant) || 1 } : i
        ));
    };

    // Auto-calcular costo cuando cambian los ingredientes
    useEffect(() => {
        if (tipo === 'ANCHETA' && ingredientes.length > 0) {
            const total = ingredientes.reduce((acc, ing) => acc + (ing.precio_costo * ing.cantidad), 0);
            setPrecioCosto(total.toFixed(2));
        }
    }, [ingredientes, tipo]);

    // Calcular Precio de Venta basado en Margen
    useEffect(() => {
        const costo = parseFloat(precioCosto);
        const porc = parseFloat(margen);

        if (!isNaN(costo) && !isNaN(porc)) {
            const venta = costo + (costo * (porc / 100));
            setPrecioVenta(Math.round(venta).toString()); // Redondeamos para evitar decimales molestos en venta
        }
    }, [precioCosto, margen]);

    // Generate Next Code Logic
    const generarCodigo = () => {
        // No bloqueamos con lading global para que no parezca que se congela todo,
        // pero podriamos poner un mini spinner si fuera lento.
        api.get('inventario/admin/generar-codigo/')
            .then(res => {
                setCodigoInterno(res.data.siguiente_codigo);
            })
            .catch(err => {
                console.error(err);
                alert("Error al generar el código");
            });
    };

    const handleCrearCategoria = async () => {
        const nombreCat = prompt("Ingresa el nombre de la nueva categoría:");
        if (!nombreCat) return;

        try {
            await api.post('inventario/admin/crear-categoria/', { nombre: nombreCat });
            alert("Categoría creada con éxito!");
            // Recargar categorias
            const res = await api.get('inventario/categorias/');
            setCategorias(res.data);

            // Auto seleccionar la nueva (la buscamos por nombre, simple logic)
            const nueva = res.data.find(c => c.nombre === nombreCat);
            if (nueva) setCategoria(nueva.id);

        } catch (error) {
            console.error(error);
            alert("Error al crear categoría: " + (error.response?.data?.error || "Error desconocido"));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMensaje(null);

        const payload = {
            nombre,
            descripcion,
            codigo_barras: codigoBarras || null,
            codigo_interno: codigoInterno,
            tipo,
            categoria: categoria ? parseInt(categoria) : null,
            precio_costo: parseFloat(precioCosto),
            precio_venta: parseFloat(precioVenta),
            unidad_medida: unidad,
            activo: true
        };

        if (tipo === 'ANCHETA' && ingredientes.length > 0) {
            payload.ingredientes = ingredientes.map(i => ({
                producto_hijo_id: i.producto_hijo,
                cantidad: i.cantidad
            }));
        }

        try {
            await api.post('inventario/admin/crear-producto/', payload);
            setMensaje({ tipo: 'success', text: '✅ Producto creado con éxito' });
            // Reset Form (a bit lazy reset)
            setNombre('');
            setCodigoInterno('');
            setCodigoBarras('');
            setPrecioCosto('');
            setPrecioVenta('');
            setMargen('');
            setIngredientes([]);
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || JSON.stringify(error.response?.data) || "Error al crear";
            setMensaje({ tipo: 'danger', text: `❌ ${errorMsg}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>✨ Crear Nuevo Producto</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            <div className="card shadow">
                <div className="card-body">
                    {mensaje && (
                        <div className={`alert alert-${mensaje.tipo} alert-dismissible fade show`}>
                            {mensaje.text}
                            <button type="button" className="btn-close" onClick={() => setMensaje(null)}></button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* BASIC INFO */}
                        <div className="row mb-3">
                            <div className="col-md-6">
                                <label className="form-label fw-bold">Nombre del Producto</label>
                                <input type="text" className="form-control" required value={nombre} onChange={e => setNombre(e.target.value)} />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Código Interno / PLU</label>
                                <div className="input-group">
                                    <input type="text" className="form-control" required value={codigoInterno} onChange={e => setCodigoInterno(e.target.value)} />
                                    <button type="button" className="btn btn-outline-secondary" onClick={generarCodigo} title="Generar Siguiente Código">
                                        ⚡ Auto
                                    </button>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Código de Barras</label>
                                <input type="text" className="form-control" value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)} placeholder="Opcional" />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label fw-bold">Descripción</label>
                            <textarea className="form-control" rows="2" value={descripcion} onChange={e => setDescripcion(e.target.value)}></textarea>
                        </div>

                        {/* TYPE & CATEGORY */}
                        <div className="row mb-3">
                            <div className="col-md-4">
                                <label className="form-label fw-bold">Tipo de Producto</label>
                                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                                    <option value="FISICO">📦 Producto Físico</option>
                                    <option value="SERVICIO">🛠 Servicio</option>
                                    <option value="ANCHETA">🎁 Ancheta / Kit</option>
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold">Categoría</label>
                                <div className="input-group">
                                    <select className="form-select" value={categoria} onChange={e => setCategoria(e.target.value)}>
                                        <option value="">Sin Categoría</option>
                                        {categorias.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                    <button type="button" className="btn btn-outline-primary" onClick={handleCrearCategoria} title="Crear Nueva Categoría">
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold">Unidad de Medida</label>
                                <input type="text" className="form-control" value={unidad} onChange={e => setUnidad(e.target.value)} />
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-md-4">
                                <label className="form-label fw-bold text-danger">Precio de Costo (Compra)</label>
                                <div className="input-group">
                                    <span className="input-group-text">$</span>
                                    <input type="number" className="form-control" required value={precioCosto} onChange={e => setPrecioCosto(e.target.value)} />
                                </div>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold text-primary">Margen de Ganancia (%)</label>
                                <div className="input-group">
                                    <input type="number" className="form-control" placeholder="Ej: 30" value={margen} onChange={e => setMargen(e.target.value)} />
                                    <span className="input-group-text">%</span>
                                </div>
                                <small className="text-muted">Calcula la venta automáticamente</small>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label fw-bold text-success">Precio de Venta (Público)</label>
                                <div className="input-group">
                                    <span className="input-group-text">$</span>
                                    <input type="number" className="form-control" required value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* ANCHETA INGREDIENTS SECTION */}
                        {tipo === 'ANCHETA' && (
                            <div className="border rounded p-3 mb-4 bg-light">
                                <h5 className="mb-3 text-primary">🎁 Contenido del Kit / Ancheta</h5>

                                {/* Search */}
                                <div className="mb-3 position-relative">
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="🔍 Buscar productos para agregar..."
                                        value={busqueda}
                                        onChange={e => setBusqueda(e.target.value)}
                                    />
                                    {resultados.length > 0 && (
                                        <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                            {resultados.map(p => (
                                                <button key={p.id} type="button" className="list-group-item list-group-item-action" onClick={() => agregarIngrediente(p)}>
                                                    <strong>{p.nombre}</strong> <small>({p.codigo_interno})</small>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Table */}
                                {ingredientes.length > 0 ? (
                                    <table className="table table-sm bg-white">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th style={{ width: '80px' }}>Cant.</th>
                                                <th>Costo Unit.</th>
                                                <th>Subtotal</th>
                                                <th>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ingredientes.map(ing => (
                                                <tr key={ing.producto_hijo}>
                                                    <td>{ing.nombre}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="form-control form-control-sm"
                                                            value={ing.cantidad}
                                                            min="1"
                                                            onChange={e => cambiarCantidadIngrediente(ing.producto_hijo, e.target.value)}
                                                        />
                                                    </td>
                                                    <td>${ing.precio_costo.toLocaleString()}</td>
                                                    <td>${(ing.precio_costo * ing.cantidad).toLocaleString()}</td>
                                                    <td>
                                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => eliminarIngrediente(ing.producto_hijo)}>
                                                            &times;
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="table-dark">
                                                <td colSpan="3" className="text-end fw-bold">Costo Total Sugerido:</td>
                                                <td colSpan="2" className="fw-bold">${ingredientes.reduce((acc, i) => acc + (i.precio_costo * i.cantidad), 0).toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                ) : (
                                    <p className="text-muted text-center">Agrega productos que componen este Kit.</p>
                                )}
                            </div>
                        )}

                        <div className="d-grid">
                            <button type="submit" className="btn btn-dark btn-lg" disabled={loading}>
                                {loading ? 'Guardando...' : '💾 Crear Producto'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateProduct;
