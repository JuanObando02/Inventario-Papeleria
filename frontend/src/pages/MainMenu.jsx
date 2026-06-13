import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../api/axios';

const MainMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [validando, setValidando] = useState(true);
    const [resumen, setResumen] = useState(null);

    // Al entrar al menú, cargamos el resumen del día (incluye estado de caja)
    useEffect(() => {
        const cargarResumen = async () => {
            try {
                const res = await api.get('ventas/dashboard/');
                setResumen(res.data);
                if (!res.data.caja.abierta && user?.rol !== 'ADMIN') {
                    // Si NO tiene caja abierta y no es admin, lo mandamos a abrirla
                    navigate('/apertura-caja');
                }
            } catch (error) {
                console.error("Error cargando resumen", error);
            } finally {
                setValidando(false);
            }
        };
        cargarResumen();
    }, [navigate, user?.rol]);

    if (validando) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

    return (
        <div className="container mt-5 pb-5">
            {/* ENCABEZADO PERSONALIZADO */}
            <div
                className="d-flex justify-content-between align-items-center mb-5 p-4 bg-white rounded-4 shadow-sm border-fucsia-header"
            >
                <div>
                    <h1 className="fw-bold mb-0" style={{ color: '#4a044e' }}>¡Hola, {user?.username}! 👋</h1>
                    <p className="text-muted mb-0">Bienvenido al sistema de Papelería y Detalles</p>
                </div>
                <button className="btn btn-outline-danger btn-sm px-4 rounded-pill" onClick={logout}>
                    Cerrar Sesión
                </button>
            </div>

            {/* RESUMEN DEL DÍA */}
            {resumen && (
                <div className="row g-3 mb-4">
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body d-flex align-items-center gap-3">
                                <span className="fs-1">💰</span>
                                <div>
                                    <div className="text-muted small">Ventas de hoy {user?.rol !== 'ADMIN' ? '(tu sede)' : '(todas las sedes)'}</div>
                                    <div className="fs-4 fw-bold">${parseFloat(resumen.ventas_hoy.total).toLocaleString()}</div>
                                    <div className="text-muted small">{resumen.ventas_hoy.numero} ventas</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div
                            className="card border-0 shadow-sm h-100"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate('/alertas-stock')}
                        >
                            <div className="card-body d-flex align-items-center gap-3">
                                <span className="fs-1">⚠️</span>
                                <div>
                                    <div className="text-muted small">Alertas de stock</div>
                                    <div className="fs-4 fw-bold">
                                        {resumen.alertas_stock}
                                        {resumen.alertas_stock > 0 && <span className="badge bg-danger ms-2 align-middle">Reponer</span>}
                                    </div>
                                    <div className="text-muted small">productos en o bajo el mínimo</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body d-flex align-items-center gap-3">
                                <span className="fs-1">{resumen.caja.abierta ? '🔓' : '🔒'}</span>
                                <div>
                                    <div className="text-muted small">Tu caja</div>
                                    {resumen.caja.abierta ? (
                                        <>
                                            <div className="fs-4 fw-bold text-success">Abierta</div>
                                            <div className="text-muted small">Saldo: ${parseFloat(resumen.caja.saldo).toLocaleString()}</div>
                                        </>
                                    ) : (
                                        <div className="fs-4 fw-bold text-secondary">Cerrada</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="row g-4">
                {/* OPCIÓN 1: Registrar Venta */}
                <div className="col-md-4">
                    <div className="card h-100 border-0 overflow-hidden shadow-hover card-hover" style={{ backgroundColor: '#fff' }}>
                        <div className="card-body p-4 text-center">
                            <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex p-3 mb-3">
                                <span className="display-4">🛒</span>
                            </div>
                            <h3 className="fw-bold" style={{ color: '#d946ef' }}>Punto de Venta</h3>
                            <p className="text-muted">Atiende a tus clientes y registra ventas rápidamente.</p>
                            <Link to="/pos" className="btn btn-primary w-100 py-2 rounded-pill shadow-sm">
                                Abrir Caja
                            </Link>
                        </div>
                    </div>
                </div>

                {/* OPCIÓN 2: Consultar Precios */}
                <div className="col-md-4">
                    <div className="card h-100 border-0 shadow-hover card-hover">
                        <div className="card-body p-4 text-center">
                            <div className="rounded-circle bg-info bg-opacity-10 d-inline-flex p-3 mb-3">
                                <span className="display-4">🔍</span>
                            </div>
                            <h3 className="fw-bold" style={{ color: '#ec4899' }}>Verificador</h3>
                            <p className="text-muted">Consulta precios y existencias en segundos.</p>
                            <button className="btn btn-outline-info w-100 py-2 rounded-pill" onClick={() => navigate('/verificador')}>
                                Consultar Catálogo
                            </button>
                        </div>
                    </div>
                </div>

                {/* OPCIÓN 3: Cerrar Caja */}
                <div className="col-md-4">
                    <div className="card h-100 border-0 shadow-hover card-hover">
                        <div className="card-body p-4 text-center">
                            <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex p-3 mb-3">
                                <span className="display-4">🔒</span>
                            </div>
                            <h3 className="fw-bold text-danger">Cerrar Turno</h3>
                            <p className="text-muted">Finaliza el día y genera el resumen de ventas.</p>
                            <button
                                className="btn btn-outline-danger w-100 py-2 rounded-pill"
                                onClick={() => navigate('/cerrar-caja')}
                            >
                                Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>

                {/* OPCIÓN 4: Reposición de Stock */}
                <div className="col-md-4">
                    <div className="card h-100 border-0 shadow-hover card-hover">
                        <div className="card-body p-4 text-center">
                            <div className="rounded-circle bg-warning bg-opacity-10 d-inline-flex p-3 mb-3">
                                <span className="display-4">⚠️</span>
                            </div>
                            <h3 className="fw-bold" style={{ color: '#d97706' }}>Reposición</h3>
                            <p className="text-muted">Productos con stock bajo que necesitan reabastecimiento.</p>
                            <button className="btn btn-outline-warning w-100 py-2 rounded-pill" onClick={() => navigate('/alertas-stock')}>
                                Ver Alertas de Stock
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN ADMINISTRATIVA INTEGRADA */}
                {user?.rol === 'ADMIN' && (
                    <div className="col-12 mt-5">
                        <div className="p-4 bg-white rounded-4 shadow-sm border-fucsia-admin">
                            <h4 className="fw-bold mb-4 d-flex align-items-center" style={{ color: '#6d28d9' }}>
                                <span className="me-2">⚙️</span> Zona Administrativa
                            </h4>
                            <div className="row g-3">
                                <div className="col-md-3">
                                    <Link to="/admin/crear-producto" className="btn btn-success w-100 text-white d-flex flex-column align-items-center p-3 gap-2">
                                        <span className="fs-3">✨</span>
                                        <span>Crear Producto</span>
                                    </Link>
                                </div>
                                <div className="col-md-3">
                                    <Link to="/admin/editar-producto" className="btn btn-warning w-100 d-flex flex-column align-items-center p-3 gap-2">
                                        <span className="fs-3">✏️</span>
                                        <span>Editar Producto</span>
                                    </Link>
                                </div>
                                <div className="col-md-3">
                                    <Link to="/admin/inventario" className="btn btn-pink w-100 d-flex flex-column align-items-center p-3 gap-2">
                                        <span className="fs-3">📦</span>
                                        <span>Gestionar Stock</span>
                                    </Link>
                                </div>
                                <div className="col-md-3">
                                    <Link to="/admin/inventario-global" className="btn btn-info w-100 text-white d-flex flex-column align-items-center p-3 gap-2">
                                        <span className="fs-3">🏢</span>
                                        <span>Stock de Sedes</span>
                                    </Link>
                                </div>
                                <div className="col-md-3">
                                    <Link to="/admin/reportes" className="btn btn-primary w-100 d-flex flex-column align-items-center p-3 gap-2">
                                        <span className="fs-3">📊</span>
                                        <span>Reportes de Cierre</span>
                                    </Link>
                                </div>
                                <div className="col-md-3">
                                    <Link to="/admin/reportes-ventas" className="btn btn-success w-100 text-white d-flex flex-column align-items-center p-3 gap-2">
                                        <span className="fs-3">📈</span>
                                        <span>Reporte de Ventas</span>
                                    </Link>
                                </div>
                                <div className="col-12 mt-4 text-center">
                                    <a
                                        href="http://127.0.0.1:8000/admin/"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-sm px-4 py-2 rounded-pill shadow-sm"
                                        style={{
                                            backgroundColor: '#1e293b',
                                            color: '#f1f5f9',
                                            fontSize: '0.85rem',
                                            letterSpacing: '0.5px',
                                            border: 'none'
                                        }}
                                    >
                                        🛠️ Acceder al Panel Técnico (Django Admin)
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MainMenu;