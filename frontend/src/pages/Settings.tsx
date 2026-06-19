import { useState } from 'react';
import { Key, Info, ExternalLink, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('etsy_api_key') || '');
  const [redirectUri, setRedirectUri] = useState(localStorage.getItem('etsy_redirect_uri') || 'http://localhost:3001/api/auth/callback');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    // In production, these would be sent to backend to update .env
    localStorage.setItem('etsy_api_key', apiKey);
    localStorage.setItem('etsy_redirect_uri', redirectUri);

    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etsy_api_key: apiKey, etsy_redirect_uri: redirectUri }),
    }).catch(() => {});

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-6 pt-2">הגדרות</h1>

      {/* Etsy API */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Key size={16} className="text-etsy-orange" /> Etsy API
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label">API Key (Keystring)</label>
            <input className="input font-mono text-sm" type="password" value={apiKey}
              onChange={e => setApiKey(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <label className="label">Redirect URI</label>
            <input className="input font-mono text-sm" value={redirectUri}
              onChange={e => setRedirectUri(e.target.value)} />
          </div>
          <button onClick={save} className="btn-primary w-full">
            {saved ? '✓ נשמר!' : 'שמור הגדרות'}
          </button>
        </div>
      </div>

      {/* How to get API key */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Info size={16} className="text-blue-500" /> איך מקבלים API Key
        </h2>
        <ol className="space-y-2 text-sm text-etsy-gray">
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">1.</span>היכנס ל-Etsy Developer Portal</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">2.</span>צור App חדש ("Create a new app")</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">3.</span>הוסף את Redirect URI לרשימה המאושרת</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">4.</span>העתק את ה-Keystring והדבק למעלה</li>
        </ol>
        <a href="https://www.etsy.com/developers/register" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-etsy-orange mt-3">
          <ExternalLink size={14} /> פתח Etsy Developer Portal
        </a>
      </div>

      {/* Privacy */}
      <div className="card p-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Shield size={16} className="text-green-500" /> אבטחה ופרטיות
        </h2>
        <ul className="space-y-2 text-sm text-etsy-gray">
          <li>✓ כל הנתונים נשמרים מקומית בלבד</li>
          <li>✓ אין שיתוף מידע עם צדדים שלישיים</li>
          <li>✓ פרוקסי מוגדר לכל חנות בנפרד</li>
          <li>✓ Tokens מוצפנים ב-SQLite מקומי</li>
          <li>✓ Rate limiting אוטומטי לציות לכללי Etsy</li>
        </ul>
      </div>

      <p className="text-center text-xs text-etsy-gray mt-6">Etsy Manager Pro v1.0</p>
    </div>
  );
}
