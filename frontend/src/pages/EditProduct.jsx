import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/useAuth';

const EditProduct = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Buscador de producto a editar
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [resultadosProducto, setResultadosProducto] = useState([]);
    const [productoId, setProductoId] = useState(null);

    // Form State
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [codigoBarras, setCodigoBarras] = useState('');
    const [codigoInterno, setCodigoInterno] = useState('');
    const [tipo, setTipo] = useState('FISICO');
    const [categoria, setCategoria] = useState('');
    const [precioCosto, setPrecioCosto] = useState('');
    const [precioVenta, setPrecioVenta] = useState('');
    const [margen, setMargen] = useState('');
    const [unidad, setUnidad] = useState('UND');
    const [activo, setActivo] = useState(true);

    // Aux Data
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    // Ancheta Logic
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState([]);
    const [ingredientes, setIngredientes] = useState([]);

    useEffect(() => {
        if (user?.rol !== 'ADMIN') {
            navigate('/menu');
            return;
        }
        api.get('inventario/categorias/')
            .then(res => setCategorias(res.data))
            .catch(console.error);
    }, [user, navigate]);

    // Buscador del producto a editar
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (busquedaProducto.length > 1) {
                api.get(`inventario/admin/buscar-productos/?q=${busquedaProducto}`)
                    .then(res => setResultadosProducto(res.data))
                    .catch(console.error);
            } else {
                setResultadosProducto([]);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [busquedaProducto]);

    const seleccionarProducto = async (prod) => {
        setBusquedaProducto('');
        setResultadosProducto([]);
        setMensaje(null);
        setLoading(true);
        try {
            const res = await api.get(`inventario/admin/productos/${prod.id}/`);
            const p = res.data;
            setProductoId(p.id);
            setNombre(p.nombre);
            setDescripcion(p.descripcion || '');
            setCodigoBarras(p.codigo_barras || '');
            setCodigoInterno(p.codigo_interno);
            setTipo(p.tipo);
            setCategoria(p.categoria || '');
            setPrecioCosto(p.precio_costo);
            setPrecioVenta(p.precio_venta);
            setMargen('');
            setUnidad(p.unidad_medida);
            setActivo(p.activo);
            setIngredientes((p.ingredientes_detalle || []).map(i => ({
                producto_hijo: i.producto_hijo_id,
                nombre: i.nombre,
                cantidad: i.cantidad,
                precio_costo: parseFloat(i.precio_costo || 0)
            })));
        } catch (error) {
            console.error(error);
            setMensaje({ tipo: 'danger', text: '❌ No se pudo cargar el producto.' });
        } finally {
            setLoading(false);
        }
    };

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
        if (prod.id === productoId) {
            alert("Un producto no puede ser componente de sí mismo.");
            return;
        }
        if (ingredientes.find(i => i.producto_hijo === prod.id)) {
            alert("Este producto ya está en la lista.");
            return;
        }
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
            setPrecioVenta(Math.round(venta).toString());
        }
    }, [precioCosto, margen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!productoId) return;
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
            activo
        };

        if (tipo === 'ANCHETA') {
            payload.ingredientes = ingredientes.map(i => ({
                producto_hijo_id: i.producto_hijo,
                cantidad: i.cantidad
            }));
        }

        try {
            await api.patch(`inventario/admin/productos/${productoId}/`, payload);
            setMensaje({ tipo: 'success', text: '✅ Producto actualizado con éxito' });
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || JSON.stringify(error.response?.data) || "Error al actualizar";
            setMensaje({ tipo: 'danger', text: `❌ ${errorMsg}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5 mb-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>✏️ Editar Producto</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            {/* BUSCADOR DE PRODUCTO */}
            <div className="card shadow-sm mb-4">
                <div className="card-body position-relative">
                    <label className="form-label fw-bold">Buscar producto a editar</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="🔍 Nombre, código de barras o código interno..."
                        value={busquedaProducto}
                        onChange={e => setBusquedaProducto(e.target.value)}
                    />
                    {resultadosProducto.length > 0 && (
                        <div className="list-group position-absolute shadow" style={{ zIndex: 1100, maxHeight: '250px', overflowY: 'auto', left: '1rem', right: '1rem' }}>
                            {resultadosProducto.map(p => (
                                <button key={p.id} type="button" className="list-group-item list-group-item-action" onClick={() => seleccionarProducto(p)}>
                                    <strong>{p.nombre}</strong> <small>({p.codigo_interno})</small>
                                    <span className="float-end text-muted">${parseFloat(p.precio_venta).toLocaleString()}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {mensaje && (
                <div className={`alert alert-${mensaje.tipo} alert-dismissible fade show`}>
                    {mensaje.text}
                    <button type="button" className="btn-close" onClick={() => setMensaje(null)}></button>
                </div>
            )}

            {!productoId ? (
                <div className="text-center text-muted py-5">
                    {loading ? <div className="spinner-border"></div> : "Busca y selecciona un producto para editarlo."}
                </div>
            ) : (
                <div className="card shadow">
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            {/* ESTADO ACTIVO */}
                            <div className="form-check form-switch mb-3">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="switchActivo"
                                    checked={activo}
                                    onChange={e => setActivo(e.target.checked)}
                                />
                                <label className="form-check-label fw-bold" htmlFor="switchActivo">
                                    {activo ? <span className="text-success">Producto Activo</span> : <span className="text-danger">Producto Inactivo (no aparece en el POS)</span>}
                                </label>
                            </div>

                            {/* BASIC INFO */}
                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-bold">Nombre del Producto</label>
                                    <input type="text" className="form-control" required value={nombre} onChange={e => setNombre(e.target.value)} />
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label fw-bold">Código Interno / PLU</label>
                                    <input type="text" className="form-control" required value={codigoInterno} onChange={e => setCodigoInterno(e.target.value)} />
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
                                    <select className="form-select" value={categoria} onChange={e => setCategoria(e.target.value)}>
                                        <option value="">Sin Categoría</option>
                                        {categorias.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
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
                                        <input type="number" step="0.01" className="form-control" required value={precioCosto} onChange={e => setPrecioCosto(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label fw-bold text-primary">Margen de Ganancia (%)</label>
                                    <div className="input-group">
                                        <input type="number" className="form-control" placeholder="Ej: 30" value={margen} onChange={e => setMargen(e.target.value)} />
                                        <span className="input-group-text">%</span>
                                    </div>
                                    <small className="text-muted">Recalcula la venta automáticamente</small>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label fw-bold text-success">Precio de Venta (Público)</label>
                                    <div className="input-group">
                                        <span className="input-group-text">$</span>
                                        <input type="number" step="0.01" className="form-control" required value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* ANCHETA INGREDIENTS SECTION */}
                            {tipo === 'ANCHETA' && (
                                <div className="border rounded p-3 mb-4 bg-light">
                                    <h5 className="mb-3 text-primary">🎁 Contenido del Kit / Ancheta</h5>

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
                                    {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditProduct;
