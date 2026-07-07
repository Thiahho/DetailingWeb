// Verificar si hay sesión activa (indicador UI)
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isLoggedIn") === "true";
}

// Rol de la sesión activa ("Admin" | "Professional" | null)
export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
}

// Sesión activa Y con rol Admin — usar este guard en /admin/*, no isAuthenticated()
// a secas, porque un profesional logueado también pasa isAuthenticated().
export function isAdminAuthenticated(): boolean {
  return isAuthenticated() && getRole() === "Admin";
}

// Sesión activa Y con rol Professional — guard equivalente para /profesional/*.
export function isProfessionalAuthenticated(): boolean {
  return isAuthenticated() && getRole() === "Professional";
}

// Marcar sesión como activa (solo para UI)
export function setLoggedIn(email?: string, role?: string): void {
  localStorage.setItem("isLoggedIn", "true");
  if (email) localStorage.setItem("email", email);
  if (role) localStorage.setItem("role", role);
  // Disparar evento para que otros componentes se actualicen
  window.dispatchEvent(new Event("auth-change"));
}

// Cerrar sesión
export async function logout(): Promise<void> {
  // Limpiar localStorage PRIMERO antes de cualquier llamada
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("email");
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.dispatchEvent(new Event("auth-change"));

  try {
    // Llamar al backend para invalidar la cookie (usando proxy local)
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    // Continuar aunque falle el backend
  }

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
    // Usar el proxy local para que las cookies se envíen correctamente
    const response = await fetch("/api/auth/verify", {
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
  } catch {
    // Error de red — no limpiar la sesión, puede ser un fallo temporal
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
