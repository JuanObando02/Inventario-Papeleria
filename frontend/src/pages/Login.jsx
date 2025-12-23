import { useState } from 'react';
import api from '../api/axios'; // Importamos nuestro comunicador
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null); // Limpiamos errores previos

        try {
            const response = await api.post('ventas/login-json/', {
                username,
                password
            });

            login(
                response.data.token,
                response.data.username,
                response.data.user_id,
                {
                    rol: response.data.rol,
                    sede_id: response.data.sede_id,
                    sede_nombre: response.data.sede_nombre
                }
            );

            navigate('/menu');

        } catch (err) {
            console.error(err);
            setError('Credenciales inválidas o error en el servidor');
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
            <div className="card shadow-sm" style={{ width: '400px' }}>
                <div className="card-header bg-primary text-white text-center py-3">
                    <h4 className="mb-0">🔐 Acceso Papelería</h4>
                </div>
                <div className="card-body p-4">
                    {error && <div className="alert alert-danger">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Usuario</label>
                            <input
                                type="text"
                                className="form-control"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Contraseña</label>
                            <input
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="d-grid mt-4">
                            <button type="submit" className="btn btn-primary">
                                Ingresar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;