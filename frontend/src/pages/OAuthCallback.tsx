import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function OAuthCallback() {
  const [params] = useSearchParams();

  useEffect(() => {
    const connected = params.get('connected');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage({ type: 'etsy_oauth', connected, error }, window.location.origin);
      window.close();
    } else {
      window.location.replace('/shops');
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-etsy-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-etsy-gray text-sm">מחבר לחנות...</p>
      </div>
    </div>
  );
}
