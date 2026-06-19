import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const ENV_PATH = path.join(process.cwd(), '.env');

router.post('/', (req, res) => {
  try {
    const { etsy_api_key, etsy_redirect_uri, anthropic_api_key, frontend_url } = req.body;
    let content = '';

    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, 'utf8');
    }

    const update = (key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const line = `${key}=${value}`;
      if (regex.test(content)) {
        content = content.replace(regex, line);
      } else {
        content += `\n${line}`;
      }
    };

    if (etsy_api_key) {
      update('ETSY_API_KEY', etsy_api_key);
      process.env.ETSY_API_KEY = etsy_api_key;
    }
    if (etsy_redirect_uri) {
      update('ETSY_REDIRECT_URI', etsy_redirect_uri);
      process.env.ETSY_REDIRECT_URI = etsy_redirect_uri;
    }
    if (anthropic_api_key) {
      update('ANTHROPIC_API_KEY', anthropic_api_key);
      process.env.ANTHROPIC_API_KEY = anthropic_api_key;
    }
    if (frontend_url) {
      update('FRONTEND_URL', frontend_url);
      process.env.FRONTEND_URL = frontend_url;
    }

    fs.writeFileSync(ENV_PATH, content.trim() + '\n');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  res.json({
    etsy_api_key_set: !!process.env.ETSY_API_KEY,
    etsy_redirect_uri: process.env.ETSY_REDIRECT_URI || '',
    frontend_url: process.env.FRONTEND_URL || '',
  });
});

export default router;
