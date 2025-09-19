import { NextResponse } from 'next/server';
import { publishToMultiplePlatforms } from '../../../lib/publishers/index.js';
import {
  createSupabaseClient,
  validateUserId,
} from '../../../lib/utils/supabase.js';

export async function POST(request) {
  try {
    const {
      caption,
      imageUrl,
      videoUrl,
      platforms = ['instagram'],
      userId,
      privacyLevel,
    } = await request.json();

    // Validar entrada
    validateUserId(userId);

    // Crear cliente de Supabase
    const supabase = await createSupabaseClient();

    // Publicar en todas las plataformas usando el sistema modular
    console.log('Iniciando publicación en plataformas:', platforms);
    const results = await publishToMultiplePlatforms({
      caption,
      imageUrl,
      videoUrl,
      platforms,
      userId,
      privacyLevel,
      supabase,
    });

    console.log('Resultados de publicación completos:', results);

    // Determinar el estado general
    const hasSuccess = results.some(r => r.success);
    const hasErrors = results.some(r => !r.success);

    const response = {
      success: hasSuccess,
      results,
      message: hasSuccess
        ? hasErrors
          ? 'Publicado parcialmente'
          : 'Publicado exitosamente'
        : 'Error en la publicación',
    };

    console.log('Respuesta final de la API:', response);

    return NextResponse.json(response);
  } catch (error) {
    if (
      error.message === 'Usuario no especificado' ||
      error.message === 'Variables de Supabase no configuradas'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
