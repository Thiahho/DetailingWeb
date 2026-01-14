import { API_BASE_URL } from "./config";

// Verificar si hay sesión activa (indicador UI)
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isLoggedIn") === "true";
}

// Marcar sesión como activa (solo para UI)
export function setLoggedIn(email?: string): void {
  localStorage.setItem("isLoggedIn", "true");
  if (email) localStorage.setItem("email", email);
  // Disparar evento para que otros componentes se actualicen
  window.dispatchEvent(new Event("auth-change"));
}

// Cerrar sesión
export async function logout(): Promise<void> {
  try {
    // Llamar al backend para invalidar la cookie
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    // Continuar con logout local aunque falle el backend
  }

  // Limpiar todo el localStorage relacionado con auth
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("email");
  localStorage.removeItem("token"); // Limpiar residuo de versión anterior
  localStorage.removeItem("role");
  window.dispatchEvent(new Event("auth-change"));
  window.location.href = "/";
}

// Limpiar datos residuales de versiones anteriores
export function cleanupLegacyStorage(): void {
  // Si existe "token" en localStorage, eliminarlo (ahora usamos HttpOnly cookie)
  if (localStorage.getItem("token")) {
    localStorage.removeItem("token");
  }
}

// Verificar sesión con el backend (útil al cargar la página)
export async function verifySession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      setLoggedIn(data.email);
      return true;
    } else {
      // Sesión inválida, limpiar localStorage
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("email");
      window.dispatchEvent(new Event("auth-change"));
      return false;
    }
  } catch (error) {
    return false;
  }
}

// Fetch con credenciales (cookies HttpOnly)
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
    },
  });
}
