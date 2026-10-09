const SESSION_MARKER = "Turneo_session_active";

// sessionStorage se resetea por ventana/pestaña nueva (a diferencia de
// localStorage, que sobrevive indefinidamente). Lo usamos para detectar
// "esta ventana es nueva" — devuelve true la primera vez que se llama en
// cada ventana, y deja la marca puesta para las llamadas siguientes.
function isFreshWindow(): boolean {
  if (sessionStorage.getItem(SESSION_MARKER) === "true") return false;
  sessionStorage.setItem(SESSION_MARKER, "true");
  return true;
}

// Cierra la sesión de una ventana nueva que heredó una cookie viva (el
// navegador la mantiene mientras su proceso siga corriendo, aunque se haya
// cerrado la ventana anterior). Costo aceptado: abrir una pestaña nueva del
// panel sin cerrar nada también cierra la sesión — no hay forma de
// distinguir ambos casos con las APIs del navegador.
//
// El logout al backend se dispara SIEMPRE, no solo si localStorage decía que
// había sesión — si no, cuando la cookie queda viva pero localStorage está
// limpio (ventana nueva que nunca pasó por setLoggedIn en este tab), el
// middleware (que sí ve la cookie) deja pasar a /admin/*, pero cada página
// (que mira localStorage) intenta mandar a /admin/login, y el middleware la
// rebota de vuelta porque la cookie sigue siendo válida — loop invisible que
// deja la página colgada en "Cargando..." para siempre. Sacar la cookie acá
// mantiene sincronizados los dos guards (middleware y cliente).
//
// Devuelve (y deja en pendingStaleLogout) la promesa del logout: si responde
// DESPUÉS de un login hecho en esta misma ventana, borra la cookie recién
// creada y la siguiente navegación rebota a /admin/login. verifySession() la
// espera antes de dejar ver el formulario de login.
let pendingStaleLogout: Promise<void> | null = null;

function forceLogoutStaleWindow(): Promise<void> {
  const hadSession = localStorage.getItem("isLoggedIn") === "true";
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("email");
  localStorage.removeItem("role");
  localStorage.removeItem("hasPanelAccess");
  if (hadSession) {
    window.dispatchEvent(new Event("auth-change"));
  }
  const request = fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    .then(() => {}, () => {})
    .finally(() => {
      if (pendingStaleLogout === request) pendingStaleLogout = null;
    });
  pendingStaleLogout = request;
  return request;
}

// Verificar si hay sesión activa — SOLO indicador de UI (localStorage), no una
// verificación real. La protección de datos vive en el backend ([Authorize] +
// JWT en cookie HttpOnly); esta función no puede gatear acceso a datos, solo
// decidir qué mostrar/ocultar en la interfaz. Para confirmar sesión contra el
// servidor, usar verifySession().
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  if (isFreshWindow()) forceLogoutStaleWindow();
  return localStorage.getItem("isLoggedIn") === "true";
}

// Rol de la sesión activa ("Admin" | "Professional" | null)
export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("role");
}

// Sesión activa Y con acceso al panel admin — usar este guard en /admin/*, no
// isAuthenticated() a secas, porque un profesional logueado también pasa
// isAuthenticated(). Admin y Staff siempre entran (con acceso acotado por
// módulo para Staff, ver usePermissions). Un profesional también entra si
// desde Permisos se le otorgó algún módulo — mismo login que usa para su
// propia agenda, "hasPanelAccess" viaja en el login (ver setLoggedIn). El
// backend es quien realmente lo hace cumplir vía RequirePermission, esto solo
// decide si entra al panel.
export function isAdminAuthenticated(): boolean {
  if (!isAuthenticated()) return false;
  const role = getRole();
  if (role === "Admin" || role === "Staff") return true;
  return role === "Professional" && localStorage.getItem("hasPanelAccess") === "true";
}

// Sesión activa Y con rol Admin exactamente (no Staff) — usar para gatear
// funciones exclusivas del dueño de la cuenta, como administrar permisos.
export function isFullAdmin(): boolean {
  return isAuthenticated() && getRole() === "Admin";
}

// Sesión activa Y con rol Professional — guard equivalente para /profesional/*.
export function isProfessionalAuthenticated(): boolean {
  return isAuthenticated() && getRole() === "Professional";
}

// Marcar sesión como activa (solo para UI)
export function setLoggedIn(email?: string, role?: string, hasPanelAccess?: boolean): void {
  // Login legítimo en esta ventana — marcarla para que isFreshWindow() no la
  // trate como heredada en la próxima verificación dentro de la misma ventana.
  sessionStorage.setItem(SESSION_MARKER, "true");
  localStorage.setItem("isLoggedIn", "true");
  if (email) localStorage.setItem("email", email);
  if (role) localStorage.setItem("role", role);
  // Solo se pisa cuando el caller lo manda explícitamente (login real) — verifySession()
  // no lo pasa al restaurar sesión en un refresh, y no debe borrar el valor ya guardado.
  if (hasPanelAccess !== undefined) localStorage.setItem("hasPanelAccess", hasPanelAccess ? "true" : "false");
  // Disparar evento para que otros componentes se actualicen
  window.dispatchEvent(new Event("auth-change"));
}

// Cerrar sesión
export async function logout(): Promise<void> {
  // Limpiar localStorage PRIMERO antes de cualquier llamada
  sessionStorage.removeItem(SESSION_MARKER);
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
  // Ventana nueva: no confiar en que el navegador haya mantenido la cookie
  // viva — cerrar la sesión explícitamente en vez de preguntarle al backend
  // (que la validaría igual, porque la cookie en sí sigue siendo válida).
  if (typeof window !== "undefined" && isFreshWindow()) {
    await forceLogoutStaleWindow();
    return false;
  }

  // Un guard de página (isAuthenticated) pudo haber disparado el logout justo
  // antes de redirigir acá: esperar a que termine antes de seguir.
  if (pendingStaleLogout) await pendingStaleLogout;

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
