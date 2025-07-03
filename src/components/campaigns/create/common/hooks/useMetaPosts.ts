import { useState, useEffect } from 'react';

/**
 * Interface representing a Meta post from Facebook/Instagram
 */
export interface MetaPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  attachments?: {
    data: Array<{
      media?: {
        image?: {
          src: string;
        };
      };
    }>;
  };
}

/**
 * Hook to fetch Meta posts based on content source
 */
export function useMetaPosts(contentSource?: string) {
  const [metaPosts, setMetaPosts] = useState<MetaPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      // Only fetch if contentSource is 'existing'
      if (contentSource !== 'existing') {
        return;
      }

      setLoadingPosts(true);
      setPostsError(null);

      try {
        const response = await fetch(`/api/meta/posts`);
        const data = await response.json();

        if (response.ok && data.success) {
          setMetaPosts(data.posts || []);
        } else {
          setPostsError(data.error || 'Failed to load posts');
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPostsError('Network error while loading posts');
      } finally {
        setLoadingPosts(false);
      }
    }

    fetchPosts();
  }, [contentSource]);

  // Mock data for development if needed
  useEffect(() => {
    if (metaPosts.length === 0 && contentSource === 'existing') {
      setMetaPosts([
        {
          id: 'post1',
          message: 'Check out our new products!',
          full_picture: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=500&auto=format&fit=crop',
          created_time: '2023-09-15T18:30:00Z'
        },
        {
          id: 'post2',
          message: 'Join us for the summer sale!',
          full_picture: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?q=80&w=500&auto=format&fit=crop',
          created_time: '2023-08-22T14:15:00Z'
        },
        {
          id: 'post3',
          message: 'New collection arrived!',
          full_picture: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=500&auto=format&fit=crop',
          created_time: '2023-07-10T09:45:00Z'
        },
        {
          id: 'post4',
          message: 'Behind the scenes at our workshop',
          full_picture: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=500&auto=format&fit=crop',
          created_time: '2023-06-05T16:20:00Z'
        },
        {
          id: 'post5',
          message: 'Customer testimonial video',
          full_picture: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=500&auto=format&fit=crop',
          created_time: '2023-05-18T11:30:00Z'
        }
      ]);
    }
  }, [contentSource, metaPosts.length]);

  return { metaPosts, loadingPosts, postsError };
}