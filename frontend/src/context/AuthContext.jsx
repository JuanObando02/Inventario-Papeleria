import { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Al cargar la app, revisamos si ya había un token guardado
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('username');
        const storedRole = localStorage.getItem('user_role');
        const storedSedeId = localStorage.getItem('user_sede_id');
        const storedSedeNombre = localStorage.getItem('user_sede_nombre');

        if (storedToken) {
            // Configurar Axios para que siempre envíe el token
            api.defaults.headers.common['Authorization'] = `Token ${storedToken}`;
            setUser({
                username: storedUser,
                rol: storedRole,
                sede_id: storedSedeId ? parseInt(storedSedeId) : null,
                sede_nombre: storedSedeNombre
            });
        }
        setLoading(false);
    }, []);// almontar useEffect 

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

export const useAuth = () => useContext(AuthContext);