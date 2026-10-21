import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { getClient, type ClientDetail } from "@brabus/supabase";

import { ClientForm } from "@/components/clients";
import { Loading, NotFound } from "@/components/loading";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth";

export default function EditarClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [detail, setDetail] = useState<ClientDetail | null | undefined>(undefined);

  useEffect(() => {
    if (session) getClient(supabase, session.user.id, id).then(setDetail);
  }, [id, session]);

  if (detail === undefined) return <Loading />;
  if (detail === null) return <NotFound text="No se encontró el cliente." />;
  return (
    <ClientForm clientId={id} initial={detail.data} emailLocked={detail.appAccess !== "none"} />
  );
}
