"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Destino especial: el botón "atrás" del navegador. */
export const BACK = "__back__";

/**
 * Aviso al salir con cambios sin guardar: cerrar/recargar la pestaña, links
 * internos y el botón "atrás". `leaveTarget` es adónde quiso ir el usuario
 * (o BACK) mientras se le pregunta; `leave` sale a propósito, sin avisar.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  // Destino al que el usuario quiso ir con cambios sin guardar (o BACK).
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  // Cuando salimos a propósito (guardado o "salir sin guardar") no avisamos.
  const allowLeaveRef = useRef(false);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // 1) Cerrar pestaña / recargar: aviso nativo del navegador.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || allowLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 2) Clicks en links internos de la app (nav inferior, sidebar, etc.).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || allowLeaveRef.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(url.pathname + url.search);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // 3) Botón "atrás" del navegador / celular: dejamos una entrada "centinela"
  //    en el historial apenas hay cambios, y si vuelven atrás la reponemos y
  //    preguntamos.
  const guardArmedRef = useRef(false);
  useEffect(() => {
    if (!dirty || guardArmedRef.current) return;
    guardArmedRef.current = true;
    window.history.pushState({ brabusGuard: true }, "");
  }, [dirty]);

  useEffect(() => {
    const onPopState = () => {
      if (!guardArmedRef.current || allowLeaveRef.current) return;
      if (!dirtyRef.current) {
        // Sin cambios: dejamos seguir el "atrás" normalmente.
        guardArmedRef.current = false;
        window.history.back();
        return;
      }
      window.history.pushState({ brabusGuard: true }, "");
      setLeaveTarget(BACK);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const leave = (target: string) => {
    allowLeaveRef.current = true;
    if (target === BACK) {
      // Salteamos la entrada centinela y volvemos a la página anterior real.
      window.history.go(-2);
    } else {
      router.push(target);
    }
  };

  const navigate = (target: string) => {
    if (dirty) setLeaveTarget(target);
    else leave(target);
  };

  return { leaveTarget, setLeaveTarget, leave, navigate };
}
