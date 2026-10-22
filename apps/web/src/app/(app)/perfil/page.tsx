import { redirect } from "next/navigation";

/** Perfil se movió a Ajustes (links viejos). */
export default function PerfilRedirect() {
  redirect("/ajustes/perfil");
}
