# Etsy Manager Pro

אפליקציית ניהול חנויות Etsy מקצועית - מרובה חנויות, פרוקסי, חקר שוק.

## תכונות

- **ניהול חנויות**: חיבור מרובה חנויות Etsy דרך OAuth2 רשמי
- **פרוקסי**: כל חנות עם IP שונה (HTTP/HTTPS proxy)
- **העלאת מוצרים**: ממשק שלבים נוח עם העלאת תמונות
- **חקר שוק**: ניתוח מילות מפתח, מתחרים, טרנדים
- **PWA**: עובד על iPhone כאפליקציה מקומית
- **Rate Limiting**: ציות אוטומטי לכללי Etsy (9 req/sec)

## התקנה מהירה

### דרישות
- Node.js 20+
- Etsy API Key (מ-etsy.com/developers)

### Backend
```bash
cd backend
cp .env.example .env
# ערוך את .env עם ה-API Key שלך
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker (production)
```bash
cp backend/.env.example backend/.env
# ערוך backend/.env
docker-compose up -d
```

## הגדרת Etsy API

1. כנס ל-https://www.etsy.com/developers/register
2. צור App חדש
3. הגדר Redirect URI: `http://localhost:3001/api/auth/callback`
4. העתק את ה-Keystring (API Key)
5. הדבק בהגדרות האפליקציה

## פרוקסי

בכל חנות ניתן להגדיר פרוקסי נפרד:
- כתובת: `http://user:pass@proxy.host:port`
- תמיכה ב-HTTP ו-HTTPS proxies
- כל חנות עובדת דרך ה-IP שלה

## ציות לתנאי Etsy

- שימוש ב-API רשמי בלבד (v3)
- Rate limiting אוטומטי
- OAuth2 רשמי לכל חנות
- אין scraping
