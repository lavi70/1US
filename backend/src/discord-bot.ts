/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
// ╔══════════════════════════════════════════╗
// ║       🎮 DISCORD BOT BY YANIV           ║
// ║   Server Manager + Shop + Commands      ║
// ╚══════════════════════════════════════════╝

import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ActivityType } from 'discord.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const ADMIN_ROLE = process.env.DISCORD_ADMIN_ROLE || 'Admin';

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is not set');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

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
  return `${d}d ${h}h ${m}m`;
}

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
    return (stdout || stderr || '(אין פלט)').trim().slice(0, 1900);
  } catch (e: any) {
    return `שגיאה: ${e.message}`;
  }
}

function isAdmin(member: any): boolean {
  return member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.roles?.cache?.some((r: any) => r.name === ADMIN_ROLE);
}

// ─── Slash Commands ───────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('status').setDescription('סטטוס השרת - CPU, RAM, Disk'),
  new SlashCommandBuilder().setName('uptime').setDescription('זמן פעילות השרת'),
  new SlashCommandBuilder().setName('ps').setDescription('תהליכים פעילים'),
  new SlashCommandBuilder().setName('top').setDescription('10 תהליכים כבדים'),
  new SlashCommandBuilder().setName('df').setDescription('שימוש בדיסק'),
  new SlashCommandBuilder().setName('netstat').setDescription('חיבורי רשת'),
  new SlashCommandBuilder().setName('docker').setDescription('קונטיינרים פעילים'),
  new SlashCommandBuilder().setName('dockerstats').setDescription('סטטיסטיקות Docker'),
  new SlashCommandBuilder().setName('services').setDescription('שירותים פעילים'),
  new SlashCommandBuilder().setName('about').setDescription('אודות הבוט'),
  new SlashCommandBuilder().setName('help').setDescription('כל הפקודות'),
  new SlashCommandBuilder().setName('shop').setDescription('חנות מוצרים'),
  new SlashCommandBuilder().setName('ping').setDescription('בדיקת חיבור'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('מידע על שרת הדיסקורד'),
  new SlashCommandBuilder().setName('userinfo').setDescription('מידע על משתמש').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(false)),
  new SlashCommandBuilder().setName('members').setDescription('מספר חברים בשרת'),
  new SlashCommandBuilder().setName('clear').setDescription('מחיקת הודעות').addIntegerOption(o => o.setName('amount').setDescription('כמות').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('kick').setDescription('בעיטת משתמש').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('סיבה').setRequired(false)),
  new SlashCommandBuilder().setName('ban').setDescription('חסימת משתמש').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('סיבה').setRequired(false)),
  new SlashCommandBuilder().setName('mute').setDescription('השתקת משתמש').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)).addIntegerOption(o => o.setName('minutes').setDescription('דקות').setRequired(false)),
  new SlashCommandBuilder().setName('role').setDescription('הוספת תפקיד').addUserOption(o => o.setName('user').setDescription('משתמש').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('תפקיד').setRequired(true)),
  new SlashCommandBuilder().setName('announce').setDescription('הכרזה לכל השרת').addStringOption(o => o.setName('message').setDescription('ההודעה').setRequired(true)),
  new SlashCommandBuilder().setName('exec').setDescription('הרץ פקודת Shell (Admin)').addStringOption(o => o.setName('command').setDescription('הפקודה').setRequired(true)),
  new SlashCommandBuilder().setName('kill').setDescription('סיום תהליך').addIntegerOption(o => o.setName('pid').setDescription('PID').setRequired(true)),
  new SlashCommandBuilder().setName('restart').setDescription('הפעל מחדש שירות').addStringOption(o => o.setName('service').setDescription('שם השירות').setRequired(true)),
  new SlashCommandBuilder().setName('logs').setDescription('לוגי שירות').addStringOption(o => o.setName('service').setDescription('שם השירות').setRequired(true)),
  new SlashCommandBuilder().setName('ping_host').setDescription('Ping לhost').addStringOption(o => o.setName('host').setDescription('כתובת').setRequired(true)),
  new SlashCommandBuilder().setName('buy').setDescription('רכישת מוצר').addStringOption(o => o.setName('product').setDescription('מזהה מוצר').setRequired(true)),
].map(cmd => cmd.toJSON());

// ─── Register Commands ────────────────────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log('📋 רושם slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commands רשומים!');
  } catch (e) {
    console.error('❌ שגיאה ברישום commands:', e);
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────
const PRODUCTS: Record<string, any> = {
  'discord_server': { name: '🎮 שרת דיסקורד מוכן', price: 29.99 },
  'discord_bot': { name: '🤖 בוט דיסקורד', price: 49.99 },
  'website_basic': { name: '🌐 אתר בסיסי', price: 99.99 },
  'vps_1gb': { name: '🖥️ VPS 1GB', price: 5.99 },
  'vps_2gb': { name: '🖥️ VPS 2GB', price: 9.99 },
  'telegram_bot': { name: '📱 בוט טלגרם', price: 39.99 },
  'image_pack': { name: '🖼️ חבילת תמונות AI', price: 14.99 },
  'stars_100': { name: '⭐ 100 כוכבים', price: 4.99 },
  'stars_500': { name: '⭐ 500 כוכבים', price: 19.99 },
};

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Discord Bot מחובר כ: ${client.user?.tag}`);
  client.user?.setActivity('By Yaniv 🚀', { type: ActivityType.Watching });
  await registerCommands();
});

// ─── Slash Command Handler ────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild } = interaction;

  await interaction.deferReply();

  // ─── /help ────────────────────────────────────────────────────────────────
  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Yaniv Bot — כל הפקודות')
      .setColor(0x667eea)
      .setDescription('_Bot by Yaniv_')
      .addFields(
        { name: '📊 שרת', value: '/status /uptime /ps /top /df /netstat', inline: false },
        { name: '🐋 Docker', value: '/docker /dockerstats', inline: false },
        { name: '⚙️ שירותים', value: '/services /restart /logs', inline: false },
        { name: '🔧 ניהול', value: '/exec /kill /ping_host', inline: false },
        { name: '👥 משתמשים', value: '/kick /ban /mute /role /clear /announce', inline: false },
        { name: '🖥️ שרת דיסקורד', value: '/serverinfo /userinfo /members', inline: false },
        { name: '🛒 חנות', value: '/shop /buy', inline: false },
      )
      .setFooter({ text: 'Made with ❤️ by Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /about ───────────────────────────────────────────────────────────────
  if (commandName === 'about') {
    const embed = new EmbedBuilder()
      .setTitle('🤖 אודות Yaniv Bot')
      .setColor(0x764ba2)
      .addFields(
        { name: '👨‍💻 יוצר', value: 'Yaniv', inline: true },
        { name: '🚀 גרסה', value: '2.0.0', inline: true },
        { name: '💻 Platform', value: 'Discord + Telegram', inline: true },
        { name: '✅ יכולות', value: 'ניהול שרתים, Docker, חנות, תשלומים, מוד', inline: false },
      )
      .setFooter({ text: 'Made with ❤️ by Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /ping ────────────────────────────────────────────────────────────────
  if (commandName === 'ping') {
    const latency = Date.now() - interaction.createdTimestamp;
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x00ff00)
      .addFields(
        { name: '⚡ Latency', value: `${latency}ms`, inline: true },
        { name: '💓 API', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      )
      .setFooter({ text: 'By Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /status ──────────────────────────────────────────────────────────────
  if (commandName === 'status') {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const load = os.loadavg();
    let disk = 'N/A';
    try { disk = execSync('df -h /').toString().split('\n')[1]; } catch {}

    const embed = new EmbedBuilder()
      .setTitle('📊 סטטוס שרת')
      .setColor(0x00b4d8)
      .addFields(
        { name: '🖥️ CPU', value: `${cpus[0]?.model || 'N/A'} (${cpus.length} ליבות)`, inline: false },
        { name: '📈 עומס', value: load.map(l => l.toFixed(2)).join(' / '), inline: true },
        { name: '💾 RAM', value: `${formatBytes(usedMem)} / ${formatBytes(totalMem)}`, inline: true },
        { name: '💿 דיסק', value: disk, inline: false },
        { name: '⏱️ Uptime', value: formatUptime(os.uptime()), inline: true },
        { name: '🏠 Hostname', value: os.hostname(), inline: true },
      )
      .setFooter({ text: 'By Yaniv' })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /uptime ──────────────────────────────────────────────────────────────
  if (commandName === 'uptime') {
    const out = await runCmd('uptime');
    const embed = new EmbedBuilder().setTitle('⏱️ Uptime').setDescription(`\`\`\`${out}\`\`\``).setColor(0x00ff00).setFooter({ text: 'By Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /ps ──────────────────────────────────────────────────────────────────
  if (commandName === 'ps') {
    const out = await runCmd('ps aux --sort=-%cpu | head -15');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /top ─────────────────────────────────────────────────────────────────
  if (commandName === 'top') {
    const out = await runCmd('ps aux --sort=-%cpu | head -11');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /df ──────────────────────────────────────────────────────────────────
  if (commandName === 'df') {
    const out = await runCmd('df -h');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /netstat ─────────────────────────────────────────────────────────────
  if (commandName === 'netstat') {
    const out = await runCmd('ss -tulnp 2>/dev/null | head -20');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /docker ──────────────────────────────────────────────────────────────
  if (commandName === 'docker') {
    const out = await runCmd('docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}" 2>&1');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /dockerstats ─────────────────────────────────────────────────────────
  if (commandName === 'dockerstats') {
    const out = await runCmd('docker stats --no-stream 2>&1');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /services ────────────────────────────────────────────────────────────
  if (commandName === 'services') {
    const out = await runCmd('systemctl list-units --type=service --state=running 2>/dev/null | head -20');
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /ping_host ───────────────────────────────────────────────────────────
  if (commandName === 'ping_host') {
    const host = interaction.options.getString('host');
    const out = await runCmd(`ping -c 4 "${host}" 2>&1`);
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── Admin commands ───────────────────────────────────────────────────────
  if (!isAdmin(member)) {
    return interaction.editReply({ content: '⛔ אין לך הרשאת Admin.' });
  }

  // ─── /exec ────────────────────────────────────────────────────────────────
  if (commandName === 'exec') {
    const cmd = interaction.options.getString('command');
    const out = await runCmd(cmd);
    return interaction.editReply({ content: `\`\`\`\n$ ${cmd}\n\n${out}\n\`\`\`` });
  }

  // ─── /kill ────────────────────────────────────────────────────────────────
  if (commandName === 'kill') {
    const pid = interaction.options.getInteger('pid');
    const out = await runCmd(`kill -15 ${pid} && echo "✅ SIGTERM sent to PID ${pid}"`);
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /restart ─────────────────────────────────────────────────────────────
  if (commandName === 'restart') {
    const svc = interaction.options.getString('service');
    const out = await runCmd(`systemctl restart "${svc}" 2>&1 && echo "✅ ${svc} הופעל מחדש"`);
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /logs ────────────────────────────────────────────────────────────────
  if (commandName === 'logs') {
    const svc = interaction.options.getString('service');
    const out = await runCmd(`journalctl -u "${svc}" -n 30 --no-pager 2>&1`);
    return interaction.editReply({ content: `\`\`\`\n${out}\n\`\`\`` });
  }

  // ─── /serverinfo ──────────────────────────────────────────────────────────
  if (commandName === 'serverinfo') {
    const embed = new EmbedBuilder()
      .setTitle(`🖥️ ${guild?.name}`)
      .setThumbnail(guild?.iconURL() || '')
      .setColor(0x5865f2)
      .addFields(
        { name: '👑 בעלים', value: `<@${guild?.ownerId}>`, inline: true },
        { name: '👥 חברים', value: `${guild?.memberCount}`, inline: true },
        { name: '📅 נוצר', value: guild?.createdAt?.toLocaleDateString('he-IL') || 'N/A', inline: true },
        { name: '📢 ערוצים', value: `${guild?.channels?.cache?.size}`, inline: true },
        { name: '🎭 תפקידים', value: `${guild?.roles?.cache?.size}`, inline: true },
        { name: '😀 אמוג\'ים', value: `${guild?.emojis?.cache?.size}`, inline: true },
      )
      .setFooter({ text: 'By Yaniv' })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /userinfo ────────────────────────────────────────────────────────────
  if (commandName === 'userinfo') {
    const user = interaction.options.getUser('user') || interaction.user;
    const m = guild?.members?.cache?.get(user.id);
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .setColor(0x5865f2)
      .addFields(
        { name: '🆔 ID', value: user.id, inline: true },
        { name: '📅 הצטרף לדיסקורד', value: user.createdAt.toLocaleDateString('he-IL'), inline: true },
        { name: '📅 הצטרף לשרת', value: m?.joinedAt?.toLocaleDateString('he-IL') || 'N/A', inline: true },
        { name: '🎭 תפקידים', value: m?.roles?.cache?.map((r: any) => r.name).join(', ') || 'אין', inline: false },
      )
      .setFooter({ text: 'By Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /members ─────────────────────────────────────────────────────────────
  if (commandName === 'members') {
    return interaction.editReply({ content: `👥 **${guild?.memberCount}** חברים בשרת **${guild?.name}**` });
  }

  // ─── /clear ───────────────────────────────────────────────────────────────
  if (commandName === 'clear') {
    const amount = interaction.options.getInteger('amount');
    await interaction.channel?.bulkDelete(amount, true);
    return interaction.editReply({ content: `🗑️ נמחקו **${amount}** הודעות.` });
  }

  // ─── /kick ────────────────────────────────────────────────────────────────
  if (commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'ללא סיבה';
    const m = guild?.members?.cache?.get(user.id);
    await m?.kick(reason);
    const embed = new EmbedBuilder().setTitle('👢 Kick').setColor(0xff6b35).addFields({ name: 'משתמש', value: user.username, inline: true }, { name: 'סיבה', value: reason, inline: true }).setFooter({ text: 'By Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /ban ─────────────────────────────────────────────────────────────────
  if (commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'ללא סיבה';
    await guild?.members?.ban(user.id, { reason });
    const embed = new EmbedBuilder().setTitle('🔨 Ban').setColor(0xff0000).addFields({ name: 'משתמש', value: user.username, inline: true }, { name: 'סיבה', value: reason, inline: true }).setFooter({ text: 'By Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /mute ────────────────────────────────────────────────────────────────
  if (commandName === 'mute') {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes') || 10;
    const m = guild?.members?.cache?.get(user.id);
    await m?.timeout(minutes * 60 * 1000, 'Muted by Yaniv Bot');
    return interaction.editReply({ content: `🔇 **${user.username}** הושתק ל-**${minutes}** דקות.` });
  }

  // ─── /role ────────────────────────────────────────────────────────────────
  if (commandName === 'role') {
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const m = guild?.members?.cache?.get(user.id);
    await m?.roles?.add(role.id);
    return interaction.editReply({ content: `✅ תפקיד **${role.name}** נוסף ל-**${user.username}**` });
  }

  // ─── /announce ────────────────────────────────────────────────────────────
  if (commandName === 'announce') {
    const message = interaction.options.getString('message');
    const embed = new EmbedBuilder()
      .setTitle('📢 הכרזה')
      .setDescription(message)
      .setColor(0xffd700)
      .setFooter({ text: `הכרזה על ידי ${interaction.user.username} | By Yaniv` })
      .setTimestamp();

    const channels = guild?.channels?.cache?.filter((c: any) => c.type === 0);
    let sent = 0;
    for (const [, ch] of channels || []) {
      try { await (ch as any).send({ embeds: [embed] }); sent++; } catch {}
    }
    return interaction.editReply({ content: `📢 הכרזה נשלחה ל-**${sent}** ערוצים!` });
  }

  // ─── /shop ────────────────────────────────────────────────────────────────
  if (commandName === 'shop') {
    const embed = new EmbedBuilder()
      .setTitle('🛒 חנות Yaniv Bot')
      .setColor(0x667eea)
      .setDescription('רכוש מוצרים דיגיטליים מקצועיים\n_תשלום דרך PayPal_');
    for (const [id, p] of Object.entries(PRODUCTS)) {
      embed.addFields({ name: `${p.name} — $${p.price}`, value: `/buy ${id}`, inline: true });
    }
    embed.setFooter({ text: 'Made with ❤️ by Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }

  // ─── /buy ─────────────────────────────────────────────────────────────────
  if (commandName === 'buy') {
    const productId = interaction.options.getString('product');
    const product = PRODUCTS[productId];
    if (!product) return interaction.editReply({ content: '❌ מוצר לא נמצא. /shop לרשימה.' });
    const embed = new EmbedBuilder()
      .setTitle(`💳 רכישה: ${product.name}`)
      .setColor(0x00b09b)
      .addFields(
        { name: '💰 מחיר', value: `$${product.price}`, inline: true },
        { name: '📧 תשלום', value: 'PayPal', inline: true },
      )
      .setDescription('צור קשר עם המנהל לקישור תשלום.')
      .setFooter({ text: 'By Yaniv' });
    return interaction.editReply({ embeds: [embed] });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(TOKEN);

console.log('🎮 Discord Bot by Yaniv מתחבר...');

export default client;
