/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import TelegramBot from 'node-telegram-bot-api';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAdmin(userId: number): boolean {
  if (ADMIN_IDS.length === 0) return true; // open if no admins configured
  return ADMIN_IDS.includes(userId);
}

function requireAdmin(msg: TelegramMessage): boolean {
  if (!isAdmin(msg.from?.id || 0)) {
    bot.sendMessage(msg.chat.id, '⛔ אין לך הרשאה לפקודה זו.');
    return false;
  }
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (text.length <= MAX) {
    return bot.sendMessage(chatId, `\`\`\`\n${text}\n\`\`\``, { parse_mode: 'Markdown' });
  }
  // split into chunks
  const chunks = text.match(new RegExp(`.{1,${MAX}}`, 'gs')) || [];
  return Promise.all(chunks.map(chunk =>
    bot.sendMessage(chatId, `\`\`\`\n${chunk}\n\`\`\``, { parse_mode: 'Markdown' })
  ));
}

function sendPlain(chatId: number, text: string) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || 'משתמש';
  sendPlain(msg.chat.id, `👋 שלום *${name}*\\!\n\nאני בוט לניהול שרתים\\. הקלד /help לרשימת כל הפקודות\\.`);
});

// ─── /help ────────────────────────────────────────────────────────────────────

bot.onText(/\/help/, (msg) => {
  const text = `
*🤖 פקודות ניהול שרת*

*📊 מידע על השרת*
/status — סטטוס כללי (CPU, RAM, Disk)
/uptime — זמן פעילות השרת
/uname — פרטי מערכת ההפעלה
/hostname — שם המחשב וה-IP

*🔧 תהליכים*
/ps — רשימת תהליכים פעילים
/top — 10 התהליכים הכבדים ביותר
/kill <PID> — סיום תהליך לפי PID

*💾 דיסק ורשת*
/df — שימוש בדיסק
/du <נתיב> — גודל תיקייה
/ifconfig — ממשקי רשת
/netstat — חיבורי רשת פעילים
/ping <host> — בדיקת חיבור

*📁 קבצים*
/ls <נתיב> — רשימת קבצים
/cat <קובץ> — תוכן קובץ
/tail <קובץ> — 50 שורות אחרונות מקובץ
/find <נתיב> <שם> — חיפוש קובץ

*⚙️ שירותים (systemctl)*
/services — רשימת שירותים פעילים
/svcstart <שירות> — הפעלת שירות
/svcstop <שירות> — עצירת שירות
/svcrestart <שירות> — הפעלה מחדש
/svcstatus <שירות> — סטטוס שירות

*🐋 Docker*
/docker — רשימת קונטיינרים
/dockerall — כל הקונטיינרים (כולל כבויים)
/dockerlogs <שם> — לוגים מקונטיינר
/dockerstart <שם> — הפעלת קונטיינר
/dockerstop <שם> — עצירת קונטיינר
/dockerrestart <שם> — הפעלה מחדש
/dockerstats — סטטיסטיקות קונטיינרים

*🌐 HTTP*
/curl <URL> — בקשת HTTP GET

*💻 הרצת פקודות*
/exec <פקודה> — הרצת פקודה חופשית ⚠️
/env — משתני סביבה

*📋 לוגים*
/syslog — לוגי מערכת אחרונים
/authlog — לוג התחברויות
/journalctl <שירות> — לוגי journalctl
`;
  sendPlain(msg.chat.id, text);
});

// ─── /status ─────────────────────────────────────────────────────────────────

bot.onText(/\/status$/, async (msg) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = ((usedMem / totalMem) * 100).toFixed(1);
  const load = os.loadavg();

  let diskOut = '';
  try {
    diskOut = execSync('df -h /').toString().split('\n')[1];
  } catch { diskOut = 'N/A'; }

  const text = `
📊 *סטטוס שרת*

🖥️ *CPU*
  דגם: ${cpus[0]?.model || 'N/A'}
  ליבות: ${cpus.length}
  עומס (1/5/15 דק'): ${load.map(l => l.toFixed(2)).join(' / ')}

💾 *RAM*
  סה"כ: ${formatBytes(totalMem)}
  בשימוש: ${formatBytes(usedMem)} (${memPct}%)
  פנוי: ${formatBytes(freeMem)}

💿 *דיסק (/)*
  ${diskOut}

⏱️ *זמן פעילות*: ${formatUptime(os.uptime())}
🏠 *Hostname*: ${os.hostname()}
🐧 *מערכת*: ${os.type()} ${os.release()} ${os.arch()}
`;
  sendPlain(msg.chat.id, text);
});

// ─── /uptime ─────────────────────────────────────────────────────────────────

bot.onText(/\/uptime$/, async (msg) => {
  const out = await runCmd('uptime');
  send(msg.chat.id, `⏱️ Uptime:\n${out}`);
});

// ─── /uname ──────────────────────────────────────────────────────────────────

bot.onText(/\/uname$/, async (msg) => {
  const out = await runCmd('uname -a');
  send(msg.chat.id, out);
});

// ─── /hostname ───────────────────────────────────────────────────────────────

bot.onText(/\/hostname$/, async (msg) => {
  const hostname = os.hostname();
  const out = await runCmd('hostname -I 2>/dev/null || ip addr show | grep "inet " | awk \'{print $2}\'');
  send(msg.chat.id, `🏠 Hostname: ${hostname}\n🌐 IPs:\n${out}`);
});

// ─── /ps ─────────────────────────────────────────────────────────────────────

bot.onText(/\/ps$/, async (msg) => {
  const out = await runCmd('ps aux --sort=-%cpu | head -20');
  send(msg.chat.id, out);
});

// ─── /top ─────────────────────────────────────────────────────────────────────

bot.onText(/\/top$/, async (msg) => {
  const out = await runCmd('ps aux --sort=-%cpu | head -11');
  send(msg.chat.id, `🔝 Top 10 תהליכים לפי CPU:\n\n${out}`);
});

// ─── /kill ───────────────────────────────────────────────────────────────────

bot.onText(/\/kill (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const pid = match?.[1]?.trim();
  if (!pid || isNaN(parseInt(pid))) {
    return send(msg.chat.id, 'שימוש: /kill <PID>');
  }
  const out = await runCmd(`kill -15 ${parseInt(pid)} && echo "נשלח SIGTERM ל-PID ${pid}"`);
  send(msg.chat.id, out);
});

// ─── /df ─────────────────────────────────────────────────────────────────────

bot.onText(/\/df$/, async (msg) => {
  const out = await runCmd('df -h');
  send(msg.chat.id, out);
});

// ─── /du ─────────────────────────────────────────────────────────────────────

bot.onText(/\/du (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const dir = match?.[1]?.trim() || '/';
  const out = await runCmd(`du -sh "${dir}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── /ifconfig ───────────────────────────────────────────────────────────────

bot.onText(/\/ifconfig$/, async (msg) => {
  const out = await runCmd('ip addr show 2>/dev/null || ifconfig 2>/dev/null || echo "אין כלי זמין"');
  send(msg.chat.id, out);
});

// ─── /netstat ────────────────────────────────────────────────────────────────

bot.onText(/\/netstat$/, async (msg) => {
  const out = await runCmd('ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null');
  send(msg.chat.id, out);
});

// ─── /ping ───────────────────────────────────────────────────────────────────

bot.onText(/\/ping (.+)/, async (msg, match) => {
  const host = match?.[1]?.trim();
  if (!host) return send(msg.chat.id, 'שימוש: /ping <host>');
  const out = await runCmd(`ping -c 4 "${host}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── /ls ─────────────────────────────────────────────────────────────────────

bot.onText(/\/ls(?:\s+(.+))?/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const dir = match?.[1]?.trim() || '.';
  const out = await runCmd(`ls -lah "${dir}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── /cat ─────────────────────────────────────────────────────────────────────

bot.onText(/\/cat (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const file = match?.[1]?.trim();
  if (!file) return send(msg.chat.id, 'שימוש: /cat <קובץ>');
  try {
    const content = fs.readFileSync(file, 'utf8').slice(0, 3500);
    send(msg.chat.id, content);
  } catch (e: any) {
    send(msg.chat.id, `שגיאה: ${e.message}`);
  }
});

// ─── /tail ───────────────────────────────────────────────────────────────────

bot.onText(/\/tail (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const file = match?.[1]?.trim();
  if (!file) return send(msg.chat.id, 'שימוש: /tail <קובץ>');
  const out = await runCmd(`tail -50 "${file}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── /find ───────────────────────────────────────────────────────────────────

bot.onText(/\/find (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const args = match?.[1]?.trim().split(/\s+/);
  const dir = args?.[0] || '.';
  const name = args?.[1] || '*';
  const out = await runCmd(`find "${dir}" -name "${name}" 2>/dev/null | head -50`);
  send(msg.chat.id, out);
});

// ─── /services ───────────────────────────────────────────────────────────────

bot.onText(/\/services$/, async (msg) => {
  const out = await runCmd('systemctl list-units --type=service --state=running 2>/dev/null | head -30');
  send(msg.chat.id, out);
});

// ─── /svcstart /svcstop /svcrestart /svcstatus ───────────────────────────────

bot.onText(/\/svcstart (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl start "${svc}" 2>&1 && echo "✅ ${svc} הופעל"`);
  send(msg.chat.id, out);
});

bot.onText(/\/svcstop (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl stop "${svc}" 2>&1 && echo "🛑 ${svc} נעצר"`);
  send(msg.chat.id, out);
});

bot.onText(/\/svcrestart (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl restart "${svc}" 2>&1 && echo "🔄 ${svc} הופעל מחדש"`);
  send(msg.chat.id, out);
});

bot.onText(/\/svcstatus (.+)/, async (msg, match) => {
  const svc = match?.[1]?.trim();
  const out = await runCmd(`systemctl status "${svc}" 2>&1`);
  send(msg.chat.id, out);
});

// ─── Docker ───────────────────────────────────────────────────────────────────

bot.onText(/\/docker$/, async (msg) => {
  const out = await runCmd('docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}" 2>&1');
  send(msg.chat.id, out);
});

bot.onText(/\/dockerall$/, async (msg) => {
  const out = await runCmd('docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}" 2>&1');
  send(msg.chat.id, out);
});

bot.onText(/\/dockerlogs (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker logs --tail=50 "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerstart (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker start "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerstop (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker stop "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerrestart (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const name = match?.[1]?.trim();
  const out = await runCmd(`docker restart "${name}" 2>&1`);
  send(msg.chat.id, out);
});

bot.onText(/\/dockerstats$/, async (msg) => {
  const out = await runCmd('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}" 2>&1');
  send(msg.chat.id, out);
});

// ─── /curl ───────────────────────────────────────────────────────────────────

bot.onText(/\/curl (.+)/, async (msg, match) => {
  const url = match?.[1]?.trim();
  if (!url) return send(msg.chat.id, 'שימוש: /curl <URL>');
  const out = await runCmd(`curl -sS -o - -w "\\n\\nHTTP Status: %{http_code}" --max-time 10 "${url}" 2>&1 | head -100`);
  send(msg.chat.id, out);
});

// ─── /exec ───────────────────────────────────────────────────────────────────

bot.onText(/\/exec (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const cmd = match?.[1]?.trim();
  if (!cmd) return send(msg.chat.id, 'שימוש: /exec <פקודה>');
  const out = await runCmd(cmd);
  send(msg.chat.id, `$ ${cmd}\n\n${out}`);
});

// ─── /env ─────────────────────────────────────────────────────────────────────

bot.onText(/\/env$/, async (msg) => {
  if (!requireAdmin(msg)) return;
  const env = Object.entries(process.env)
    .filter(([k]) => !k.toLowerCase().includes('secret') && !k.toLowerCase().includes('password') && !k.toLowerCase().includes('token') && !k.toLowerCase().includes('key'))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  send(msg.chat.id, env || '(ריק)');
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

bot.onText(/\/syslog$/, async (msg) => {
  if (!requireAdmin(msg)) return;
  const out = await runCmd('journalctl -n 50 --no-pager 2>/dev/null || tail -50 /var/log/syslog 2>/dev/null || tail -50 /var/log/messages 2>/dev/null || echo "לא נמצאו לוגי מערכת"');
  send(msg.chat.id, out);
});

bot.onText(/\/authlog$/, async (msg) => {
  if (!requireAdmin(msg)) return;
  const out = await runCmd('tail -50 /var/log/auth.log 2>/dev/null || journalctl -u sshd -n 50 --no-pager 2>/dev/null || echo "לא נמצא לוג אימות"');
  send(msg.chat.id, out);
});

bot.onText(/\/journalctl (.+)/, async (msg, match) => {
  if (!requireAdmin(msg)) return;
  const svc = match?.[1]?.trim();
  const out = await runCmd(`journalctl -u "${svc}" -n 50 --no-pager 2>&1`);
  send(msg.chat.id, out);
});

// ─── Unknown command ──────────────────────────────────────────────────────────

bot.on('message', (msg) => {
  if (msg.text?.startsWith('/') && msg.text !== '/start' && msg.text !== '/help') {
    const knownCommands = [
      'status','uptime','uname','hostname','ps','top','kill','df','du','ifconfig',
      'netstat','ping','ls','cat','tail','find','services','svcstart','svcstop',
      'svcrestart','svcstatus','docker','dockerall','dockerlogs','dockerstart',
      'dockerstop','dockerrestart','dockerstats','curl','exec','env','syslog',
      'authlog','journalctl','help','start'
    ];
    const cmd = msg.text.split(' ')[0].slice(1);
    if (!knownCommands.includes(cmd)) {
      sendPlain(msg.chat.id, `❓ פקודה לא מוכרת: \`${cmd}\`\nהקלד /help לרשימה מלאה.`);
    }
  }
});

console.log('🤖 Telegram Server Manager Bot is running...');
console.log(`📋 Admin IDs: ${ADMIN_IDS.length > 0 ? ADMIN_IDS.join(', ') : 'כולם (לא הוגדרו)'}`);

export default bot;
