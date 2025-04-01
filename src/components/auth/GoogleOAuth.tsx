'use client';

export default function GoogleAuthButton() {
  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/url');
      if (!response.ok) {
        throw new Error('Failed to fetch Google Auth URL');
      }

      const { url } = await response.json();
      window.location.href = url; // Redirect to Google OAuth
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to connect to Google. Please try again.');
    }
  };

  return (
    <button
      onClick={handleLogin}
      className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
    >
      Connect Google Account
    </button>
  );
}
