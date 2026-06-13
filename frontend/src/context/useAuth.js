import { createContext, useContext } from 'react';

// El contexto y el hook viven en archivo propio (sin componentes)
// para que el Fast Refresh de Vite funcione correctamente.
export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);
