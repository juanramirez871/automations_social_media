import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Obtener publicaciones programadas del usuario
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_datetime', { ascending: true });

    if (error) {
      console.error('Error fetching scheduled posts:', error);
      return NextResponse.json({ error: 'Failed to fetch scheduled posts' }, { status: 500 });
    }

    return NextResponse.json({ posts: data });
  } catch (error) {
    console.error('Error in GET /api/scheduled-posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Crear nueva publicación programada
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, content, platforms, scheduledDate, scheduledTime, mediaUrls } = body;

    if (!userId || !content || !platforms || !scheduledDate || !scheduledTime) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, content, platforms, scheduledDate, scheduledTime' 
      }, { status: 400 });
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ 
        error: 'Platforms must be a non-empty array' 
      }, { status: 400 });
    }

    // Validar que la fecha sea futura
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledDateTime <= new Date()) {
      return NextResponse.json({ 
        error: 'Scheduled date and time must be in the future' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        content,
        platforms,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        media_urls: mediaUrls || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scheduled post:', error);
      return NextResponse.json({ error: 'Failed to create scheduled post' }, { status: 500 });
    }

    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/scheduled-posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Actualizar publicación programada
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, userId, content, platforms, scheduledDate, scheduledTime, mediaUrls, status } = body;

    if (!id || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, userId' 
      }, { status: 400 });
    }

    // Construir objeto de actualización
    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (platforms !== undefined) {
      if (!Array.isArray(platforms) || platforms.length === 0) {
        return NextResponse.json({ 
          error: 'Platforms must be a non-empty array' 
        }, { status: 400 });
      }
      updateData.platforms = platforms;
    }
    if (scheduledDate !== undefined) updateData.scheduled_date = scheduledDate;
    if (scheduledTime !== undefined) updateData.scheduled_time = scheduledTime;
    if (mediaUrls !== undefined) updateData.media_urls = mediaUrls;
    if (status !== undefined) updateData.status = status;

    // Validar fecha futura si se está actualizando
    if (scheduledDate && scheduledTime) {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDateTime <= new Date()) {
        return NextResponse.json({ 
          error: 'Scheduled date and time must be in the future' 
        }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating scheduled post:', error);
      return NextResponse.json({ error: 'Failed to update scheduled post' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Scheduled post not found' }, { status: 404 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Error in PUT /api/scheduled-posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Eliminar publicación programada
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    
    if (!id || !userId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: id, userId' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error deleting scheduled post:', error);
      return NextResponse.json({ error: 'Failed to delete scheduled post' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Scheduled post not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Scheduled post deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/scheduled-posts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}