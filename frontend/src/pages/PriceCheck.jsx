import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const PriceCheck = () => {
    const navigate = useNavigate();
    const [busqueda, setBusqueda] = useState('');
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Podríamos cargar categorías si queremos filtrar por dropdown
    // const [categorias, setCategorias] = useState([]);

    // Efecto debounce para no saturar con peticiones mientras escribe
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (busqueda.length > 2) {
                buscarProductos(busqueda);
            } else {
                setProductos([]);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [busqueda]);

    const buscarProductos = async (query) => {
        setLoading(true);
        try {
            // Usamos el endpoint público (o autenticado) de listar productos.
            // OJO: "listar-pos" pide Sede, y la lógica actual del endpoint 
            // exige sede_id O tener perfil con sede asignada.
            // Para el verificador global, quizás necesitemos un endpoint más laxo 
            // O, simplemente enviamos una sede por defecto si el usuario es Admin.
            // Vamos a intentar usar el de 'listar-productos' genérico si existe, 
            // si no, usaremos 'listar-pos' con manejo de error.

            // NOTA: Como en el backend "ListarProductosPOS" filtra por sede, 
            // un admin sin Sede seleccionada no verá nada.
            // Solución rápida: Crear un endpoint nuevo en backend: "ConsultaPrecios"
            // O modificar el existente para que admita búsqueda sin stock (solo precio referencia).

            // Por ahora, asumimos que se ha creado un endpoint 'inventario/buscar/' 
            // o reutilizamos 'listar-pos' enviando un parametro 'modo_verificador=true'.

            // Vamos a invocar a la API que crearemos a continuación:
            const res = await api.get(`inventario/buscar-publico/?q=${query}`);
            setProductos(res.data);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>🔍 Verificador de Precios</h2>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Volver al Menú</button>
            </div>

            <div className="card shadow-lg">
                <div className="card-body p-5 text-center">

                    <h4 className="mb-4 text-muted">Escanea el código de barras o escribe el nombre</h4>

                    <div className="input-group input-group-lg mb-4">
                        <span className="input-group-text bg-primary text-white">🔎</span>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Ej: Cuaderno, 770123..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {loading && <div className="spinner-border text-primary"></div>}

                    {!loading && productos.length === 0 && busqueda.length > 2 && (
                        <p className="text-muted">No se encontraron productos.</p>
                    )}

                    <div className="row g-3 mt-2">
                        {productos.map(p => (
                            <div key={p.id} className="col-md-4">
                                <div className="card h-100 border-primary shadow-sm hover-effect">
                                    <div className="card-body">
                                        <h5 className="card-title text-truncate">{p.nombre}</h5>
                                        <p className="card-text small text-muted mb-1">Cód: {p.codigo_barras || p.codigo_interno}</p>
                                        <h2 className="text-success fw-bold">${parseFloat(p.precio_venta).toLocaleString()}</h2>
                                        <span className="badge bg-light text-dark border">
                                            {p.categoria_nombre || 'General'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriceCheck;
