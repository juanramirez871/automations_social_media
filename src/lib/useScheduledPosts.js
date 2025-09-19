import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function useScheduledPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener usuario actual
  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  };

  // Cargar publicaciones programadas
  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/scheduled-posts?userId=${user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load posts');
      }

      setPosts(data.posts || []);
    } catch (err) {
      console.error('Error loading scheduled posts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Crear nueva publicación programada
  const createPost = async postData => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          ...postData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      // Actualizar lista local
      setPosts(prev => [...prev, data.post]);

      return data.post;
    } catch (err) {
      console.error('Error creating scheduled post:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar publicación programada
  const updatePost = async (id, updateData) => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/scheduled-posts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          userId: user.id,
          ...updateData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update post');
      }

      // Actualizar lista local
      setPosts(prev => prev.map(post => (post.id === id ? data.post : post)));

      return data.post;
    } catch (err) {
      console.error('Error updating scheduled post:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Eliminar publicación programada
  const deletePost = async id => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(
        `/api/scheduled-posts?id=${id}&userId=${user.id}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      // Actualizar lista local
      setPosts(prev => prev.filter(post => post.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting scheduled post:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Obtener publicaciones por fecha (para el calendario)
  const getPostsByDate = date => {
    const dateStr =
      date instanceof Date ? date.toISOString().split('T')[0] : date;

    return posts.filter(post => post.scheduled_date === dateStr);
  };

  // Obtener publicaciones agrupadas por fecha
  const getPostsGroupedByDate = () => {
    const grouped = {};

    posts.forEach(post => {
      const date = post.scheduled_date;

      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(post);
    });

    return grouped;
  };

  // Cargar posts al montar el componente
  useEffect(() => {
    loadPosts();
  }, []);

  return {
    posts,
    loading,
    error,
    loadPosts,
    createPost,
    updatePost,
    deletePost,
    getPostsByDate,
    getPostsGroupedByDate,
  };
}
