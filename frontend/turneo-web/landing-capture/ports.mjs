// Puertos propios de las capturas, distintos de los del e2e (5048 / 3000) para
// que ninguna de las dos herramientas pise a la otra ni a un entorno de dev.
export const API_PORT = 5148;
export const WEB_PORT = 3100;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
