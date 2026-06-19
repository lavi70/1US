import { useState, useEffect } from 'react';
import { Key, Info, ExternalLink, Shield, Sparkles, Server, Copy, Check } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function SettingsPage() {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect actual server URL automatically
  const detectedBackendUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
  const detectedFrontendUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;
  const redirectUri = `${serverUrl || detectedBackendUrl}/api/auth/callback`;

  useEffect(() => {
    // Load saved settings from backend
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.etsy_redirect_uri) {
        const url = new URL(data.etsy_redirect_uri);
        setServerUrl(`${url.protocol}//${url.host}`);
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    const payload = {
      etsy_api_key: apiKey || undefined,
      etsy_redirect_uri: redirectUri,
      anthropic_api_key: anthropicKey || undefined,
      frontend_url: detectedFrontendUrl,
    };

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSaved(true);
      toast.success('הגדרות נשמרו!');
      setTimeout(() => setSaved(false), 2000);
    } else {
      toast.error('שגיאה בשמירת הגדרות');
    }
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    toast.success('הועתק!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-4 pt-2">הגדרות</h1>

      {/* Server URL */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Server size={16} className="text-blue-500" /> כתובת השרת
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">כתובת הבקאנד (ברירת מחדל: אוטומטי)</label>
            <input className="input font-mono text-sm" value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder={detectedBackendUrl} />
            <p className="text-xs text-etsy-gray mt-1">רק אם הבקאנד על פורט/כתובת שונה</p>
          </div>
          <div>
            <label className="label text-xs">Redirect URI לרישום ב-Etsy</label>
            <div className="flex gap-2">
              <input className="input font-mono text-xs flex-1 bg-gray-50 text-blue-700" readOnly value={redirectUri} />
              <button onClick={copyRedirectUri} className="btn-secondary px-3 flex-shrink-0">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-orange-600 mt-1 font-medium">העתק את הכתובת הזו ל-Etsy Developer Portal</p>
          </div>
        </div>
      </div>

      {/* Etsy API */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Key size={16} className="text-etsy-orange" /> Etsy API Key
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">API Key (Keystring)</label>
            <input className="input font-mono text-sm" type="password" value={apiKey}
              onChange={e => setApiKey(e.target.value)} placeholder="הכנס API Key חדש לשינוי" />
            <p className="text-xs text-etsy-gray mt-1">השאר ריק אם לא רוצה לשנות</p>
          </div>
          <button onClick={save} className="btn-primary w-full">
            {saved ? '✓ נשמר!' : 'שמור הגדרות'}
          </button>
        </div>
      </div>

      {/* Anthropic AI */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-purple-500" /> Anthropic AI (Claude)
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label text-xs">API Key</label>
            <input className="input font-mono text-sm" type="password" value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
          </div>
          <button onClick={save} className="btn-primary w-full">
            {saved ? '✓ נשמר!' : 'שמור'}
          </button>
        </div>
      </div>

      {/* How to connect */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Info size={16} className="text-blue-500" /> איך מחברים חנות
        </h2>
        <ol className="space-y-2 text-sm text-etsy-gray">
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">1.</span>כנס לEtsy Developer Portal ← Your Apps</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">2.</span>צור App חדש ← Manage</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">3.</span>תחת Callback URLs הוסף את ה-Redirect URI שלמעלה</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">4.</span>העתק את ה-Keystring והכנס למעלה ← שמור</li>
          <li className="flex gap-2"><span className="text-etsy-orange font-bold">5.</span>חזור לחנויות ולחץ "חבר לEtsy"</li>
        </ol>
        <a href="https://www.etsy.com/developers/your-apps" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-etsy-orange mt-3">
          <ExternalLink size={14} /> פתח Etsy Developer Portal
        </a>
      </div>

      {/* Privacy */}
      <div className="card p-4">
        <h2 className="font-semibold flex items-center gap-2 mb-2">
          <Shield size={16} className="text-green-500" /> אבטחה ופרטיות
        </h2>
        <ul className="space-y-1.5 text-xs text-etsy-gray">
          <li>✓ כל הנתונים נשמרים מקומית בלבד</li>
          <li>✓ פרוקסי מוגדר לכל חנות בנפרד</li>
          <li>✓ Rate limiting אוטומטי לציות לכללי Etsy</li>
          <li>✓ PKCE OAuth2 — אין שמירת סיסמאות</li>
        </ul>
      </div>

      <p className="text-center text-xs text-etsy-gray mt-6 mb-2">Etsy Manager Pro v1.0</p>
    </div>
  );
}
