export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usar el cliente de Supabase para borrar todos los mensajes del usuario
    // Nota: requiere políticas RLS que permitan borrar mensajes propios (user_id = auth.uid())
    const { supabase } = await import('@/lib/supabaseClient');
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
