import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received');
      return;
    }

    const redirectUri = `${window.location.origin}/Pro2Pro/callback`;
    login(code, redirectUri)
      .then(() => navigate('/daily', { replace: true }))
      .catch(err => setError(err.message || 'Login failed'));
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-6xl">{'\u274C'}</div>
        <h2 className="text-xl font-bold text-red-400">Login Failed</h2>
        <p className="text-gray-400">{error}</p>
        <a href="/" className="text-orange-400 hover:underline text-sm">Back to home</a>
      </div>
    );
  }

  return (
    <div className="text-center py-20 space-y-4">
      <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <h2 className="text-xl font-bold text-white">Logging in...</h2>
      <p className="text-sm text-gray-400">Connecting to Discord</p>
    </div>
  );
}
