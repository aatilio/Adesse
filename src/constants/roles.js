/**
 * Valores de `usuarios.rol` (PostgreSQL / Supabase).
 * 1 = administrador (vista profesor), 2 = estudiante.
 */
export const ROL = {
  ADMIN: 1,
  ESTUDIANTE: 2,
};

/** Roles usados solo en la UI (rutas y componentes). */
export const UI_ROLE = {
  PROFESOR: 'profesor',
  ALUMNO: 'alumno',
};

/**
 * @param {unknown} rol
 * @returns {'profesor' | 'alumno' | null}
 */
export function mapRolToUiRole(rol) {
  const r = Number(rol);
  if (r === ROL.ADMIN) return UI_ROLE.PROFESOR;
  if (r === ROL.ESTUDIANTE) return UI_ROLE.ALUMNO;
  return null;
}

/**
 * Sesión en localStorage / estado: asegura `rol` numérico y `role` de UI.
 * @param {unknown} raw
 * @returns {object | null}
 */
export function normalizeSessionUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = Number(raw.rol);
  let role =
    r === ROL.ADMIN ? UI_ROLE.PROFESOR :
    r === ROL.ESTUDIANTE ? UI_ROLE.ALUMNO :
    raw.role === UI_ROLE.PROFESOR || raw.role === UI_ROLE.ALUMNO ? raw.role : null;
  if (!role) return null;
  const rolNorm = r === ROL.ADMIN || r === ROL.ESTUDIANTE ? r : (role === UI_ROLE.PROFESOR ? ROL.ADMIN : ROL.ESTUDIANTE);
  return { ...raw, rol: rolNorm, role };
}
