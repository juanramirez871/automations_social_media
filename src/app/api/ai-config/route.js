import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

// GET - Obtener configuración actual de IA
export async function GET(request) {
  try {
    const supabase = createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener configuración de IA del perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ai_model, ai_api_key')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching AI config:', profileError);

      return NextResponse.json(
        { error: 'Failed to fetch AI configuration' },
        { status: 500 }
      );
    }

    // No devolver la API key completa por seguridad
    const maskedApiKey = profile?.ai_api_key
      ? `${profile.ai_api_key.substring(0, 8)}${'*'.repeat(Math.max(0, profile.ai_api_key.length - 8))}`
      : null;

    return NextResponse.json({
      provider: profile?.ai_model || null,
      apiKeyMasked: maskedApiKey,
      hasApiKey: !!profile?.ai_api_key,
    });
  } catch (error) {
    console.error('Error in GET /api/ai-config:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar configuración de IA
export async function PUT(request) {
  try {
    const body = await request.json();
    const { provider, apiKey } = body;

    // Validar campos requeridos
    if (!provider || !apiKey) {
      return NextResponse.json(
        {
          error: 'Provider and API key are required',
        },
        { status: 400 }
      );
    }

    // Validar proveedor
    const validProviders = ['gemini', 'openai'];

    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        {
          error: 'Invalid provider. Must be gemini or openai',
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Actualizar configuración de IA
    const { data, error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ai_model: provider,
        ai_api_key: apiKey.trim(),
        updated_at: new Date().toISOString(),
      })
      .select('ai_model')
      .single();

    if (updateError) {
      console.error('Error updating AI config:', updateError);

      return NextResponse.json(
        { error: 'Failed to update AI configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: data.ai_model,
      message: 'AI configuration updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/ai-config:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Validar API key
export async function POST(request) {
  try {
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        {
          error: 'Provider and API key are required',
        },
        { status: 400 }
      );
    }

    // Validar API key haciendo una llamada de prueba
    let isValid = false;
    let errorMessage = '';

    try {
      if (provider === 'gemini') {
        // Validar Gemini API
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // Hacer una llamada de prueba simple
        const result = await model.generateContent('Test');
        const response = await result.response;

        if (response.text()) {
          isValid = true;
        }
      } else if (provider === 'openai') {
        // Validar OpenAI API
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          isValid = true;
        } else {
          const errorData = await response.json();

          errorMessage = errorData.error?.message || 'Invalid API key';
        }
      }
    } catch (err) {
      console.error('API key validation error:', err);
      errorMessage = err.message || 'Failed to validate API key';
    }

    return NextResponse.json({
      valid: isValid,
      error: isValid ? null : errorMessage,
    });
  } catch (error) {
    console.error('Error in POST /api/ai-config:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
