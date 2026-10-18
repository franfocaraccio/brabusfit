/** Resultado estándar de una operación (web y mobile). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = <T = undefined>(error: string): ActionResult<T> => ({
  ok: false,
  error,
});
