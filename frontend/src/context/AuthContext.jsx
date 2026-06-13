import { useState } from 'react';
import api from '../api/axios';
import { AuthContext } from './useAuth';

// Lee la sesión guardada en localStorage (si existe) una sola vez al montar
const leerSesionGuardada = () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return null;

    // Configurar Axios para que siempre envíe el token
    api.defaults.headers.common['Authorization'] = `Token ${storedToken}`;

    const storedSedeId = localStorage.getItem('user_sede_id');
    return {
        username: localStorage.getItem('username'),
        rol: localStorage.getItem('user_role'),
        sede_id: storedSedeId ? parseInt(storedSedeId) : null,
        sede_nombre: localStorage.getItem('user_sede_nombre')
    };
};

export const AuthProvider = ({ children }) => {
    // Inicialización perezosa: se carga de forma síncrona, sin useEffect ni render extra
    const [user, setUser] = useState(leerSesionGuardada);
    const loading = false; // la sesión se resuelve de forma síncrona

    // Función para Iniciar Sesión (Ahora recibe extraData con rol y sede)
    const login = (token, username, userId, extraData = {}) => {
        // 1. Guardar en disco (LocalStorage)
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);

        if (extraData.rol) localStorage.setItem('user_role', extraData.rol);
        if (extraData.sede_id) localStorage.setItem('user_sede_id', extraData.sede_id);
        if (extraData.sede_nombre) localStorage.setItem('user_sede_nombre', extraData.sede_nombre);

        // 2. Configurar Axios
        api.defaults.headers.common['Authorization'] = `Token ${token}`;

        // 3. Guardar en memoria (State)
        setUser({
            username,
            id: userId,
            rol: extraData.rol,
            sede_id: extraData.sede_id,
            sede_nombre: extraData.sede_nombre
        });
    };

    // Función para Salir
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_sede_id');
        localStorage.removeItem('user_sede_nombre');

        delete api.defaults.headers.common['Authorization'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};