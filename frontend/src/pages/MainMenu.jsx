import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const MainMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [validando, setValidando] = useState(true);

    // Al entrar al menú, verificamos si TIENE CAJA
    // codigo para verificar si el usuario tiene caja abierta
    useEffect(() => {
        const verificarCaja = async () => { //funcion asincrona que verifica si el usuario tiene caja abierta
            try {
                const res = await api.get('ventas/estado-caja/'); //hace una peticion GET a la api para verificar si el usuario tiene caja abierta
                if (!res.data.abierta) {
                    // Si NO tiene caja abierta, lo mandamos a abrirla
                    navigate('/apertura-caja');
                }
            } catch (error) {
                console.error("Error verificando caja", error);
            } finally {
                setValidando(false);
            }
        };
        verificarCaja();
    }, [navigate]);

    if (validando) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;

    return (
        <div className="container mt-5">
            <div className="d-flex justify-content-between align-items-center mb-5">
                <h1>Hola, {user?.username} 👋</h1>
                <button className="btn btn-outline-danger" onClick={logout}>Cerrar Sesión</button>
            </div>

            <div className="row g-4">
                {/* OPCIÓN 1: Registrar Venta */}
                <div className="col-md-4">
                    <div className="card h-100 shadow-sm border-primary">
                        <div className="card-body text-center">
                            <div className="display-4 mb-3">🛒</div>
                            <h3>Punto de Venta</h3>
                            <p>Registrar ventas y salidas de productos.</p>
                            <Link to="/pos" className="btn btn-primary w-100 stretched-link">Ir a Caja</Link>
                        </div>
                    </div>
                </div>

                {/* OPCIÓN 2: Consultar Precios (Usaremos una página simple o el mismo POS modo lectura) */}
                <div className="col-md-4">
                    <div className="card h-100 shadow-sm">
                        <div className="card-body text-center">
                            <div className="display-4 mb-3">🔍</div>
                            <h3>Verificador</h3>
                            <p>Consultar precios por código o nombre.</p>
                            <button className="btn btn-outline-secondary w-100" onClick={() => alert("Próximamente: Buscador rápido")}>Consultar</button>
                        </div>
                    </div>
                </div>

                {/* OPCIÓN 3: Cerrar Caja */}
                <div className="col-md-4">
                    <div className="card h-100 shadow-sm border-danger">
                        <div className="card-body text-center">
                            <div className="display-4 mb-3">🔒</div>
                            <h3>Cerrar Turno</h3>
                            <p>Finalizar el día y hacer corte de caja.</p>
                            <button
                                className="btn btn-outline-danger w-100"
                                onClick={() => alert("Aquí iremos a la pantalla de arqueo")}
                            >
                                Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>

                {/* OPCIÓN ADMIN (Solo visible si decidiéramos validar permisos admin) */}
                {/* Aquí podrías poner un: if (user.is_superuser) ... */}
                <div className="col-12 mt-4">
                    <hr />
                    <h5 className="text-muted">Zona Administrativa</h5>
                    <a href="http://127.0.0.1:8000/admin/" target="_blank" className="btn btn-dark">
                        ⚙️ Ir al Panel Admin (Django)
                    </a>
                </div>
            </div>
        </div>
    );
};

export default MainMenu;