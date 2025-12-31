import axios from 'axios';

const api = axios.create({
    // Busca la variable de entorno VITE_API_URL. Si no existe (en tu PC), usa localhost.
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/',
    timeout: 10000, // Si tarda más de 5 segundos, cancela
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Interceptamos todas las peticiones para agregar el Token automáticamente
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;