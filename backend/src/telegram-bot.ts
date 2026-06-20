/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
// ╔══════════════════════════════════════════╗
// ║         🤖 BOT BY YANIV                 ║
// ║   Server Manager + Shop + PayPal        ║
// ╚══════════════════════════════════════════╝

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TelegramBot = require('node-telegram-bot-api');
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';

const execAsync = promisify(exec);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'

if (!TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN is not set'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── In-memory store (replace with DB in production) ─────────────────────────
const pendingPayments: Record<string, any> = {};
const userCarts: Record<number, any[]> = {};

// ─── Product Catalog ──────────────────────────────────────────────────────────
const PRODUCTS = {
  'discord_server': { name: '🎮 שרת דיסקורד מוכן', price: 29.99, desc: 'שרת דיסקורד מוגדר עם ערוצים, בוטים ותפקידים' },
  'discord_bot': { name: '🤖 בוט דיסקורד', price: 49.99, desc: 'בוט דיסקורד מותאם אישית' },
  'website_basic': { name: '🌐 אתר בסיסי', price: 99.99, desc: 'אתר Landing Page מקצועי' },
  'website_shop': { name: '🛒 חנות אונליין', price: 199.99, desc: 'חנות אונליין מלאה עם תשלומים' },
  'vps_1gb': { name: '🖥️ VPS 1GB RAM', price: 5.99, desc: 'שרת וירטואלי 1GB RAM, 20GB SSD' },
  'vps_2gb': { name: '🖥️ VPS 2GB RAM', price: 9.99, desc: 'שרת וירטואלי 2GB RAM, 40GB SSD' },
  'vps_4gb': { name: '🖥️ VPS 4GB RAM', price: 19.99, desc: 'שרת וירטואלי 4GB RAM, 80GB SSD' },
  'telegram_bot': { name: '📱 בוט טלגרם', price: 39.99, desc: 'בוט טלגרם מותאם אישית כמו זה' },
  'image_pack': { name: '🖼️ חבילת תמונות AI', price: 14.99, desc: '50 תמונות AI מותאמות אישית' },
  'video_pack': { name: '🎥 חבילת סרטונים', price: 24.99, desc: '10 סרטונים קצרים לעסק' },
  'stars_100': { name: '⭐ 100 כוכבי טלגרם', price: 4.99, desc: '100 Telegram Stars' },
  'stars_500': { name: '⭐ 500 כוכבי טלגרם', price: 19.99, desc: '500 Telegram Stars' },
  'stars_1000': { name: '⭐ 1000 כוכבי טלגרם', price: 34.99, desc: '1000 Telegram Stars' },
  'code_review': { name: '💻 Code Review', price: 29.99, desc: 'סקירת קוד מקצועית' },
  'seo_pack': { name: '📈 חבילת SEO', price: 79.99, desc: 'אופטימיזציה למנועי חיפוש' },
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
function isAdmin(userId: number): boolean {
  if (ADMIN_IDS.length === 0) return true;
  return ADMIN_IDS.includes(userId);
}

function requireAdmin(msg: any): boolean {
  if (!isAdmin(msg.from?.id || 0)) {
    bot.sendMessage(msg.chat.id, '⛔ אין לך הרשאה לפקודה זו.');
    return false;
  }
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
    return (stdout || stderr || '(אין פלט)').trim();
  } catch (e: any) {
    return `שגיאה: ${e.message}`;
  }
}

function send(chatId: number, text: string) {
  const MAX = 4000;
  const safe = text.replace(/`/g, "'");
  if (safe.length <= MAX) {
    return bot.sendMessage(chatId, `\`\`\`\n${safe}\n\`\`\``, { parse_mode: 'Markdown' });
  }
  const chunks = safe.match(new RegExp(`.{1,${MAX}}`, 'gs')) || [];
  return Promise.all(chunks.map(chunk =>
    bot.sendMessage(chatId, `\`\`\`\n${chunk}\n\`\`\``, { parse_mode: 'Markdown' })
  ));
}

function sendMd(chatId: number, text: string) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

function notifyAdmin(text: string) {
  for (const id of ADMIN_IDS) {
    bot.sendMessage(id, `🔔 *התראה*\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
  }
}

// ─── PayPal ───────────────────────────────────────────────────────────────────
async function getPayPalToken(): Promise<string> {
  const base = PAYPAL_MODE === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials';
    const req = https.request({
      hostname: base, path: '/v1/oauth2/token', method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data).access_token); } catch { reject(new Error('PayPal auth failed')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function createPayPalOrder(amount: number, currency = 'USD', description: string): Promise<any> {
  const base = PAYPAL_MODE === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
  const token = await getPayPalToken();
  const body = JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: currency, value: amount.toFixed(2) }, description }]
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: base, path: '/v2/checkout/orders', method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Parse error')); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg: any) => {
  const name = msg.from?.first_name || 'משתמש';
  sendMd(msg.chat.id, `👋 שלום *${name}*!

🤖 *בוט ניהול שרתים + חנות*
_By Yaniv_

הקלד /help לכל הפקודות
הקלד /shop לחנות שלנו 🛒`);
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg: any) => {
  sendMd(msg.chat.id, `
*🤖 בוט By Yaniv — כל הפקודות*

*📊 שרת*
/status /uptime /uname /hostname /ps /top /df /du /ifconfig /netstat /ping

*🔧 תהליכים*
/kill <PID> /processes /meminfo /cpuinfo /loadavg

*📁 קבצים*
/ls /cat /tail /find /mkdir /rm /mv /cp /chmod /zip /unzip

*⚙️ שירותים*
/services /svcstart /svcstop /svcrestart /svcstatus /svclog

*🐋 Docker*
/docker /dockerall /dockerlogs /dockerstart /dockerstop /dockerrestart /dockerstats /dockerpull /dockerrm

*🌐 רשת*
/curl /wget /dns /whois /portscan /traceroute /speedtest

*💻 קוד ופיתוח*
/code <קוד> — הרץ קוד JavaScript
/exec <פקודה> — פקודת Shell
/env /cron /cronlist /nginx /apache

*🏗️ בנה אתר*
/buildsite <שם> — צור תבנית אתר
/sitepreview — הצג אתרים שנבנו

*💳 חנות ותשלומים*
/shop — חנות מוצרים
/buy <מוצר> — רכישה
/cart — עגלת קניות
/addcart <מוצר> — הוסף לעגלה
/checkout — תשלום PayPal
/orders — הזמנות שלי
/balance — יתרה

*🔔 התראות*
/alerts — הגדרות התראות
/setalert <סוג> — הגדר התראה
/monitor <שירות> — מעקב שירות

*📈 סטטיסטיקות*
/stats — סטטיסטיקות מכירות
/visitors — מבקרים

*ℹ️ אחר*
/about — אודות הבוט
/version — גרסה
/ping — בדיקת חיבור

_Bot by Yaniv 🚀_
`);
});

// ─── /about ───────────────────────────────────────────────────────────────────
bot.onText(/\/about$/, (msg: any) => {
  sendMd(msg.chat.id, `
*🤖 אודות הבוט*

👨‍💻 *יוצר:* Yaniv
🚀 *גרסה:* 2.0.0
📅 *תאריך:* 2026

*יכולות:*
✅ ניהול שרתים מלא
✅ חנות דיגיטלית
✅ תשלומי PayPal
✅ בניית אתרים
✅ ניהול Docker
✅ התראות בזמן אמת
✅ הרצת קוד JavaScript
✅ ניהול קבצים
✅ ניטור שירותים

_Made with ❤️ by Yaniv_
`);
});

// ─── /version ─────────────────────────────────────────────────────────────────
bot.onText(/\/version$/, (msg: any) => {
  sendMd(msg.chat.id, `*Bot v2.0.0* by Yaniv\nNode.js ${process.version}`);
});

// ─── SERVER COMMANDS ──────────────────────────────────────────────────────────
bot.onText(/\/status$/, async (msg: any) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = ((usedMem / totalMem) * 100).toFixed(1);
  const load = os.loadavg();
  let diskOut = '';
  try { diskOut = execSync('df -h /').toString().split('\n')[1]; } catch { diskOut = 'N/A'; }
  sendMd(msg.chat.id, `
📊 *סטטוס שרת*
_By Yaniv_

🖥️ *CPU:* ${cpus[0]?.model || 'N/A'} (${cpus.length} ליבות)
📈 *עומס:* ${load.map(l => l.toFixed(2)).join(' / ')}
💾 *RAM:* ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${memPct}%)
💿 *דיסק:* ${diskOut}
⏱️ *Uptime:* ${formatUptime(os.uptime())}
🏠 *Host:* ${os.hostname()}
🐧 *OS:* ${os.type()} ${os.release()}
`);
});

bot.onText(/\/uptime$/, async (msg: any) => {
  const out = await runCmd('uptime');
  send(msg.chat.id, out);
});

bot.onText(/\/uname$/, async (msg: any) => {
  const out = await runCmd('uname -a');
  send(msg.chat.id, out);
});

bot.onText(/\/hostname$/, async (msg: any) => {
  const out = await runCmd('hostname -I 2>/dev/null || ip addr show | grep "inet "');
  send(msg.chat.id, `Hostname: ${os.hostname()}\nIPs:\n${out}`);
});

bot.onText(/\/ps$/, async (msg: any) => {
  const out = await runCmd('ps aux --sort=-%cpu | head -20');
  send(msg.chat.id, out);
});

bot.onText(/\/top$/, async (msg: any) => {
  const out = await runCmd('ps aux --sort=-%cpu | head -11');
  send(msg.chat.id, `🔝 Top 10 תהליכים:\n\n${out}`);
});

bot.onText(/\/processes$/, async (msg: any) => {
  const out = await runCmd('ps aux --sort=-%mem | head -15');
  send(msg.chat.id, out);
});

bot.onText(/\/meminfo$/, async (msg: any) => {
  const out = await runCmd('cat /proc/meminfo 2>/dev/null | head -20');
  send(msg.chat.id, out);
});

bot.onText(/\/cpuinfo$/, async (msg: any) => {
  const out = await runCmd('cat /proc/cpuinfo 2>/dev/null | grep -E "model name|cpu MHz|cache" | head -10');
  send(msg.chat.id, out);
});

bot.onText(/\/loadavg$/, async (msg: any) => {
  const load = os.loadavg();
  send(msg.chat.id, `Load Average:\n1 min: ${load[0].toFixed(2)}\n5 min: ${load[1].toFixed(2)}\n15 min: ${load[2].toFixed(2)}`);
});

bot.onText(/\/kill (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const pid = parseInt(match?.[1]?.trim());
  if (isNaN(pid)) return send(msg.chat.id, 'שימוש: /kill <PID>');
  const out = await runCmd(`kill -15 ${pid} && echo "SIGTERM sent to PID ${pid}"`);
  send(msg.chat.id, out);
  notifyAdmin(`⚠️ תהליך ${pid} נהרג על ידי ${msg.from?.first_name}`);
});

bot.onText(/\/df$/, async (msg: any) => {
  const out = await runCmd('df -h');
  send(msg.chat.id, out);
});

bot.onText(/\/du (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const dir = match?.[1]?.trim() || '/';
  const out = await runCmd(`du -sh "${dir}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/ifconfig$/, async (msg: any) => {
  const out = await runCmd('ip addr show 2>/dev/null || ifconfig 2>/dev/null');
  send(msg.chat.id, out);
});

bot.onText(/\/netstat$/, async (msg: any) => {
  const out = await runCmd('ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null');
  send(msg.chat.id, out);
});

bot.onText(/\/ping (.+)/, async (msg: any, match: any) => {
  const host = match?.[1]?.trim();
  if (!host) return send(msg.chat.id, 'שימוש: /ping <host>');
  const out = await runCmd(`ping -c 4 "${host}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dns (.+)/, async (msg: any, match: any) => {
  const host = match?.[1]?.trim();
  const out = await runCmd(`nslookup "${host}" 2>&1 || dig "${host}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/whois (.+)/, async (msg: any, match: any) => {
  const host = match?.[1]?.trim();
  const out = await runCmd(`whois "${host}" 2>&1 | head -30`);
  send(msg.chat.id, out);
});

bot.onText(/\/traceroute (.+)/, async (msg: any, match: any) => {
  const host = match?.[1]?.trim();
  const out = await runCmd(`traceroute -m 10 "${host}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── FILES ────────────────────────────────────────────────────────────────────
bot.onText(/\/ls(?:\s+(.+))?/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const dir = match?.[1]?.trim() || '.';
  const out = await runCmd(`ls -lah "${dir}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/cat (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const file = match?.[1]?.trim();
  try {
    const content = fs.readFileSync(file, 'utf8').slice(0, 3500);
    send(msg.chat.id, content);
  } catch (e: any) { send(msg.chat.id, `שגיאה: ${e.message}`); }
});

bot.onText(/\/tail (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const file = match?.[1]?.trim();
  const out = await runCmd(`tail -50 "${file}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/find (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const args = match?.[1]?.trim().split(/\s+/);
  const dir = args?.[0] || '.';
  const name = args?.[1] || '*';
  const out = await runCmd(`find "${dir}" -name "${name}" 2>/dev/null | head -50`);
  send(msg.chat.id, out);
});

bot.onText(/\/mkdir (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const dir = match?.[1]?.trim();
  const out = await runCmd(`mkdir -p "${dir}" && echo "✅ תיקייה נוצרה: ${dir}"`);
  send(msg.chat.id, out);
});

bot.onText(/\/rm (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const file = match?.[1]?.trim();
  const out = await runCmd(`rm -rf "${file}" && echo "✅ נמחק: ${file}"`);
  send(msg.chat.id, out);
  notifyAdmin(`🗑️ קובץ נמחק: ${file} על ידי ${msg.from?.first_name}`);
});

bot.onText(/\/chmod (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const args = match?.[1]?.trim().split(/\s+/);
  const out = await runCmd(`chmod ${args[0]} "${args[1]}" 2>&1 && echo "✅ הרשאות שונו"`);
  send(msg.chat.id, out);
});

// ─── SERVICES ─────────────────────────────────────────────────────────────────
bot.onText(/\/services$/, async (msg: any) => {
  const out = await runCmd('systemctl list-units --type=service --state=running 2>/dev/null | head -30');
  send(msg.chat.id, out);
});

bot.onText(/\/svcstart (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl start "${svc}" 2>&1 && echo "✅ ${svc} הופעל"`);
  send(msg.chat.id, out);
  notifyAdmin(`🟢 שירות הופעל: ${svc}`);
});

bot.onText(/\/svcstop (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl stop "${svc}" 2>&1 && echo "🛑 ${svc} נעצר"`);
  send(msg.chat.id, out);
  notifyAdmin(`🔴 שירות נעצר: ${svc}`);
});

bot.onText(/\/svcrestart (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl restart "${svc}" 2>&1 && echo "🔄 ${svc} הופעל מחדש"`);
  send(msg.chat.id, out);
  notifyAdmin(`🔄 שירות הופעל מחדש: ${svc}`);
});

bot.onText(/\/svcstatus (.+)/, async (msg: any, match: any) => {
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl status "${svc}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/svclog (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`journalctl -u "${svc}" -n 30 --no-pager 2>&1`);
  send(msg.chat.id, out);
});

// ─── DOCKER ───────────────────────────────────────────────────────────────────
bot.onText(/\/docker$/, async (msg: any) => {
  const out = await runCmd('docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}" 2>&1');
  send(msg.chat.id, out);
});

bot.onText(/\/dockerall$/, async (msg: any) => {
  const out = await runCmd('docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}" 2>&1');
  send(msg.chat.id, out);
});

bot.onText(/\/dockerlogs (.+)/, async (msg: any, match: any) => {
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker logs --tail=50 "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerstart (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker start "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerstop (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker stop "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerrestart (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker restart "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerstats$/, async (msg: any) => {
  const out = await runCmd('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}" 2>&1');
  send(msg.chat.id, out);
});

bot.onText(/\/dockerpull (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const image = match?.[1]?.trim();
  bot.sendMessage(msg.chat.id, `⏳ מוריד ${image}...`);
  const out = await runCmd(`docker pull "${image}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerrm (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker rm -f "${name}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── CODE RUNNER ──────────────────────────────────────────────────────────────
bot.onText(/\/code$/, async (msg: any) => {
  sendMd(msg.chat.id, `💻 *הרצת קוד JavaScript*\n\nשימוש: \`/code <קוד>\`\n\nדוגמה:\n\`/code 2+2\`\n\`/code Math.PI.toFixed(5)\``);
});

bot.onText(/\/code (.+)/s, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const code = match?.[1]?.trim();
  try {
    const result = eval(code);
    send(msg.chat.id, `✅ תוצאה:\n${JSON.stringify(result, null, 2)}`);
  } catch (e: any) {
    send(msg.chat.id, `❌ שגיאה:\n${e.message}`);
  }
});

// ─── EXEC ─────────────────────────────────────────────────────────────────────
bot.onText(/\/exec (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const cmd = match?.[1]?.trim();
  const out = await runCmd(cmd);
  send(msg.chat.id, `$ ${cmd}\n\n${out}`);
});

bot.onText(/\/env$/, async (msg: any) => {
  if (!requireAdmin(msg)) return;
  const env = Object.entries(process.env)
    .filter(([k]) => !/(secret|password|token|key|paypal)/i.test(k))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  send(msg.chat.id, env || '(ריק)');
});

// ─── HTTP ─────────────────────────────────────────────────────────────────────
bot.onText(/\/curl (.+)/, async (msg: any, match: any) => {
  const url = match?.[1]?.trim();
  const out = await runCmd(`curl -sS -o - -w "\\nHTTP: %{http_code}" --max-time 10 "${url}" 2>&1 | head -80`);
  send(msg.chat.id, out);
});

bot.onText(/\/wget (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const url = match?.[1]?.trim();
  const out = await runCmd(`wget -q "${url}" -O /tmp/wget_output 2>&1 && echo "✅ הורד בהצלחה"`);
  send(msg.chat.id, out);
});

// ─── LOGS ─────────────────────────────────────────────────────────────────────
bot.onText(/\/syslog$/, async (msg: any) => {
  if (!requireAdmin(msg)) return;
  const out = await runCmd('journalctl -n 50 --no-pager 2>/dev/null || tail -50 /var/log/syslog 2>/dev/null || echo "לא נמצאו לוגים"');
  send(msg.chat.id, out);
});

bot.onText(/\/authlog$/, async (msg: any) => {
  if (!requireAdmin(msg)) return;
  const out = await runCmd('journalctl -u sshd -n 30 --no-pager 2>/dev/null || tail -30 /var/log/auth.log 2>/dev/null');
  send(msg.chat.id, out);
});

bot.onText(/\/journalctl (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`journalctl -u "${svc}" -n 50 --no-pager 2>&1`);
  send(msg.chat.id, out);
});

// ─── WEBSITE BUILDER ──────────────────────────────────────────────────────────
bot.onText(/\/buildsite (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const siteName = match?.[1]?.trim();
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; }
    header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 80px 20px; text-align: center; }
    header h1 { font-size: 3em; margin-bottom: 20px; }
    header p { font-size: 1.3em; opacity: 0.9; }
    .btn { display: inline-block; margin-top: 30px; padding: 15px 40px; background: #fff; color: #667eea; border-radius: 50px; font-weight: bold; text-decoration: none; font-size: 1.1em; }
    section { padding: 80px 40px; max-width: 1200px; margin: 0 auto; }
    .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin-top: 40px; }
    .feature { background: #1a1a2e; padding: 40px; border-radius: 15px; text-align: center; border: 1px solid #333; }
    .feature h3 { font-size: 1.5em; margin-bottom: 15px; color: #667eea; }
    footer { background: #111; text-align: center; padding: 30px; color: #666; }
  </style>
</head>
<body>
  <header>
    <h1>🚀 ${siteName}</h1>
    <p>האתר שלך מוכן לפעולה</p>
    <a href="#" class="btn">התחל עכשיו</a>
  </header>
  <section>
    <h2 style="text-align:center;font-size:2em;margin-bottom:10px;">היתרונות שלנו</h2>
    <div class="features">
      <div class="feature"><h3>⚡ מהיר</h3><p>ביצועים מעולים ומהירות גבוהה</p></div>
      <div class="feature"><h3>🔒 מאובטח</h3><p>אבטחה ברמה הגבוהה ביותר</p></div>
      <div class="feature"><h3>💎 איכותי</h3><p>עיצוב מקצועי ומרשים</p></div>
    </div>
  </section>
  <footer><p>Built with ❤️ by Yaniv Bot | ${siteName}</p></footer>
</body>
</html>`;

  const filePath = `/tmp/${siteName.replace(/\s/g, '_')}.html`;
  fs.writeFileSync(filePath, html);
  await bot.sendDocument(msg.chat.id, filePath, { caption: `✅ אתר *${siteName}* נוצר!\n_By Yaniv_`, parse_mode: 'Markdown' });
  fs.unlinkSync(filePath);
});

// ─── SHOP ─────────────────────────────────────────────────────────────────────
bot.onText(/\/shop$/, (msg: any) => {
  let text = `🛒 *חנות Yaniv Bot*\n\n`;
  for (const [id, p] of Object.entries(PRODUCTS)) {
    text += `*${p.name}*\n💰 $${p.price} | \`/buy ${id}\`\n${p.desc}\n\n`;
  }
  text += `\n_תשלום מאובטח דרך PayPal_ 💳`;
  sendMd(msg.chat.id, text);
});

bot.onText(/\/buy (.+)/, async (msg: any, match: any) => {
  const productId = match?.[1]?.trim();
  const product = PRODUCTS[productId];
  if (!product) {
    return sendMd(msg.chat.id, `❌ מוצר לא נמצא. הקלד /shop לרשימה.`);
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    return sendMd(msg.chat.id, `⚠️ PayPal לא מוגדר. צור קשר עם מנהל המערכת.`);
  }

  try {
    bot.sendMessage(msg.chat.id, `⏳ יוצר קישור תשלום...`);
    const order = await createPayPalOrder(product.price, 'USD', product.name);
    const approvalUrl = order.links?.find((l: any) => l.rel === 'approve')?.href;

    if (approvalUrl) {
      pendingPayments[order.id] = { userId: msg.from?.id, product, orderId: order.id };
      sendMd(msg.chat.id, `
💳 *תשלום עבור ${product.name}*
💰 מחיר: *$${product.price}*

👆 לחץ לתשלום:
[שלם עם PayPal](${approvalUrl})

_לאחר התשלום שלח /confirm ${order.id}_
`);
      notifyAdmin(`🛒 הזמנה חדשה!\nמוצר: ${product.name}\nמחיר: $${product.price}\nמשתמש: ${msg.from?.first_name} (${msg.from?.id})`);
    }
  } catch (e: any) {
    send(msg.chat.id, `שגיאת PayPal: ${e.message}`);
  }
});

bot.onText(/\/addcart (.+)/, (msg: any, match: any) => {
  const productId = match?.[1]?.trim();
  const product = PRODUCTS[productId];
  if (!product) return sendMd(msg.chat.id, `❌ מוצר לא נמצא. /shop לרשימה.`);
  const userId = msg.from?.id;
  if (!userCarts[userId]) userCarts[userId] = [];
  userCarts[userId].push({ id: productId, ...product });
  sendMd(msg.chat.id, `✅ *${product.name}* נוסף לעגלה!\n/cart לעגלה | /checkout לתשלום`);
});

bot.onText(/\/cart$/, (msg: any) => {
  const userId = msg.from?.id;
  const cart = userCarts[userId] || [];
  if (cart.length === 0) return sendMd(msg.chat.id, `🛒 העגלה ריקה. /shop לקנות.`);
  const total = cart.reduce((s: number, p: any) => s + p.price, 0);
  let text = `🛒 *העגלה שלך:*\n\n`;
  cart.forEach((p: any, i: number) => text += `${i + 1}. ${p.name} — $${p.price}\n`);
  text += `\n💰 *סה"כ: $${total.toFixed(2)}*\n/checkout לתשלום`;
  sendMd(msg.chat.id, text);
});

bot.onText(/\/checkout$/, async (msg: any) => {
  const userId = msg.from?.id;
  const cart = userCarts[userId] || [];
  if (cart.length === 0) return sendMd(msg.chat.id, `🛒 העגלה ריקה.`);
  if (!PAYPAL_CLIENT_ID) return sendMd(msg.chat.id, `⚠️ PayPal לא מוגדר.`);

  const total = cart.reduce((s: number, p: any) => s + p.price, 0);
  const desc = cart.map((p: any) => p.name).join(', ');

  try {
    bot.sendMessage(msg.chat.id, `⏳ יוצר קישור תשלום עבור $${total.toFixed(2)}...`);
    const order = await createPayPalOrder(total, 'USD', desc);
    const approvalUrl = order.links?.find((l: any) => l.rel === 'approve')?.href;
    if (approvalUrl) {
      pendingPayments[order.id] = { userId, cart, total, orderId: order.id };
      sendMd(msg.chat.id, `💳 [שלם $${total.toFixed(2)} עם PayPal](${approvalUrl})\n\n_לאחר התשלום: /confirm ${order.id}_`);
    }
  } catch (e: any) {
    send(msg.chat.id, `שגיאה: ${e.message}`);
  }
});

bot.onText(/\/confirm (.+)/, (msg: any, match: any) => {
  const orderId = match?.[1]?.trim();
  const payment = pendingPayments[orderId];
  if (!payment) return sendMd(msg.chat.id, `❌ הזמנה לא נמצאה.`);
  delete pendingPayments[orderId];
  if (userCarts[msg.from?.id]) userCarts[msg.from?.id] = [];
  sendMd(msg.chat.id, `✅ *תשלום אושר!*\n\nהזמנה מספר: \`${orderId}\`\n\nתודה על הרכישה! 🎉\n_By Yaniv_`);
  notifyAdmin(`💰 תשלום אושר!\nהזמנה: ${orderId}\nמשתמש: ${msg.from?.first_name} (${msg.from?.id})`);
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
bot.onText(/\/alerts$/, (msg: any) => {
  if (!requireAdmin(msg)) return;
  sendMd(msg.chat.id, `
🔔 *הגדרות התראות*

התראות פעילות:
✅ תשלומים חדשים
✅ כיבוי/הפעלת שירותים
✅ מחיקת קבצים
✅ הרג תהליכים

/setalert cpu — התראה על CPU גבוה
/setalert mem — התראה על RAM גבוה
/setalert disk — התראה על דיסק מלא
/monitor <שירות> — מעקב אחר שירות
`);
});

bot.onText(/\/setalert (.+)/, (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const type = match?.[1]?.trim();
  sendMd(msg.chat.id, `✅ התראה על *${type}* הופעלה!\nתקבל הודעה כשהערך יחרוג מהסף.`);
});

bot.onText(/\/monitor (.+)/, async (msg: any, match: any) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const status = await runCmd(`systemctl is-active "${svc}" 2>/dev/null`);
  sendMd(msg.chat.id, `🔍 *מעקב אחר ${svc}*\nסטטוס: ${status}\n\nתקבל התראה אם השירות ייכבה.`);
});

// ─── STATS ────────────────────────────────────────────────────────────────────
bot.onText(/\/stats$/, (msg: any) => {
  if (!requireAdmin(msg)) return;
  const orders = Object.keys(pendingPayments).length;
  sendMd(msg.chat.id, `
📈 *סטטיסטיקות*
_By Yaniv_

🛒 הזמנות בהמתנה: ${orders}
💰 מוצרים בחנות: ${Object.keys(PRODUCTS).length}
🤖 Bot uptime: ${formatUptime(process.uptime())}
`);
});

// ─── /ping ────────────────────────────────────────────────────────────────────
bot.onText(/\/ping$/, (msg: any) => {
  bot.sendMessage(msg.chat.id, `🏓 Pong! _By Yaniv_ ✅`, { parse_mode: 'Markdown' });
});

// ─── Unknown ──────────────────────────────────────────────────────────────────
bot.on('message', (msg: any) => {
  if (msg.text?.startsWith('/')) {
    const cmd = msg.text.split(' ')[0].slice(1).split('@')[0];
    const known = ['start','help','status','uptime','uname','hostname','ps','top','processes','meminfo','cpuinfo','loadavg','kill','df','du','ifconfig','netstat','ping','dns','whois','traceroute','ls','cat','tail','find','mkdir','rm','mv','cp','chmod','zip','unzip','services','svcstart','svcstop','svcrestart','svcstatus','svclog','docker','dockerall','dockerlogs','dockerstart','dockerstop','dockerrestart','dockerstats','dockerpull','dockerrm','code','exec','env','curl','wget','syslog','authlog','journalctl','buildsite','sitepreview','shop','buy','cart','addcart','checkout','confirm','orders','balance','alerts','setalert','monitor','stats','visitors','about','version','ping','nginx','apache','cron','cronlist'];
    if (!known.includes(cmd)) {
      sendMd(msg.chat.id, `❓ פקודה לא מוכרת: \`${cmd}\`\n/help לרשימה מלאה`);
    }
  }
});

bot.on('polling_error', (err: any) => {
  console.error('Polling error:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection:', reason?.message || reason);
});

console.log('🤖 Yaniv Bot v2.0 is running!');
console.log(`👤 Admins: ${ADMIN_IDS.length > 0 ? ADMIN_IDS.join(', ') : 'כולם'}`);
console.log(`💳 PayPal: ${PAYPAL_CLIENT_ID ? `✅ (${PAYPAL_MODE})` : '❌ לא מוגדר'}`);

export default bot;
