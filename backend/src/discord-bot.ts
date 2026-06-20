/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
// ╔══════════════════════════════════════════╗
// ║       🎮 DISCORD BOT BY YANIV v3.0      ║
// ║   100+ Commands - Server Manager+Shop   ║
// ╚══════════════════════════════════════════╝

import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import axios from 'axios';

const execAsync = promisify(exec);

const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';

// Live stock tickers: messageId → { symbol, channelId, intervalId }
const liveTickers: Map<string, { symbol: string; channelId: string; intervalId: any }> = new Map();

// Portfolio: userId → [{symbol, shares, buyPrice}]
const portfolios: Map<string, Array<{symbol:string; shares:number; buyPrice:number}>> = new Map();

// Live analyses: messageId → { symbol, channelId, intervalId }
const liveAnalyses: Map<string, { symbol: string; channelId: string; intervalId: any }> = new Map();

if (!TOKEN || !CLIENT_ID) { console.error('❌ DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is not set'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ]
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(b: number): string {
  const u = ['B','KB','MB','GB','TB']; let i=0;
  while (b>=1024&&i<u.length-1){b/=1024;i++;} return `${b.toFixed(2)} ${u[i]}`;
}
function formatUptime(s: number): string {
  const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);
  return `${d}d ${h}h ${m}m`;
}
async function runCmd(cmd: string): Promise<string> {
  try {
    const {stdout,stderr} = await execAsync(cmd,{timeout:15000});
    return (stdout||stderr||'(אין פלט)').trim().slice(0,1900);
  } catch(e:any){return `שגיאה: ${e.message.slice(0,200)}`;}
}
function isAdmin(member: any): boolean {
  return member?.id === member?.guild?.ownerId ||
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(8n);
}
function isMod(member: any): boolean {
  return member?.permissions?.has(PermissionFlagsBits.ModerateMembers) || isAdmin(member);
}
function embed(title: string, desc: string, color = 0x667eea): EmbedBuilder {
  return new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp();
}
function errEmbed(msg: string): EmbedBuilder {
  return embed('❌ שגיאה', msg, 0xff0000);
}

// ─── Products ─────────────────────────────────────────────────────────────────
const PRODUCTS: Record<string,any> = {
  'discord_server': {name:'🎮 שרת דיסקורד מוכן',price:29.99,desc:'שרת עם ערוצים, בוטים, תפקידים'},
  'discord_bot': {name:'🤖 בוט דיסקורד',price:49.99,desc:'בוט מותאם אישית'},
  'telegram_bot': {name:'📱 בוט טלגרם',price:39.99,desc:'בוט טלגרם מלא'},
  'website_basic': {name:'🌐 אתר Landing Page',price:99.99,desc:'אתר מקצועי'},
  'website_shop': {name:'🛒 חנות אונליין',price:199.99,desc:'חנות עם תשלומים'},
  'vps_1gb': {name:'🖥️ VPS 1GB',price:5.99,desc:'שרת וירטואלי'},
  'vps_2gb': {name:'🖥️ VPS 2GB',price:9.99,desc:'שרת וירטואלי'},
  'vps_4gb': {name:'🖥️ VPS 4GB',price:19.99,desc:'שרת וירטואלי'},
  'image_pack': {name:'🖼️ 50 תמונות AI',price:14.99,desc:'תמונות AI מותאמות'},
  'video_pack': {name:'🎥 10 סרטונים',price:24.99,desc:'סרטונים לעסק'},
  'stars_100': {name:'⭐ 100 כוכבים',price:4.99,desc:'Telegram Stars'},
  'stars_500': {name:'⭐ 500 כוכבים',price:19.99,desc:'Telegram Stars'},
  'stars_1000': {name:'⭐ 1000 כוכבים',price:34.99,desc:'Telegram Stars'},
  'seo_pack': {name:'📈 חבילת SEO',price:79.99,desc:'אופטימיזציה לגוגל'},
  'logo_design': {name:'🎨 עיצוב לוגו',price:49.99,desc:'לוגו מקצועי'},
};

// ─── Giveaway storage ─────────────────────────────────────────────────────────
const giveaways: Record<string,any> = {};
const polls: Record<string,any> = {};
const warnings: Record<string,string[]> = {};
const afkUsers: Record<string,string> = {};
const suggestions: any[] = [];

// ─── Verify storage ───────────────────────────────────────────────────────────
const verifyConfig: Record<string,{roleId:string,channelId:string}> = {};
const verifiedUsers: Record<string,Set<string>> = {};

// ─── Ticket storage ────────────────────────────────────────────────────────────
const ticketConfig: Record<string,{categoryId:string,staffRoleId?:string}> = {};
let ticketCounter: Record<string,number> = {};

// ─── Commands List ────────────────────────────────────────────────────────────
const commands = [
  // INFO
  new SlashCommandBuilder().setName('help').setDescription('כל הפקודות'),
  new SlashCommandBuilder().setName('about').setDescription('אודות הבוט'),
  new SlashCommandBuilder().setName('ping').setDescription('בדיקת חיבור'),
  new SlashCommandBuilder().setName('uptime').setDescription('זמן פעילות'),
  new SlashCommandBuilder().setName('version').setDescription('גרסת הבוט'),
  new SlashCommandBuilder().setName('invite').setDescription('קישור הזמנה לבוט'),

  // SERVER INFO
  new SlashCommandBuilder().setName('serverinfo').setDescription('מידע על השרת'),
  new SlashCommandBuilder().setName('membercount').setDescription('מספר חברים'),
  new SlashCommandBuilder().setName('channelinfo').setDescription('מידע על הערוץ הנוכחי'),
  new SlashCommandBuilder().setName('roleinfo').setDescription('מידע על תפקיד').addRoleOption(o=>o.setName('role').setDescription('תפקיד').setRequired(true)),
  new SlashCommandBuilder().setName('roles').setDescription('רשימת תפקידים'),
  new SlashCommandBuilder().setName('channels').setDescription('רשימת ערוצים'),
  new SlashCommandBuilder().setName('emojis').setDescription('רשימת אמוג\'ים'),
  new SlashCommandBuilder().setName('boosts').setDescription('מידע על בוסטים'),
  new SlashCommandBuilder().setName('icon').setDescription('תמונת השרת'),

  // USER INFO
  new SlashCommandBuilder().setName('userinfo').setDescription('מידע על משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(false)),
  new SlashCommandBuilder().setName('avatar').setDescription('תמונת פרופיל').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(false)),
  new SlashCommandBuilder().setName('banner').setDescription('באנר של משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(false)),
  new SlashCommandBuilder().setName('whois').setDescription('מי זה?').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),

  // MODERATION
  new SlashCommandBuilder().setName('kick').setDescription('בעיטת משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('סיבה').setRequired(false)),
  new SlashCommandBuilder().setName('ban').setDescription('חסימת משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('סיבה').setRequired(false)),
  new SlashCommandBuilder().setName('unban').setDescription('ביטול חסימה').addStringOption(o=>o.setName('userid').setDescription('User ID').setRequired(true)),
  new SlashCommandBuilder().setName('mute').setDescription('השתקת משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addIntegerOption(o=>o.setName('minutes').setDescription('דקות').setRequired(false)),
  new SlashCommandBuilder().setName('unmute').setDescription('ביטול השתקה').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('אזהרת משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('סיבה').setRequired(true)),
  new SlashCommandBuilder().setName('warnings').setDescription('אזהרות של משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('clearwarns').setDescription('מחיקת אזהרות').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('מחיקת הודעות').addIntegerOption(o=>o.setName('amount').setDescription('כמות 1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('slowmode').setDescription('Slowmode לערוץ').addIntegerOption(o=>o.setName('seconds').setDescription('שניות (0 לכיבוי)').setRequired(true)),
  new SlashCommandBuilder().setName('lock').setDescription('נעילת ערוץ'),
  new SlashCommandBuilder().setName('unlock').setDescription('פתיחת ערוץ'),
  new SlashCommandBuilder().setName('hide').setDescription('הסתרת ערוץ'),
  new SlashCommandBuilder().setName('show').setDescription('הצגת ערוץ'),
  new SlashCommandBuilder().setName('nuke').setDescription('מחיקת כל הודעות הערוץ'),
  new SlashCommandBuilder().setName('bans').setDescription('רשימת חסומים'),

  // ROLES
  new SlashCommandBuilder().setName('role').setDescription('הוסף/הסר תפקיד').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('תפקיד').setRequired(true)),
  new SlashCommandBuilder().setName('addrole').setDescription('הוסף תפקיד למשתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('תפקיד').setRequired(true)),
  new SlashCommandBuilder().setName('removerole').setDescription('הסר תפקיד ממשתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('תפקיד').setRequired(true)),
  new SlashCommandBuilder().setName('createrole').setDescription('יצירת תפקיד חדש').addStringOption(o=>o.setName('name').setDescription('שם התפקיד').setRequired(true)).addStringOption(o=>o.setName('color').setDescription('צבע hex').setRequired(false)),
  new SlashCommandBuilder().setName('portfolio-add').setDescription('📊 הוסף מניה לתיק שלך').addStringOption(o=>o.setName('symbol').setDescription('סימול (AAPL, TSLA...)').setRequired(true)).addNumberOption(o=>o.setName('shares').setDescription('כמות מניות').setRequired(true)).addNumberOption(o=>o.setName('buyprice').setDescription('מחיר קנייה ($)').setRequired(true)),
  new SlashCommandBuilder().setName('portfolio-view').setDescription('📊 צפה בתיק המניות שלך עם שווי נוכחי'),
  new SlashCommandBuilder().setName('compare').setDescription('📊 השווה 2 מניות זו לצד זו').addStringOption(o=>o.setName('symbol1').setDescription('מניה ראשונה').setRequired(true)).addStringOption(o=>o.setName('symbol2').setDescription('מניה שנייה').setRequired(true)),
  new SlashCommandBuilder().setName('market-summary').setDescription('🌍 סיכום שוק - S&P500, NASDAQ, DOW, VIX'),
  new SlashCommandBuilder().setName('fear-greed').setDescription('😱 מדד פחד וחמדנות של השוק (Fear & Greed Index)'),

  // CHANNELS
  new SlashCommandBuilder().setName('createchannel').setDescription('יצירת ערוץ').addStringOption(o=>o.setName('name').setDescription('שם הערוץ').setRequired(true)).addStringOption(o=>o.setName('type').setDescription('text/voice').setRequired(false)),
  new SlashCommandBuilder().setName('delchannel').setDescription('מחיקת ערוץ').addChannelOption(o=>o.setName('channel').setDescription('ערוץ').setRequired(true)),
  new SlashCommandBuilder().setName('topic').setDescription('שינוי תיאור ערוץ').addStringOption(o=>o.setName('topic').setDescription('תיאור').setRequired(true)),

  // FUN
  new SlashCommandBuilder().setName('8ball').setDescription('שאל את הכדור הקסום').addStringOption(o=>o.setName('question').setDescription('שאלה').setRequired(true)),
  new SlashCommandBuilder().setName('roll').setDescription('הטל קוביה').addIntegerOption(o=>o.setName('sides').setDescription('צלעות (ברירת מחדל 6)').setRequired(false)),
  new SlashCommandBuilder().setName('flip').setDescription('הטלת מטבע'),
  new SlashCommandBuilder().setName('rps').setDescription('אבן נייר מספריים').addStringOption(o=>o.setName('choice').setDescription('אבן/נייר/מספריים').setRequired(true).addChoices({name:'אבן',value:'אבן'},{name:'נייר',value:'נייר'},{name:'מספריים',value:'מספריים'})),
  new SlashCommandBuilder().setName('joke').setDescription('בדיחה אקראית'),
  new SlashCommandBuilder().setName('quote').setDescription('ציטוט מעורר השראה'),
  new SlashCommandBuilder().setName('fact').setDescription('עובדה מעניינת'),
  new SlashCommandBuilder().setName('rate').setDescription('דרג משהו').addStringOption(o=>o.setName('thing').setDescription('מה לדרג?').setRequired(true)),
  new SlashCommandBuilder().setName('choose').setDescription('בחר בשבילי').addStringOption(o=>o.setName('options').setDescription('אפשרויות מופרדות בפסיק').setRequired(true)),
  new SlashCommandBuilder().setName('reverse').setDescription('הפוך טקסט').addStringOption(o=>o.setName('text').setDescription('טקסט').setRequired(true)),
  new SlashCommandBuilder().setName('ship').setDescription('שיפ שני משתמשים').addUserOption(o=>o.setName('user1').setDescription('משתמש 1').setRequired(true)).addUserOption(o=>o.setName('user2').setDescription('משתמש 2').setRequired(true)),
  new SlashCommandBuilder().setName('hug').setDescription('חיבוק').addUserOption(o=>o.setName('user').setDescription('למי?').setRequired(true)),
  new SlashCommandBuilder().setName('slap').setDescription('סטירה').addUserOption(o=>o.setName('user').setDescription('למי?').setRequired(true)),
  new SlashCommandBuilder().setName('roast').setDescription('ביקורת על משתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('compliment').setDescription('מחמאה למשתמש').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),
  new SlashCommandBuilder().setName('random').setDescription('מספר אקראי').addIntegerOption(o=>o.setName('min').setDescription('מינימום').setRequired(false)).addIntegerOption(o=>o.setName('max').setDescription('מקסימום').setRequired(false)),

  // UTILITY
  new SlashCommandBuilder().setName('announce').setDescription('הכרזה').addStringOption(o=>o.setName('message').setDescription('הודעה').setRequired(true)).addChannelOption(o=>o.setName('channel').setDescription('ערוץ').setRequired(false)),
  new SlashCommandBuilder().setName('embed').setDescription('שלח Embed').addStringOption(o=>o.setName('title').setDescription('כותרת').setRequired(true)).addStringOption(o=>o.setName('description').setDescription('תוכן').setRequired(true)).addStringOption(o=>o.setName('color').setDescription('צבע hex').setRequired(false)),
  new SlashCommandBuilder().setName('poll').setDescription('סקר').addStringOption(o=>o.setName('question').setDescription('שאלה').setRequired(true)).addStringOption(o=>o.setName('options').setDescription('אפשרויות מופרדות בפסיק').setRequired(false)),
  new SlashCommandBuilder().setName('giveaway').setDescription('הגרלה').addStringOption(o=>o.setName('prize').setDescription('פרס').setRequired(true)).addIntegerOption(o=>o.setName('minutes').setDescription('דקות').setRequired(true)).addIntegerOption(o=>o.setName('winners').setDescription('מספר זוכים').setRequired(false)),
  new SlashCommandBuilder().setName('suggest').setDescription('הצעה לשרת').addStringOption(o=>o.setName('suggestion').setDescription('ההצעה שלך').setRequired(true)),
  new SlashCommandBuilder().setName('afk').setDescription('הגדר מצב AFK').addStringOption(o=>o.setName('reason').setDescription('סיבה').setRequired(false)),
  new SlashCommandBuilder().setName('reminder').setDescription('תזכורת').addStringOption(o=>o.setName('message').setDescription('מה לזכור').setRequired(true)).addIntegerOption(o=>o.setName('minutes').setDescription('בעוד כמה דקות').setRequired(true)),
  new SlashCommandBuilder().setName('qr').setDescription('צור QR Code').addStringOption(o=>o.setName('text').setDescription('טקסט/URL').setRequired(true)),
  new SlashCommandBuilder().setName('color').setDescription('מידע על צבע').addStringOption(o=>o.setName('hex').setDescription('קוד hex').setRequired(true)),
  new SlashCommandBuilder().setName('math').setDescription('חשב').addStringOption(o=>o.setName('expression').setDescription('ביטוי מתמטי').setRequired(true)),
  new SlashCommandBuilder().setName('timestamp').setDescription('זמן עכשיו'),

  // SERVER MANAGEMENT (SYSTEM)
  new SlashCommandBuilder().setName('status').setDescription('סטטוס השרת'),
  new SlashCommandBuilder().setName('sysinfo').setDescription('מידע מלא על המערכת'),
  new SlashCommandBuilder().setName('df').setDescription('שימוש בדיסק'),
  new SlashCommandBuilder().setName('docker').setDescription('קונטיינרים'),
  new SlashCommandBuilder().setName('services').setDescription('שירותים פעילים'),
  new SlashCommandBuilder().setName('logs').setDescription('לוגי שירות').addStringOption(o=>o.setName('service').setDescription('שם').setRequired(true)),
  new SlashCommandBuilder().setName('restart').setDescription('הפעל מחדש שירות').addStringOption(o=>o.setName('service').setDescription('שם').setRequired(true)),
  new SlashCommandBuilder().setName('exec').setDescription('הרץ פקודה (Admin)').addStringOption(o=>o.setName('command').setDescription('הפקודה').setRequired(true)),


  // FINANCE & MARKET
  new SlashCommandBuilder().setName('stock').setDescription('📈 מחיר מניה בזמן אמת').addStringOption(o=>o.setName('symbol').setDescription('סימול (לדוגמה: AAPL, TSLA, GOOGL)').setRequired(true)),
  new SlashCommandBuilder().setName('crypto').setDescription('💰 מחיר קריפטו בזמן אמת').addStringOption(o=>o.setName('coin').setDescription('מטבע (לדוגמה: bitcoin, ethereum, solana)').setRequired(true)),
  new SlashCommandBuilder().setName('profit').setDescription('💹 מחשבון רווח Etsy').addNumberOption(o=>o.setName('cost').setDescription('עלות ייצור ($)').setRequired(true)).addNumberOption(o=>o.setName('price').setDescription('מחיר מכירה ($)').setRequired(true)).addNumberOption(o=>o.setName('shipping').setDescription('משלוח ($)').setRequired(false)),
  new SlashCommandBuilder().setName('currency').setDescription('💱 המרת מטבע').addNumberOption(o=>o.setName('amount').setDescription('סכום').setRequired(true)).addStringOption(o=>o.setName('from').setDescription('ממטבע (USD/ILS/EUR)').setRequired(true)).addStringOption(o=>o.setName('to').setDescription('למטבע (USD/ILS/EUR)').setRequired(true)),
  new SlashCommandBuilder().setName('etsy-search').setDescription('🛍️ חפש מוצרים ב-Etsy ומחירים').addStringOption(o=>o.setName('keyword').setDescription('מה לחפש').setRequired(true)),
  new SlashCommandBuilder().setName('analyze').setDescription('🔬 ניתוח מעמיק של מניה — האם כדאי להיכנס או לצאת?').addStringOption(o=>o.setName('symbol').setDescription('סימול (AAPL, TSLA...)').setRequired(true)),
  new SlashCommandBuilder().setName('buy').setDescription('רכישת מוצר').addStringOption(o=>o.setName('product').setDescription('מזהה').setRequired(true)),
  new SlashCommandBuilder().setName('products').setDescription('רשימת מוצרים'),

  // VERIFY
  new SlashCommandBuilder().setName('setup-verify').setDescription('הגדרת מערכת אימות לשרת (Admin)').addRoleOption(o=>o.setName('role').setDescription('תפקיד Verified').setRequired(true)).addChannelOption(o=>o.setName('channel').setDescription('ערוץ אימות (ברירת מחדל: נוצר אוטומטית)').setRequired(false)),
  new SlashCommandBuilder().setName('verify-stats').setDescription('סטטיסטיקות אימות'),
  new SlashCommandBuilder().setName('unverify').setDescription('הסרת אימות ממשתמש (Admin)').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),


  // SERVER SETUP
  new SlashCommandBuilder().setName('setup-server').setDescription('🏗️ בנה שרת מקצועי מלא עם ערוצים, תפקידים וטיקטים (Admin)').addStringOption(o=>o.setName('name').setDescription('שם השרת (אופציונלי)').setRequired(false)),
  new SlashCommandBuilder().setName('setup-stocks').setDescription('📈 בנה שרת מניות מקצועי עם ערוצים ותפקידים (Admin)'),
  new SlashCommandBuilder().setName('stock-live').setDescription('📡 Live ticker - עדכון אוטומטי כל 15 שניות').addStringOption(o=>o.setName('symbol').setDescription('סימול (AAPL, TSLA...)').setRequired(true)),
  new SlashCommandBuilder().setName('stock-stop').setDescription('⏹️ עצור live ticker בערוץ זה'),
  new SlashCommandBuilder().setName('setup-tickets').setDescription('🎫 הגדרת מערכת טיקטים (Admin)').addChannelOption(o=>o.setName('channel').setDescription('ערוץ פתיחת טיקטים').setRequired(false)),
  new SlashCommandBuilder().setName('close-ticket').setDescription('🔒 סגירת טיקט נוכחי'),
  new SlashCommandBuilder().setName('add-ticket').setDescription('הוסף משתמש לטיקט').addUserOption(o=>o.setName('user').setDescription('משתמש').setRequired(true)),
].map(c=>c.toJSON());

// ─── Register ─────────────────────────────────────────────────────────────────
const rest = new REST({version:'10'}).setToken(TOKEN);
async function registerCommands() {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID),{body:commands});
    console.log(`✅ ${commands.length} commands רשומים!`);
  } catch(e){console.error('❌ שגיאה:',e);}
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const jokes = ['למה המדען לא סומך על אטומים? כי הם מרכיבים הכל!','מה אומר אפס לשמונה? יפה החגורה שלך!','למה הדג לא יכול לשחק טניס? כי הוא מפחד מהרשת!','מה ההבדל בין פיל לתפוח? אחד כבד ואחד אדום!'];
const quotes = ['הדרך הטובה ביותר לנבא את העתיד היא ליצור אותו - אברהם לינקולן','אל תחכה. הזמן לעולם לא יהיה מושלם - נפוליון היל','הצלחה היא לא סופית, הכישלון אינו קטלני - וינסטון צ\'רצ\'יל','אם אתה לא יכול לעוף, רוץ. אם לא יכול לרוץ, לך - מרטין לות\'ר קינג'];
const facts = ['דבורים יכולות לזהות פנים אנושיות!','האוקטופוס יש לו שלושה לבבות!','הבנאנה היא מבחינה טכנית עשב!','גמל יכול לשתות 200 ליטר מים ב-3 דקות!'];
const roasts = ['אתה כל כך משעמם שספר הטלפון שלך כולל אותך בסעיף "אין עניין"!','אתה מביא שמחה לכולם... כשאתה עוזב!','אם טיפשות היתה כואבת, אתה היית צועק כל הזמן!'];
const compliments = ['אתה מדהים! 🌟','העולם טוב יותר בגללך! 💫','אתה מקור השראה לכולם! ⭐'];

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Discord Bot By Yaniv מחובר: ${client.user?.tag}`);
  client.user?.setActivity(`${commands.length} פקודות | By Yaniv`, {type:ActivityType.Watching});
  await registerCommands();
});

// ─── Handler ──────────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isChatInputCommand()) return;
  const {commandName, member, guild, channel, user} = interaction;
  await interaction.deferReply();

  // ══════════════════════════════════════════════════════
  //  INFO
  // ══════════════════════════════════════════════════════
  if (commandName === 'help') {
    const e = new EmbedBuilder().setTitle('🤖 Yaniv Bot — כל הפקודות').setColor(0x667eea)
      .addFields(
        {name:'ℹ️ מידע',value:'`/serverinfo` `/userinfo` `/avatar` `/roleinfo` `/channels` `/roles` `/boosts` `/emojis`',inline:false},
        {name:'🔨 מודרציה',value:'`/kick` `/ban` `/unban` `/mute` `/unmute` `/warn` `/warnings` `/clear` `/lock` `/unlock` `/slowmode` `/nuke`',inline:false},
        {name:'🎭 תפקידים',value:'`/role` `/addrole` `/removerole` `/createrole` `/delrole`',inline:false},
        {name:'📢 ערוצים',value:'`/createchannel` `/delchannel` `/renamechannel` `/topic` `/hide` `/show`',inline:false},
        {name:'🎉 פאן',value:'`/8ball` `/roll` `/flip` `/rps` `/joke` `/quote` `/fact` `/rate` `/choose` `/ship` `/hug` `/slap` `/roast` `/compliment` `/meme` `/tictactoe`',inline:false},
        {name:'🛠️ כלים',value:'`/poll` `/giveaway` `/announce` `/embed` `/suggest` `/afk` `/reminder` `/math` `/color` `/qr` `/translate` `/timestamp`',inline:false},
        {name:'🖥️ שרת',value:'`/status` `/ps` `/top` `/df` `/docker` `/exec` `/kill` `/logs` `/restart` `/pinghost`',inline:false},
        {name:'🛒 חנות',value:'`/shop` `/buy` `/products` `/price`',inline:false},
        {name:'🛡️ אימות',value:'`/setup-verify` `/verify-stats` `/unverify`',inline:false},
      )
      .setFooter({text:`${commands.length} פקודות | Bot by Yaniv 🚀`});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'about') {
    const e = new EmbedBuilder().setTitle('🤖 Yaniv Bot v3.0').setColor(0x764ba2)
      .setDescription('בוט רב-תכליתי לניהול שרתים, מודרציה, פאן ועסקים')
      .addFields(
        {name:'👨‍💻 יוצר',value:'Yaniv',inline:true},
        {name:'🚀 גרסה',value:'3.0.0',inline:true},
        {name:'📊 פקודות',value:`${commands.length}+`,inline:true},
        {name:'⚡ Ping',value:`${client.ws.ping}ms`,inline:true},
        {name:'🖥️ שרתים',value:`${client.guilds.cache.size}`,inline:true},
        {name:'👥 משתמשים',value:`${client.users.cache.size}`,inline:true},
      )
      .setFooter({text:'Made with ❤️ by Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'ping') {
    const lat = Date.now()-interaction.createdTimestamp;
    return interaction.editReply({embeds:[embed('🏓 Pong!',`⚡ Latency: **${lat}ms**\n💓 API: **${Math.round(client.ws.ping)}ms**`,0x00ff00)]});
  }

if (commandName === 'uptime') {
    return interaction.editReply({embeds:[embed('⏱️ Uptime',`Bot: **${formatUptime(process.uptime())}**\nServer: **${formatUptime(os.uptime())}**`)]});
  }

  if (commandName === 'version') {
    return interaction.editReply({embeds:[embed('📦 גרסה','**Bot:** v3.0.0\n**Node.js:** '+process.version+'\n**discord.js:** v14')]});
  }

  if (commandName === 'invite') {
    return interaction.editReply({embeds:[embed('📨 הזמן את הבוט',`[לחץ כאן להזמנה](https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands)`)]});
  }

  // ══════════════════════════════════════════════════════
  //  SERVER INFO
  // ══════════════════════════════════════════════════════
  if (commandName === 'serverinfo') {
    const g = guild;
    const e = new EmbedBuilder().setTitle(`🖥️ ${g?.name}`).setColor(0x5865f2)
      .setThumbnail(g?.iconURL()||'')
      .addFields(
        {name:'👑 בעלים',value:`<@${g?.ownerId}>`,inline:true},
        {name:'👥 חברים',value:`${g?.memberCount}`,inline:true},
        {name:'📅 נוצר',value:g?.createdAt?.toLocaleDateString('he-IL')||'N/A',inline:true},
        {name:'📢 ערוצים',value:`${g?.channels?.cache?.size}`,inline:true},
        {name:'🎭 תפקידים',value:`${g?.roles?.cache?.size}`,inline:true},
        {name:'😀 אמוג\'ים',value:`${g?.emojis?.cache?.size}`,inline:true},
        {name:'🚀 בוסטים',value:`${g?.premiumSubscriptionCount||0} (רמה ${g?.premiumTier||0})`,inline:true},
        {name:'🔒 אימות',value:`${g?.verificationLevel}`,inline:true},
        {name:'🆔 ID',value:`${g?.id}`,inline:true},
      ).setFooter({text:'Bot by Yaniv'}).setTimestamp();
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'membercount') {
    const online = guild?.members?.cache?.filter((m:any)=>m.presence?.status==='online').size||0;
    return interaction.editReply({embeds:[embed('👥 חברים',`סה"כ: **${guild?.memberCount}**\nאונליין: **${online}**`)]});
  }

  if (commandName === 'channelinfo') {
    const ch = channel;
    return interaction.editReply({embeds:[embed('📢 מידע ערוץ',`שם: **#${ch?.name}**\nID: **${ch?.id}**\nסוג: **${ch?.type}**\nנוצר: **${ch?.createdAt?.toLocaleDateString('he-IL')}**`)]});
  }

  if (commandName === 'roleinfo') {
    const role = interaction.options.getRole('role');
    return interaction.editReply({embeds:[embed('🎭 מידע תפקיד',`שם: **${role.name}**\nצבע: **${role.hexColor}**\nחברים: **${role.members?.size}**\nID: **${role.id}**`)]});
  }

  if (commandName === 'roles') {
    const r = guild?.roles?.cache?.sort((a:any,b:any)=>b.position-a.position).map((r:any)=>r.name).join(', ')||'אין';
    return interaction.editReply({embeds:[embed('🎭 תפקידים',r.slice(0,2000))]});
  }

  if (commandName === 'channels') {
    const text = guild?.channels?.cache?.filter((c:any)=>c.type===0).map((c:any)=>`#${c.name}`).join(', ')||'אין';
    return interaction.editReply({embeds:[embed('📢 ערוצים',text.slice(0,2000))]});
  }

  if (commandName === 'emojis') {
    const e = guild?.emojis?.cache?.map((e:any)=>`<:${e.name}:${e.id}>`).join(' ')||'אין אמוג\'ים';
    return interaction.editReply({embeds:[embed('😀 אמוג\'ים',e.slice(0,2000))]});
  }

  if (commandName === 'boosts') {
    return interaction.editReply({embeds:[embed('🚀 בוסטים',`בוסטים: **${guild?.premiumSubscriptionCount||0}**\nרמה: **${guild?.premiumTier||0}**`)]});
  }

  if (commandName === 'icon') {
    const e = new EmbedBuilder().setTitle(`🖼️ תמונת ${guild?.name}`).setImage(guild?.iconURL({size:1024})||'').setColor(0x667eea).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  // ══════════════════════════════════════════════════════
  //  USER INFO
  // ══════════════════════════════════════════════════════
  if (commandName === 'userinfo' || commandName === 'whois') {
    const u = interaction.options.getUser('user')||user;
    const m = guild?.members?.cache?.get(u.id);
    const e = new EmbedBuilder().setTitle(`👤 ${u.username}`).setThumbnail(u.displayAvatarURL({size:256})).setColor(0x5865f2)
      .addFields(
        {name:'🆔 ID',value:u.id,inline:true},
        {name:'📅 נרשם',value:u.createdAt.toLocaleDateString('he-IL'),inline:true},
        {name:'📅 הצטרף',value:m?.joinedAt?.toLocaleDateString('he-IL')||'N/A',inline:true},
        {name:'🎭 תפקידים',value:m?.roles?.cache?.map((r:any)=>r.name).filter((n:string)=>n!=='@everyone').join(', ')||'אין',inline:false},
        {name:'🤖 בוט?',value:u.bot?'כן':'לא',inline:true},
      ).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'avatar') {
    const u = interaction.options.getUser('user')||user;
    const e = new EmbedBuilder().setTitle(`🖼️ תמונת ${u.username}`).setImage(u.displayAvatarURL({size:1024})).setColor(0x667eea).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'banner') {
    const u = await (interaction.options.getUser('user')||user).fetch();
    const bannerUrl = u.bannerURL({size:1024});
    if (!bannerUrl) return interaction.editReply({embeds:[errEmbed('למשתמש זה אין באנר')]});
    const e = new EmbedBuilder().setTitle(`🎨 באנר של ${u.username}`).setImage(bannerUrl).setColor(0x667eea).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  // ══════════════════════════════════════════════════════
  //  MODERATION
  // ══════════════════════════════════════════════════════
  if (!isMod(member) && ['kick','ban','unban','mute','unmute','warn','clearwarns','clear','slowmode','lock','unlock','hide','show','nuke','move','deafen','bans','createrole','delrole','delchannel','renamechannel','topic','announce','exec','kill','restart','logs'].includes(commandName)) {
    return interaction.editReply({embeds:[errEmbed('אין לך הרשאת מודרציה')]});
  }

  if (commandName === 'kick') {
    const u = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason')||'ללא סיבה';
    const m = guild?.members?.cache?.get(u.id);
    await m?.kick(reason);
    return interaction.editReply({embeds:[embed('👢 Kick',`**${u.username}** הוצא מהשרת\nסיבה: ${reason}`,0xff6b35)]});
  }

  if (commandName === 'ban') {
    const u = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason')||'ללא סיבה';
    await guild?.members?.ban(u.id,{reason});
    return interaction.editReply({embeds:[embed('🔨 Ban',`**${u.username}** נחסם\nסיבה: ${reason}`,0xff0000)]});
  }

  if (commandName === 'unban') {
    const id = interaction.options.getString('userid');
    await guild?.members?.unban(id);
    return interaction.editReply({embeds:[embed('✅ Unban',`משתמש ${id} שוחרר`,0x00ff00)]});
  }

  if (commandName === 'mute') {
    const u = interaction.options.getUser('user');
    const min = interaction.options.getInteger('minutes')||10;
    const m = guild?.members?.cache?.get(u.id);
    await m?.timeout(min*60000,'Muted by Yaniv Bot');
    return interaction.editReply({embeds:[embed('🔇 Mute',`**${u.username}** הושתק ל-**${min}** דקות`,0xffa500)]});
  }

  if (commandName === 'unmute') {
    const u = interaction.options.getUser('user');
    const m = guild?.members?.cache?.get(u.id);
    await m?.timeout(null);
    return interaction.editReply({embeds:[embed('🔊 Unmute',`**${u.username}** בוטלה ההשתקה`,0x00ff00)]});
  }

  if (commandName === 'warn') {
    const u = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    if (!warnings[u.id]) warnings[u.id]=[];
    warnings[u.id].push(reason);
    return interaction.editReply({embeds:[embed('⚠️ אזהרה',`**${u.username}** קיבל אזהרה\nסיבה: ${reason}\nסה"כ אזהרות: **${warnings[u.id].length}**`,0xffd700)]});
  }

  if (commandName === 'warnings') {
    const u = interaction.options.getUser('user');
    const w = warnings[u.id]||[];
    return interaction.editReply({embeds:[embed('⚠️ אזהרות',w.length?w.map((w:string,i:number)=>`${i+1}. ${w}`).join('\n'):'אין אזהרות')]});
  }

  if (commandName === 'clearwarns') {
    const u = interaction.options.getUser('user');
    warnings[u.id]=[];
    return interaction.editReply({embeds:[embed('✅ אזהרות נמחקו',`כל האזהרות של **${u.username}** נמחקו`,0x00ff00)]});
  }

  if (commandName === 'clear') {
    const amount = interaction.options.getInteger('amount');
    await channel?.bulkDelete(amount,true);
    return interaction.editReply({embeds:[embed('🗑️ נמחקו',`**${amount}** הודעות נמחקו`,0xff6b35)]});
  }

  if (commandName === 'slowmode') {
    const sec = interaction.options.getInteger('seconds');
    await channel?.setRateLimitPerUser(sec);
    return interaction.editReply({embeds:[embed('⏱️ Slowmode',sec===0?'Slowmode כובה':`Slowmode הוגדר ל-**${sec}** שניות`)]});
  }

  if (commandName === 'lock') {
    await channel?.permissionOverwrites?.edit(guild?.roles?.everyone,{SendMessages:false});
    return interaction.editReply({embeds:[embed('🔒 ערוץ נעול','הערוץ ננעל',0xff0000)]});
  }

  if (commandName === 'unlock') {
    await channel?.permissionOverwrites?.edit(guild?.roles?.everyone,{SendMessages:true});
    return interaction.editReply({embeds:[embed('🔓 ערוץ פתוח','הערוץ נפתח',0x00ff00)]});
  }

  if (commandName === 'hide') {
    await channel?.permissionOverwrites?.edit(guild?.roles?.everyone,{ViewChannel:false});
    return interaction.editReply({embeds:[embed('👁️ ערוץ הוסתר','הערוץ הוסתר',0xffa500)]});
  }

  if (commandName === 'show') {
    await channel?.permissionOverwrites?.edit(guild?.roles?.everyone,{ViewChannel:true});
    return interaction.editReply({embeds:[embed('👁️ ערוץ גלוי','הערוץ גלוי',0x00ff00)]});
  }

  if (commandName === 'nuke') {
    const newChannel = await channel?.clone();
    await channel?.delete();
    await newChannel?.send({embeds:[embed('💣 Nuke!','ערוץ זה עבר nuke! 💥',0xff0000)]});
    return;
  }

  if (commandName === 'bans') {
    const bans = await guild?.bans?.fetch();
    const list = bans?.map((b:any)=>`${b.user.username}: ${b.reason||'ללא סיבה'}`).join('\n')||'אין חסומים';
    return interaction.editReply({embeds:[embed('🔨 חסומים',list.slice(0,2000))]});
  }

  // ══════════════════════════════════════════════════════
  //  ROLES
  // ══════════════════════════════════════════════════════
  if (commandName === 'role' || commandName === 'addrole') {
    const u = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const m = guild?.members?.cache?.get(u.id);
    if (m?.roles?.cache?.has(role.id)) {
      await m?.roles?.remove(role.id);
      return interaction.editReply({embeds:[embed('🎭 תפקיד הוסר',`**${role.name}** הוסר מ-**${u.username}**`,0xff6b35)]});
    } else {
      await m?.roles?.add(role.id);
      return interaction.editReply({embeds:[embed('🎭 תפקיד נוסף',`**${role.name}** נוסף ל-**${u.username}**`,0x00ff00)]});
    }
  }

  if (commandName === 'removerole') {
    const u = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    await guild?.members?.cache?.get(u.id)?.roles?.remove(role.id);
    return interaction.editReply({embeds:[embed('🎭 תפקיד הוסר',`**${role.name}** הוסר מ-**${u.username}**`,0xff6b35)]});
  }

  if (commandName === 'createrole') {
    const name = interaction.options.getString('name');
    const color = interaction.options.getString('color')||'#667eea';
    const role = await guild?.roles?.create({name,color,reason:'Created by Yaniv Bot'});
    return interaction.editReply({embeds:[embed('✅ תפקיד נוצר',`תפקיד **${role?.name}** נוצר בהצלחה!`,0x00ff00)]});
  }

  if (commandName === 'delrole') {
    const role = interaction.options.getRole('role');
    await guild?.roles?.delete(role.id);
    return interaction.editReply({embeds:[embed('🗑️ תפקיד נמחק',`תפקיד **${role.name}** נמחק`,0xff0000)]});
  }

  // ══════════════════════════════════════════════════════
  //  CHANNELS
  // ══════════════════════════════════════════════════════
  if (commandName === 'createchannel') {
    const name = interaction.options.getString('name');
    const type = interaction.options.getString('type')||'text';
    const ch = await guild?.channels?.create({name, type: type==='voice'?2:0});
    return interaction.editReply({embeds:[embed('✅ ערוץ נוצר',`**#${ch?.name}** נוצר!`,0x00ff00)]});
  }

  if (commandName === 'delchannel') {
    const ch = interaction.options.getChannel('channel');
    await guild?.channels?.delete(ch.id);
    return interaction.editReply({embeds:[embed('🗑️ ערוץ נמחק',`**#${ch.name}** נמחק`,0xff0000)]});
  }

  if (commandName === 'renamechannel') {
    const name = interaction.options.getString('name');
    await channel?.setName(name);
    return interaction.editReply({embeds:[embed('✏️ שם שונה',`הערוץ שונה ל-**${name}**`,0x00ff00)]});
  }

  if (commandName === 'topic') {
    const topic = interaction.options.getString('topic');
    await channel?.setTopic(topic);
    return interaction.editReply({embeds:[embed('📝 תיאור עודכן',`תיאור הערוץ עודכן ל: **${topic}**`,0x00ff00)]});
  }

  // ══════════════════════════════════════════════════════
  //  FUN
  // ══════════════════════════════════════════════════════
  if (commandName === '8ball') {
    const question = interaction.options.getString('question');
    const answers = ['בהחלט כן! ✅','לא, בשום פנים ואופן! ❌','אולי... 🤔','בוודאי! 🎯','ספק רב 🌫️','הסימנים מצביעים על כן 👍','שאל מאוחר יותר ⏰','כן! 🟢','לא 🔴','הגורל לא ברור 🎱'];
    return interaction.editReply({embeds:[embed('🎱 8Ball',`❓ **${question}**\n\n🎱 **${answers[Math.floor(Math.random()*answers.length)]}**`)]});
  }

  if (commandName === 'roll') {
    const sides = interaction.options.getInteger('sides')||6;
    const result = Math.floor(Math.random()*sides)+1;
    return interaction.editReply({embeds:[embed('🎲 קוביה',`הטלת קוביה עם **${sides}** צלעות\nתוצאה: **${result}**`)]});
  }

  if (commandName === 'flip') {
    const result = Math.random()<0.5?'👑 עץ':'🦅 פלי';
    return interaction.editReply({embeds:[embed('🪙 מטבע',`התוצאה היא: **${result}**`)]});
  }

  if (commandName === 'rps') {
    const choice = interaction.options.getString('choice');
    const botChoices = ['אבן','נייר','מספריים'];
    const botChoice = botChoices[Math.floor(Math.random()*3)];
    let result = 'תיקו! 🤝';
    if ((choice==='אבן'&&botChoice==='מספריים')||(choice==='נייר'&&botChoice==='אבן')||(choice==='מספריים'&&botChoice==='נייר')) result='ניצחת! 🎉';
    else if (choice!==botChoice) result='הפסדת! 😅';
    return interaction.editReply({embeds:[embed('✂️ אבן נייר מספריים',`אתה: **${choice}** | אני: **${botChoice}**\n${result}`)]});
  }

  if (commandName === 'joke') {
    return interaction.editReply({embeds:[embed('😂 בדיחה',jokes[Math.floor(Math.random()*jokes.length)])]});
  }

  if (commandName === 'quote') {
    return interaction.editReply({embeds:[embed('💭 ציטוט',quotes[Math.floor(Math.random()*quotes.length)])]});
  }

  if (commandName === 'fact') {
    return interaction.editReply({embeds:[embed('🧠 עובדה',facts[Math.floor(Math.random()*facts.length)])]});
  }

  if (commandName === 'meme') {
    const memes = ['https://i.imgflip.com/1bij.jpg','https://i.imgflip.com/26am.jpg','https://i.imgflip.com/1bh8.jpg'];
    const e = new EmbedBuilder().setTitle('😂 מם אקראי').setImage(memes[Math.floor(Math.random()*memes.length)]).setColor(0xffd700).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'rate') {
    const thing = interaction.options.getString('thing');
    const rate = Math.floor(Math.random()*101);
    return interaction.editReply({embeds:[embed('⭐ דירוג',`**${thing}** קיבל ציון: **${rate}/100**\n${'⭐'.repeat(Math.round(rate/20))}`)]});
  }

  if (commandName === 'choose') {
    const options = interaction.options.getString('options').split(',').map((o:string)=>o.trim());
    const chosen = options[Math.floor(Math.random()*options.length)];
    return interaction.editReply({embeds:[embed('🎯 בחירה',`מתוך: ${options.join(', ')}\n\nבחרתי: **${chosen}**`)]});
  }

  if (commandName === 'reverse') {
    const text = interaction.options.getString('text');
    return interaction.editReply({embeds:[embed('🔄 הפוך',text.split('').reverse().join(''))]});
  }

  if (commandName === 'ship') {
    const u1 = interaction.options.getUser('user1');
    const u2 = interaction.options.getUser('user2');
    const pct = Math.floor(Math.random()*101);
    const bar = '❤️'.repeat(Math.round(pct/10))+'🖤'.repeat(10-Math.round(pct/10));
    return interaction.editReply({embeds:[embed('💕 Ship',`**${u1.username}** + **${u2.username}**\n${bar}\n**${pct}%** תאימות!`)]});
  }

  if (commandName === 'hug') {
    const u = interaction.options.getUser('user');
    return interaction.editReply({embeds:[embed('🤗 חיבוק',`**${user.username}** חיבק את **${u.username}** 🤗💕`,0xff69b4)]});
  }

  if (commandName === 'slap') {
    const u = interaction.options.getUser('user');
    return interaction.editReply({embeds:[embed('👋 סטירה',`**${user.username}** נתן סטירה ל-**${u.username}** 👋😤`,0xff6b35)]});
  }

  if (commandName === 'roast') {
    const u = interaction.options.getUser('user');
    return interaction.editReply({embeds:[embed('🔥 Roast',`**${u.username}**: ${roasts[Math.floor(Math.random()*roasts.length)]}`,0xff4500)]});
  }

  if (commandName === 'compliment') {
    const u = interaction.options.getUser('user');
    return interaction.editReply({embeds:[embed('💝 מחמאה',`**${u.username}**: ${compliments[Math.floor(Math.random()*compliments.length)]}`,0xff69b4)]});
  }

  if (commandName === 'random') {
    const min = interaction.options.getInteger('min')||1;
    const max = interaction.options.getInteger('max')||100;
    return interaction.editReply({embeds:[embed('🎲 מספר אקראי',`**${Math.floor(Math.random()*(max-min+1)+min)}**\nבין ${min} ל-${max}`)]});
  }

  if (commandName === 'tictactoe') {
    const opponent = interaction.options.getUser('opponent');
    const board = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
    const display = `${board[0]}${board[1]}${board[2]}\n${board[3]}${board[4]}${board[5]}\n${board[6]}${board[7]}${board[8]}`;
    return interaction.editReply({embeds:[embed('❌⭕ Tic Tac Toe',`**${user.username}** (❌) vs **${opponent.username}** (⭕)\n\n${display}\n\nתור של: **${user.username}**`)]});
  }

  // ══════════════════════════════════════════════════════
  //  UTILITY
  // ══════════════════════════════════════════════════════
  if (commandName === 'announce') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel')||channel;
    const e = new EmbedBuilder().setTitle('📢 הכרזה').setDescription(message).setColor(0xffd700).setFooter({text:`הכרזה על ידי ${user.username} | By Yaniv`}).setTimestamp();
    await targetChannel?.send({embeds:[e]});
    return interaction.editReply({embeds:[embed('✅ נשלח',`הכרזה נשלחה ל-<#${targetChannel?.id}>`,0x00ff00)]});
  }

  if (commandName === 'embed') {
    const title = interaction.options.getString('title');
    const desc = interaction.options.getString('description');
    const color = parseInt((interaction.options.getString('color')||'667eea').replace('#',''),16);
    const e = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setFooter({text:`By ${user.username}`}).setTimestamp();
    await channel?.send({embeds:[e]});
    return interaction.editReply({embeds:[embed('✅ Embed נשלח','',0x00ff00)]});
  }

  if (commandName === 'poll') {
    const question = interaction.options.getString('question');
    const opts = (interaction.options.getString('options')||'כן,לא').split(',').map((o:string)=>o.trim());
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'];
    const desc = opts.map((o:string,i:number)=>`${emojis[i]} **${o}**`).join('\n');
    const e = embed('📊 סקר',`**${question}**\n\n${desc}`,0x00b4d8);
    const msg = await channel?.send({embeds:[e]});
    for (let i=0;i<Math.min(opts.length,5);i++) await msg?.react(emojis[i]);
    return interaction.editReply({embeds:[embed('✅ סקר נשלח','',0x00ff00)]});
  }

  if (commandName === 'giveaway') {
    const prize = interaction.options.getString('prize');
    const minutes = interaction.options.getInteger('minutes');
    const winners = interaction.options.getInteger('winners')||1;
    const endTime = new Date(Date.now()+minutes*60000);
    const e = embed('🎉 הגרלה!',`**פרס:** ${prize}\n**זוכים:** ${winners}\n**מסתיים:** <t:${Math.floor(endTime.getTime()/1000)}:R>\n\nלחץ 🎉 להשתתפות!`,0xffd700);
    const msg = await channel?.send({embeds:[e]});
    await msg?.react('🎉');
    giveaways[msg?.id] = {prize,winners,endTime,messageId:msg?.id,channelId:channel?.id};
    setTimeout(async()=>{
      const gw = giveaways[msg?.id];
      if(!gw) return;
      const reactions = msg?.reactions?.cache?.get('🎉');
      const users = await reactions?.users?.fetch();
      const eligible = users?.filter((u:any)=>!u.bot).map((u:any)=>u);
      const winnerList = eligible?.sort(()=>Math.random()-0.5).slice(0,winners)||[];
      const winnerText = winnerList.length?winnerList.map((u:any)=>`<@${u.id}>`).join(', '):'אין משתתפים';
      await channel?.send({embeds:[embed('🎊 הזוכים!',`פרס: **${prize}**\nזוכים: ${winnerText}`,0xffd700)]});
    }, minutes*60000);
    return interaction.editReply({embeds:[embed('✅ הגרלה נוצרה',`ההגרלה תסתיים בעוד **${minutes}** דקות`,0x00ff00)]});
  }

  if (commandName === 'suggest') {
    const suggestion = interaction.options.getString('suggestion');
    suggestions.push({user:user.username,text:suggestion,date:new Date()});
    const e = embed('💡 הצעה חדשה',`מאת: **${user.username}**\n\n${suggestion}`,0x667eea);
    await channel?.send({embeds:[e]});
    await channel?.messages?.cache?.last()?.react('👍');
    await channel?.messages?.cache?.last()?.react('👎');
    return interaction.editReply({embeds:[embed('✅ הצעה נשלחה','תודה על ההצעה!',0x00ff00)]});
  }

  if (commandName === 'afk') {
    const reason = interaction.options.getString('reason')||'AFK';
    afkUsers[user.id] = reason;
    return interaction.editReply({embeds:[embed('💤 AFK',`**${user.username}** הוגדר כ-AFK\nסיבה: ${reason}`,0xffa500)]});
  }

  if (commandName === 'reminder') {
    const message = interaction.options.getString('message');
    const minutes = interaction.options.getInteger('minutes');
    setTimeout(()=>{
      channel?.send({content:`⏰ <@${user.id}> תזכורת: **${message}**`});
    },minutes*60000);
    return interaction.editReply({embeds:[embed('⏰ תזכורת הוגדרה',`אזכיר לך **${message}** בעוד **${minutes}** דקות`,0x00ff00)]});
  }

  if (commandName === 'math') {
    const expr = interaction.options.getString('expression');
    try {
      const result = eval(expr.replace(/[^0-9+\-*/().%]/g,''));
      return interaction.editReply({embeds:[embed('🧮 חישוב',`**${expr}** = **${result}**`)]});
    } catch {
      return interaction.editReply({embeds:[errEmbed('ביטוי לא תקין')]});
    }
  }

  if (commandName === 'color') {
    const hex = interaction.options.getString('hex').replace('#','');
    const color = parseInt(hex,16);
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    const e = new EmbedBuilder().setTitle(`🎨 #${hex.toUpperCase()}`).setColor(color).addFields({name:'RGB',value:`rgb(${r}, ${g}, ${b})`,inline:true},{name:'HEX',value:`#${hex.toUpperCase()}`,inline:true}).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'qr') {
    const text = encodeURIComponent(interaction.options.getString('text'));
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${text}`;
    const e = new EmbedBuilder().setTitle('📱 QR Code').setImage(url).setColor(0x000000).setFooter({text:'By Yaniv'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'timestamp') {
    const now = Math.floor(Date.now()/1000);
    return interaction.editReply({embeds:[embed('🕐 זמן',`עכשיו: <t:${now}:F>\nTimestamp: **${now}**`)]});
  }

  if (commandName === 'weather') {
    const city = interaction.options.getString('city');
    return interaction.editReply({embeds:[embed('🌤️ מזג אוויר',`**${city}**\n🌡️ טמפ': **${Math.floor(Math.random()*30+5)}°C**\n💧 לחות: **${Math.floor(Math.random()*60+30)}%**\n💨 רוח: **${Math.floor(Math.random()*30)}km/h**\n\n_נתונים לדוגמה_`)]});
  }

  if (commandName === 'translate') {
    const text = interaction.options.getString('text');
    return interaction.editReply({embeds:[embed('🌐 תרגום',`**מקור:** ${text}\n\n_לתרגום אמיתי חבר את Google Translate API_`)]});
  }

  // ══════════════════════════════════════════════════════
  //  SYSTEM
  // ══════════════════════════════════════════════════════
  if (commandName === 'status') {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let disk = 'N/A';
    try{disk=execSync('df -h /').toString().split('\n')[1];}catch{}
    const e = new EmbedBuilder().setTitle('📊 סטטוס שרת').setColor(0x00b4d8)
      .addFields(
        {name:'🖥️ CPU',value:`${cpus[0]?.model||'N/A'} (${cpus.length} ליבות)`,inline:false},
        {name:'💾 RAM',value:`${formatBytes(totalMem-freeMem)} / ${formatBytes(totalMem)}`,inline:true},
        {name:'⏱️ Uptime',value:formatUptime(os.uptime()),inline:true},
        {name:'💿 דיסק',value:disk,inline:false},
        {name:'🏠 Host',value:os.hostname(),inline:true},
        {name:'🐧 OS',value:`${os.type()} ${os.release()}`,inline:true},
      ).setFooter({text:'By Yaniv'}).setTimestamp();
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'sysinfo') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    const out = await runCmd('uname -a && echo "---" && free -h && echo "---" && df -h');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (!isAdmin(member) && ['ps','top','df','netstat','docker','dockerstats','services','logs','restart','exec','kill'].includes(commandName)) {
    return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
  }

  if (commandName === 'ps') {
    const out = await runCmd('ps aux --sort=-%cpu | head -15');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'top') {
    const out = await runCmd('ps aux --sort=-%cpu | head -11');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'df') {
    const out = await runCmd('df -h');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'netstat') {
    const out = await runCmd('ss -tulnp 2>/dev/null | head -20');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'docker') {
    const out = await runCmd('docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}" 2>&1');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'dockerstats') {
    const out = await runCmd('docker stats --no-stream 2>&1');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'services') {
    const out = await runCmd('systemctl list-units --type=service --state=running 2>/dev/null | head -20');
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'logs') {
    const svc = interaction.options.getString('service');
    const out = await runCmd(`journalctl -u "${svc}" -n 30 --no-pager 2>&1`);
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  if (commandName === 'restart') {
    const svc = interaction.options.getString('service');
    const out = await runCmd(`systemctl restart "${svc}" 2>&1 && echo "✅ ${svc} הופעל מחדש"`);
    return interaction.editReply({embeds:[embed('🔄 Restart',out)]});
  }

  if (commandName === 'exec') {
    const cmd = interaction.options.getString('command');
    const out = await runCmd(cmd);
    return interaction.editReply({content:`\`\`\`\n$ ${cmd}\n\n${out}\n\`\`\``});
  }

  if (commandName === 'kill') {
    const pid = interaction.options.getInteger('pid');
    const out = await runCmd(`kill -15 ${pid} && echo "✅ SIGTERM sent to PID ${pid}"`);
    return interaction.editReply({embeds:[embed('💀 Kill',out)]});
  }

  if (commandName === 'pinghost') {
    const host = interaction.options.getString('host');
    const out = await runCmd(`ping -c 4 "${host}" 2>&1`);
    return interaction.editReply({content:`\`\`\`\n${out}\n\`\`\``});
  }

  // ══════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════
  //  FINANCE & MARKET COMMANDS
  // ══════════════════════════════════════════════════════

  if (commandName === 'stock') {
    const symbol = interaction.options.getString('symbol').toUpperCase();
    const finnhubKey = process.env.FINNHUB_KEY || '';
    if (!finnhubKey) return interaction.editReply({embeds:[errEmbed('חסר FINNHUB_KEY ב-Railway')]});

    // Translate text to Hebrew using Google Translate (free, no key)
    const translateHe = async (text: string): Promise<string> => {
      try {
        const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=he&dt=t&q=${encodeURIComponent(text)}`, {timeout:5000});
        return res.data?.[0]?.map((r:any)=>r[0]).join('')||text;
      } catch { return text; }
    };

    const buildStockEmbed = async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];

      const [quoteRes, profileRes, newsRes, sentimentRes, recRes, metricsRes] = await Promise.allSettled([
        axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${yesterday}&to=${today}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`),
      ]);

      const q = quoteRes.status==='fulfilled' ? quoteRes.value.data : null;
      const p = profileRes.status==='fulfilled' ? profileRes.value.data : {};
      const news = newsRes.status==='fulfilled' ? newsRes.value.data?.slice(0,3) : [];
      const sent = sentimentRes.status==='fulfilled' ? sentimentRes.value.data : null;
      const rec = recRes.status==='fulfilled' ? recRes.value.data?.[0] : null;
      const metrics = metricsRes.status==='fulfilled' ? metricsRes.value.data?.metric : null;

      if (!q?.c) throw new Error(`לא נמצאה מניה: ${symbol}`);

      const price = q.c;
      const change = q.d || 0;
      const changePct = Math.abs(q.dp || 0);
      const isUp = change >= 0;

      // Color by magnitude
      let color = 0x95a5a6;
      if (isUp) color = changePct > 5 ? 0x00ff00 : changePct > 2 ? 0x2ecc71 : 0x27ae60;
      else color = changePct > 5 ? 0xff0000 : changePct > 2 ? 0xe74c3c : 0xc0392b;

      const signal = changePct > 5 ? (isUp?'🚀 זינוק חזק!':'💥 קריסה!') :
                     changePct > 2 ? (isUp?'📈 עלייה משמעותית':'📉 ירידה משמעותית') :
                     changePct > 0.5 ? (isUp?'↗️ עלייה קלה':'↘️ ירידה קלה') : '😐 יציב';

      // Range bar
      const rangePos = Math.min(100, Math.max(0, ((price-q.l)/(q.h-q.l||1))*100));
      const filled = Math.round(rangePos/10);
      const bar = '█'.repeat(filled)+'░'.repeat(10-filled);

      // Sentiment
      let sentText = 'N/A';
      if (sent?.sentiment) {
        const bull = (sent.sentiment.bullishPercent*100).toFixed(0);
        const bear = (sent.sentiment.bearishPercent*100).toFixed(0);
        const scoreBar = '🟢'.repeat(Math.round(Number(bull)/20))+'🔴'.repeat(Math.round(Number(bear)/20));
        sentText = `${scoreBar}\n🐂 ${bull}% עולים | 🐻 ${bear}% יורדים`;
      }

      // Analyst recommendations
      let analystText = 'N/A';
      if (rec) {
        const total = rec.buy+rec.hold+rec.sell+rec.strongBuy+rec.strongSell||1;
        const score = ((rec.strongBuy*2+rec.buy-rec.sell-rec.strongSell*2)/total).toFixed(1);
        analystText = `💚 קנה: ${rec.strongBuy+rec.buy} | 🟡 החזק: ${rec.hold} | ❤️ מכור: ${rec.sell+rec.strongSell}\nציון: **${Number(score)>0?'+':''}${score}** (${Number(score)>0.5?'📈 קנה':Number(score)<-0.5?'📉 מכור':'😐 החזק'})`;
      }

      // Key metrics
      let metricsText = 'N/A';
      if (metrics) {
        const pe = metrics['peBasicExclExtraTTM']?.toFixed(1);
        const eps = metrics['epsBasicExclExtraAnnual']?.toFixed(2);
        const w52h = metrics['52WeekHigh']?.toFixed(2);
        const w52l = metrics['52WeekLow']?.toFixed(2);
        const beta = metrics['beta']?.toFixed(2);
        const divYield = metrics['dividendYieldIndicatedAnnual']?.toFixed(2);
        metricsText = [
          pe ? `P/E: **${pe}**` : null,
          eps ? `EPS: **$${eps}**` : null,
          beta ? `Beta: **${beta}**` : null,
          divYield ? `דיבידנד: **${divYield}%**` : null,
          w52h && w52l ? `52W: $${w52l} - $${w52h}` : null,
        ].filter(Boolean).join(' | ');
      }

      // Translate news to Hebrew
      let whyMoved = 'אין חדשות אחרונות';
      if (news?.length) {
        const translated = await Promise.all(
          news.slice(0,3).map(async (n:any) => {
            const heb = await translateHe(n.headline||'');
            return `• ${heb}`;
          })
        );
        whyMoved = translated.join('\n');
      }

      // Market cap
      const mcap = p?.marketCapitalization ? `$${(p.marketCapitalization/1000).toFixed(1)}B` : (metrics?.['marketCapitalization'] ? `$${(metrics['marketCapitalization']/1000).toFixed(1)}B` : 'N/A');

      const e = new EmbedBuilder()
        .setTitle(`${isUp?'🟢':'🔴'} **${symbol}** ${signal}`)
        .setColor(color)
        .setDescription(`**${p?.name||symbol}**\n${p?.exchange||''} • ${p?.finnhubIndustry||''} • שווי שוק: ${mcap}`)
        .setThumbnail(p?.logo||null)
        .addFields(
          {name:'💵 מחיר נוכחי', value:`## $${price.toFixed(2)}`, inline:true},
          {name:`${isUp?'📈':'📉'} שינוי היום`, value:`**${isUp?'+':''}${change.toFixed(2)}$** (${isUp?'+':''}${changePct.toFixed(2)}%)`, inline:true},
          {name:'📅 סגירה אתמול', value:`$${q.pc?.toFixed(2)||'N/A'}`, inline:true},
          {name:'🔓 פתיחה', value:`$${q.o?.toFixed(2)||'N/A'}`, inline:true},
          {name:'📉 שפל יומי', value:`$${q.l?.toFixed(2)||'N/A'}`, inline:true},
          {name:'📈 שיא יומי', value:`$${q.h?.toFixed(2)||'N/A'}`, inline:true},
          {name:'📊 מיקום בטווח היומי', value:`\`[${bar}]\` ${rangePos.toFixed(0)}%\n📉 $${q.l?.toFixed(2)} ←——→ 📈 $${q.h?.toFixed(2)}`, inline:false},
          {name:'📐 מדדים פיננסיים', value:metricsText||'N/A', inline:false},
          {name:'👨‍💼 המלצות אנליסטים', value:analystText, inline:false},
          {name:'🧠 סנטימנט שוק', value:sentText, inline:false},
          {name:'📰 למה זז? (חדשות בעברית)', value:whyMoved.slice(0,500), inline:false},
        )
        .setFooter({text:`Finnhub • עדכון: ${new Date().toLocaleTimeString('he-IL')} • DYOR`})
        .setTimestamp();

      return e;
    };

    try {
      const stockEmbed = await buildStockEmbed();
      const refreshBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_refresh_${symbol}`).setLabel('🔄 רענן').setStyle(ButtonStyle.Primary),
      );
      return interaction.editReply({embeds:[stockEmbed], components:[refreshBtn]});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${e.message}`)]});
    }
  }

  if (commandName === 'crypto') {
    const coin = interaction.options.getString('coin').toLowerCase();
    try {
      const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,ils&include_24hr_change=true&include_market_cap=true`);
      const data = res.data?.[coin];
      if (!data) return interaction.editReply({embeds:[errEmbed(`מטבע לא נמצא: ${coin}`)]});

      const price = data.usd;
      const change = data.usd_24h_change?.toFixed(2);
      const isUp = change >= 0;
      const marketCap = data.usd_market_cap ? `$${(data.usd_market_cap/1e9).toFixed(2)}B` : 'N/A';

      return interaction.editReply({embeds:[new EmbedBuilder()
        .setTitle(`${isUp?'🟢':'🔴'} ${coin.charAt(0).toUpperCase()+coin.slice(1)}`)
        .setColor(isUp ? 0x2ecc71 : 0xe74c3c)
        .addFields(
          {name:'💵 מחיר USD', value:`**$${price?.toLocaleString()}**`, inline:true},
          {name:'🪙 מחיר ILS', value:`**₪${data.ils?.toLocaleString()}**`, inline:true},
          {name:'📊 שינוי 24h', value:`${isUp?'+':''}${change}%`, inline:true},
          {name:'🏦 שווי שוק', value:marketCap, inline:true},
        )
        .setFooter({text:'מקור: CoinGecko'})
        .setTimestamp()
      ]});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${e.message}`)]});
    }
  }

  if (commandName === 'profit') {
    const cost = interaction.options.getNumber('cost');
    const price = interaction.options.getNumber('price');
    const shipping = interaction.options.getNumber('shipping') || 0;
    const etsyFee = price * 0.065; // Etsy 6.5% transaction fee
    const listingFee = 0.20; // Etsy listing fee
    const paymentFee = price * 0.03 + 0.25; // Payment processing
    const totalFees = etsyFee + listingFee + paymentFee + shipping;
    const profit = price - cost - totalFees;
    const margin = ((profit / price) * 100).toFixed(1);
    const isGood = profit > 0;

    return interaction.editReply({embeds:[new EmbedBuilder()
      .setTitle('💹 מחשבון רווח Etsy')
      .setColor(isGood ? 0x2ecc71 : 0xe74c3c)
      .addFields(
        {name:'💰 מחיר מכירה', value:`$${price.toFixed(2)}`, inline:true},
        {name:'🏭 עלות ייצור', value:`$${cost.toFixed(2)}`, inline:true},
        {name:'📦 משלוח', value:`$${shipping.toFixed(2)}`, inline:true},
        {name:'📊 עמלת Etsy (6.5%)', value:`$${etsyFee.toFixed(2)}`, inline:true},
        {name:'💳 עמלת תשלום', value:`$${paymentFee.toFixed(2)}`, inline:true},
        {name:'📋 עמלת רישום', value:`$${listingFee.toFixed(2)}`, inline:true},
        {name:isGood?'✅ רווח נקי':'❌ הפסד', value:`**$${profit.toFixed(2)}** (${margin}%)`, inline:false},
      )
      .setFooter({text:'כולל עמלות Etsy רגילות'})
    ]});
  }

  if (commandName === 'currency') {
    const amount = interaction.options.getNumber('amount');
    const from = interaction.options.getString('from').toUpperCase();
    const to = interaction.options.getString('to').toUpperCase();
    try {
      const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`);
      const rate = res.data?.rates?.[to];
      if (!rate) return interaction.editReply({embeds:[errEmbed(`מטבע לא נמצא: ${to}`)]});
      const result = (amount * rate).toFixed(2);
      return interaction.editReply({embeds:[new EmbedBuilder()
        .setTitle('💱 המרת מטבע')
        .setColor(0x3498db)
        .setDescription(`**${amount.toLocaleString()} ${from}** = **${Number(result).toLocaleString()} ${to}**`)
        .addFields({name:'שער חליפין', value:`1 ${from} = ${rate.toFixed(4)} ${to}`, inline:true})
        .setTimestamp()
      ]});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${e.message}`)]});
    }
  }

  if (commandName === 'etsy-search') {
    const keyword = interaction.options.getString('keyword');
    try {
      const res = await axios.get(`https://openapi.etsy.com/v3/application/listings/active`, {
        params: { keywords: keyword, limit: 5, sort_on: 'score' },
        headers: { 'x-api-key': process.env.ETSY_API_KEY || '' }
      });
      const listings = res.data?.results || [];
      if (!listings.length) return interaction.editReply({embeds:[errEmbed('לא נמצאו תוצאות')]});

      const prices = listings.map((l:any) => parseFloat(l.price?.amount||'0')/(l.price?.divisor||100));
      const avgPrice = (prices.reduce((a:number,b:number)=>a+b,0)/prices.length).toFixed(2);
      const minPrice = Math.min(...prices).toFixed(2);
      const maxPrice = Math.max(...prices).toFixed(2);

      const e = new EmbedBuilder()
        .setTitle(`🛍️ Etsy — "${keyword}"`)
        .setColor(0xf56400)
        .addFields(
          {name:'💰 מחיר ממוצע', value:`$${avgPrice}`, inline:true},
          {name:'📉 הכי זול', value:`$${minPrice}`, inline:true},
          {name:'📈 הכי יקר', value:`$${maxPrice}`, inline:true},
        );

      listings.slice(0,3).forEach((l:any, i:number) => {
        const p = (parseFloat(l.price?.amount||'0')/(l.price?.divisor||100)).toFixed(2);
        e.addFields({name:`${i+1}. ${l.title?.slice(0,50)||''}`, value:`💵 $${p}`, inline:false});
      });

      return interaction.editReply({embeds:[e]});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed('שגיאה בחיפוש Etsy - בדוק ETSY_API_KEY')]});
    }
  }

  //  SHOP
  // ══════════════════════════════════════════════════════
  if (commandName === 'shop') {
    const e = new EmbedBuilder().setTitle('🛒 חנות Yaniv Bot').setColor(0x667eea).setDescription('מוצרים דיגיטליים מקצועיים | תשלום PayPal');
    const cats: Record<string,any[]> = {};
    for (const [id,p] of Object.entries(PRODUCTS)) {
      const cat = id.includes('discord')?'🎮 דיסקורד':id.includes('website')?'🌐 אתרים':id.includes('vps')?'🖥️ שרתים':id.includes('stars')?'⭐ כוכבים':'📦 אחר';
      if(!cats[cat]) cats[cat]=[];
      cats[cat].push(`**${p.name}** — $${p.price} | \`/buy ${id}\``);
    }
    for (const [cat,items] of Object.entries(cats)) {
      e.addFields({name:cat,value:items.join('\n'),inline:false});
    }
    e.setFooter({text:'Bot by Yaniv 🚀'});
    return interaction.editReply({embeds:[e]});
  }

  if (commandName === 'products') {
    const list = Object.entries(PRODUCTS).map(([id,p]:any)=>`\`${id}\` — ${p.name} — **$${p.price}**`).join('\n');
    return interaction.editReply({embeds:[embed('📦 מוצרים',list)]});
  }

  if (commandName === 'price') {
    const id = interaction.options.getString('product');
    const p = PRODUCTS[id];
    if(!p) return interaction.editReply({embeds:[errEmbed('מוצר לא נמצא')]});
    return interaction.editReply({embeds:[embed(`💰 ${p.name}`,`מחיר: **$${p.price}**\n${p.desc}\n\nלרכישה: \`/buy ${id}\``,0x00b09b)]});
  }

  if (commandName === 'buy') {
    const id = interaction.options.getString('product');
    const p = PRODUCTS[id];
    if(!p) return interaction.editReply({embeds:[errEmbed('מוצר לא נמצא. /products לרשימה')]});
    const e = embed(`💳 רכישה: ${p.name}`,`💰 מחיר: **$${p.price}**\n📦 ${p.desc}\n\n_צור קשר עם מנהל לקישור תשלום PayPal_`,0x00b09b);
    return interaction.editReply({embeds:[e]});
  }

  // ══════════════════════════════════════════════════════
  //  VERIFY
  // ══════════════════════════════════════════════════════
  if (commandName === 'setup-verify') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    const role = interaction.options.getRole('role');
    let verifyChannel = interaction.options.getChannel('channel');

    if (!verifyChannel) {
      verifyChannel = await guild?.channels?.create({
        name: 'verify',
        type: 0,
        topic: '✅ לחץ על הכפתור כדי לאמת את עצמך ולקבל גישה לשרת',
        permissionOverwrites: [
          {id: guild?.roles?.everyone?.id, allow: ['ViewChannel','ReadMessageHistory'], deny: ['SendMessages']},
        ],
      });
    }

    const verifyEmbed = new EmbedBuilder()
      .setTitle('✅ אימות חברים')
      .setDescription(
        '## ברוכים הבאים לשרת! 🎉\n\n' +
        'כדי לקבל גישה מלאה לשרת ולכל הערוצים, עליך לאמת את עצמך.\n\n' +
        '**לחץ על הכפתור למטה כדי להתאמת!**\n\n' +
        '_האימות הוא חד-פעמי ולוקח שנייה אחת_'
      )
      .setColor(0x57F287)
      .setThumbnail(guild?.iconURL({size:512})||'')
      .addFields(
        {name:'📋 מה מקבלים?', value:'גישה לכל ערוצי השרת 🔓', inline:true},
        {name:'⏱️ כמה זמן לוקח?', value:'שנייה אחת! ⚡', inline:true},
      )
      .setFooter({text:'Bot by Yaniv 🚀 | לחץ כדי לאמת'})
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('✅ אמת אותי!')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛡️')
    );

    await verifyChannel?.send({embeds:[verifyEmbed], components:[row]});

    verifyConfig[guild?.id] = {roleId: role.id, channelId: verifyChannel?.id};
    if (!verifiedUsers[guild?.id]) verifiedUsers[guild?.id] = new Set();

    return interaction.editReply({embeds:[embed(
      '✅ מערכת אימות הוגדרה!',
      `📢 ערוץ אימות: <#${verifyChannel?.id}>\n🎭 תפקיד: **${role.name}**\n\n` +
      `**המלצות:**\n• הסתר את כל הערוצים מ-@everyone\n• תן גישה רק לתפקיד **${role.name}**\n• כך רק חברים מאומתים יראו את השרת`,
      0x57F287
    )]});
  }

  if (commandName === 'verify-stats') {
    const cfg = verifyConfig[guild?.id];
    const count = verifiedUsers[guild?.id]?.size||0;
    if (!cfg) return interaction.editReply({embeds:[errEmbed('מערכת אימות לא הוגדרה. השתמש ב-/setup-verify')]});
    const role = guild?.roles?.cache?.get(cfg.roleId);
    return interaction.editReply({embeds:[embed(
      '📊 סטטיסטיקות אימות',
      `✅ חברים מאומתים: **${count}**\n🎭 תפקיד: **${role?.name||cfg.roleId}**\n📢 ערוץ: <#${cfg.channelId}>`,
      0x57F287
    )]});
  }

  if (commandName === 'unverify') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    const u = interaction.options.getUser('user');
    const cfg = verifyConfig[guild?.id];
    if (!cfg) return interaction.editReply({embeds:[errEmbed('מערכת אימות לא הוגדרה')]});
    const m = guild?.members?.cache?.get(u.id);
    await m?.roles?.remove(cfg.roleId);
    verifiedUsers[guild?.id]?.delete(u.id);
    return interaction.editReply({embeds:[embed('🔒 אימות הוסר',`**${u.username}** הוסר מהמאומתים`,0xff6b35)]});
  }


  // ══════════════════════════════════════════════════════
  //  SETUP STOCKS SERVER
  // ══════════════════════════════════════════════════════
  if (commandName === 'stock-live') {
    const symbol = interaction.options.getString('symbol').toUpperCase();
    const finnhubKey = process.env.FINNHUB_KEY || '';
    if (!finnhubKey) return interaction.editReply({embeds:[errEmbed('חסר FINNHUB_KEY')]});

    // Stop any existing ticker in this channel and delete old message
    for (const [msgId, ticker] of liveTickers.entries()) {
      if (ticker.channelId === interaction.channelId) {
        clearInterval(ticker.intervalId);
        liveTickers.delete(msgId);
        try {
          const ch = await client.channels.fetch(ticker.channelId) as any;
          const oldMsg = await ch.messages.fetch(msgId);
          await oldMsg.delete();
        } catch {}
      }
    }

    const getStockData = async () => {
      const finnhubKey = process.env.FINNHUB_KEY || '';
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now()-86400000).toISOString().split('T')[0];
      const [qR, pR, nR, sR, rR] = await Promise.allSettled([
        axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${yesterday}&to=${today}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
      ]);
      const q = qR.status==='fulfilled'?qR.value.data:null;
      const p = pR.status==='fulfilled'?pR.value.data:{};
      const news = nR.status==='fulfilled'?nR.value.data?.slice(0,2):[];
      const sent = sR.status==='fulfilled'?sR.value.data:null;
      const rec = rR.status==='fulfilled'?rR.value.data?.[0]:null;
      return {q,p,news,sent,rec};
    };

    const buildLiveEmbed = async () => {
      const {q,p,news,sent,rec} = await getStockData();
      if (!q?.c) return null;

      const price=q.c, change=q.d||0, pct=Math.abs(q.dp||0);
      const isUp=change>=0;
      let color = isUp?(pct>5?0x00ff00:pct>2?0x2ecc71:0x27ae60):(pct>5?0xff0000:pct>2?0xe74c3c:0xc0392b);
      const signal = pct>5?(isUp?'🚀 זינוק!':'💥 קריסה!'):pct>2?(isUp?'📈 עולה':'📉 יורד'):pct>0.3?(isUp?'↗️':'↘️'):'😐';
      const rangePos=Math.min(100,Math.max(0,((price-q.l)/(q.h-q.l||1))*100));
      const bar='█'.repeat(Math.round(rangePos/10))+'░'.repeat(10-Math.round(rangePos/10));

      let sentText='N/A';
      if(sent?.sentiment){const bull=(sent.sentiment.bullishPercent*100).toFixed(0);const bear=(sent.sentiment.bearishPercent*100).toFixed(0);sentText=`🐂${bull}% | 🐻${bear}%`;}

      let recText='N/A';
      if(rec){const tot=rec.buy+rec.hold+rec.sell+rec.strongBuy+rec.strongSell||1;const s=((rec.strongBuy*2+rec.buy-rec.sell-rec.strongSell*2)/tot).toFixed(1);recText=`💚${rec.strongBuy+rec.buy} 🟡${rec.hold} ❤️${rec.sell+rec.strongSell} → ${Number(s)>0.5?'קנה':Number(s)<-0.5?'מכור':'החזק'}`;}

      // Translate top news
      let newsText = 'N/A';
      if(news?.length){
        const translated = await Promise.all(news.map(async(n:any)=>{
          try{const r=await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=he&dt=t&q=${encodeURIComponent((n.headline||'').slice(0,150))}`,{timeout:4000});return `• ${r.data?.[0]?.map((x:any)=>x[0]).join('')||n.headline}`;}catch{return `• ${n.headline?.slice(0,80)||''}`;}
        }));
        newsText = translated.join('\n');
      }

      const now = new Date().toLocaleTimeString('he-IL');
      return new EmbedBuilder()
        .setTitle(`${isUp?'🟢':'🔴'} **${symbol}** ${signal} | 📡 LIVE`)
        .setColor(color)
        .setDescription(`**${p?.name||symbol}** | ${p?.exchange||''} | ${p?.finnhubIndustry||''}`)
        .setThumbnail(p?.logo||null)
        .addFields(
          {name:'💵 מחיר', value:`## $${price.toFixed(2)}`, inline:true},
          {name:`${isUp?'📈':'📉'} שינוי`, value:`**${isUp?'+':''}${change.toFixed(2)}** (${isUp?'+':''}${pct.toFixed(2)}%)`, inline:true},
          {name:'📅 אתמול', value:`$${q.pc?.toFixed(2)}`, inline:true},
          {name:'📊 טווח יומי', value:`\`[${bar}]\` ${rangePos.toFixed(0)}%\n📉$${q.l?.toFixed(2)} ←——→ 📈$${q.h?.toFixed(2)}`, inline:false},
          {name:'👨‍💼 אנליסטים', value:recText, inline:true},
          {name:'🧠 סנטימנט', value:sentText, inline:true},
          {name:'📰 חדשות (עברית)', value:newsText.slice(0,400)||'N/A', inline:false},
        )
        .setFooter({text:`🔄 עדכון אוטומטי כל 60 שניות | עכשיו: ${now}`})
        .setTimestamp();
    };

    try {
      const firstEmbed = await buildLiveEmbed();
      if (!firstEmbed) return interaction.editReply({embeds:[errEmbed(`לא נמצאה מניה: ${symbol}`)]});

      const stopBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_stop_live`).setLabel('⏹️ עצור').setStyle(ButtonStyle.Danger),
      );
      const msg = await interaction.editReply({embeds:[firstEmbed], components:[stopBtn]}) as any;

      // Auto-update every 15 seconds
      const intervalId = setInterval(async () => {
        try {
          const e = await buildLiveEmbed();
          if (e) await msg.edit({embeds:[e], components:[stopBtn]});
        } catch {}
      }, 15000);

      liveTickers.set(msg.id, {symbol, channelId: interaction.channelId, intervalId});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${e.message}`)]});
    }
  }

  if (commandName === 'stock-stop') {
    let stopped = false;
    for (const [msgId, ticker] of liveTickers.entries()) {
      if (ticker.channelId === interaction.channelId) {
        clearInterval(ticker.intervalId);
        liveTickers.delete(msgId);
        stopped = true;
      }
    }
    return interaction.editReply({embeds:[embed(stopped?'⏹️ Live ticker עצר':'❌ אין ticker פעיל', stopped?`עצרתי את ה-ticker של **${[...liveTickers.values()][0]?.symbol||''}** בערוץ זה`:'לא נמצא ticker פעיל בערוץ זה', stopped?0xff6b35:0xe74c3c)]});
  }

  // ══════════════════════════════════════════════════════
  //  PORTFOLIO
  // ══════════════════════════════════════════════════════
  if (commandName === 'portfolio-add') {
    const symbol = interaction.options.getString('symbol').toUpperCase();
    const shares = interaction.options.getNumber('shares');
    const buyPrice = interaction.options.getNumber('buyprice');
    const userId = interaction.user.id;
    const portfolio = portfolios.get(userId) || [];
    const existing = portfolio.find(p => p.symbol === symbol);
    if (existing) {
      const totalShares = existing.shares + shares;
      existing.buyPrice = (existing.buyPrice * existing.shares + buyPrice * shares) / totalShares;
      existing.shares = totalShares;
    } else {
      portfolio.push({ symbol, shares, buyPrice });
    }
    portfolios.set(userId, portfolio);
    return interaction.editReply({embeds:[embed(`✅ נוסף לתיק`, `**${symbol}** — ${shares} מניות במחיר $${buyPrice.toFixed(2)}\nסה"כ ${portfolio.find(p=>p.symbol===symbol)!.shares} מניות ב-$${portfolio.find(p=>p.symbol===symbol)!.buyPrice.toFixed(2)} ממוצע`, 0x2ecc71)]});
  }

  if (commandName === 'portfolio-view') {
    const userId = interaction.user.id;
    const portfolio = portfolios.get(userId) || [];
    if (!portfolio.length) return interaction.editReply({embeds:[errEmbed('התיק שלך ריק — הוסף מניות עם /portfolio-add')]});
    const finnhubKey = process.env.FINNHUB_KEY || '';
    let totalCost = 0, totalValue = 0;
    const lines: string[] = [];
    for (const item of portfolio) {
      try {
        const r = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${item.symbol}&token=${finnhubKey}`);
        const price = r.data.c || 0;
        const cost = item.shares * item.buyPrice;
        const value = item.shares * price;
        const pnl = value - cost;
        const pct = ((pnl / cost) * 100).toFixed(2);
        const arrow = pnl >= 0 ? '🟢' : '🔴';
        lines.push(`${arrow} **${item.symbol}** — ${item.shares} מניות | שווי: $${value.toFixed(2)} | רווח/הפסד: ${pnl>=0?'+':''}$${pnl.toFixed(2)} (${pct}%)`);
        totalCost += cost;
        totalValue += value;
      } catch {
        lines.push(`⚪ **${item.symbol}** — ${item.shares} מניות (לא ניתן לטעון מחיר)`);
      }
    }
    const totalPnl = totalValue - totalCost;
    const totalPct = ((totalPnl / totalCost) * 100).toFixed(2);
    const e = new EmbedBuilder()
      .setTitle(`📊 תיק המניות של ${interaction.user.username}`)
      .setDescription(lines.join('\n'))
      .addFields(
        {name:'💰 עלות כוללת', value:`$${totalCost.toFixed(2)}`, inline:true},
        {name:'📈 שווי נוכחי', value:`$${totalValue.toFixed(2)}`, inline:true},
        {name:`${totalPnl>=0?'🟢':'🔴'} רווח/הפסד`, value:`${totalPnl>=0?'+':''}$${totalPnl.toFixed(2)} (${totalPct}%)`, inline:true}
      )
      .setColor(totalPnl >= 0 ? 0x2ecc71 : 0xe74c3c)
      .setTimestamp();
    return interaction.editReply({embeds:[e]});
  }

  // ══════════════════════════════════════════════════════
  //  ANALYZE STOCK — PREMIUM + AUTO-UPDATE
  // ══════════════════════════════════════════════════════
  if (commandName === 'analyze') {
    const symbol = interaction.options.getString('symbol').toUpperCase();
    const finnhubKey = process.env.FINNHUB_KEY || '';
    if (!finnhubKey) return interaction.editReply({embeds:[errEmbed('חסר FINNHUB_KEY')]});

    const buildAnalysis = async () => {
      const toTs = Math.floor(Date.now()/1000);
      const fromTs = toTs - 60*86400;

      const [quoteRes, profileRes, metricsRes, recRes, newsRes, candleRes] = await Promise.allSettled([
        axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(Date.now()-7*86400000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${fromTs}&to=${toTs}&token=${finnhubKey}`)
      ]);

      const q = quoteRes.status==='fulfilled' ? quoteRes.value.data : {};
      const p = profileRes.status==='fulfilled' ? profileRes.value.data : {};
      const m = metricsRes.status==='fulfilled' ? metricsRes.value.data?.metric || {} : {};
      const recs = recRes.status==='fulfilled' ? recRes.value.data || [] : [];
      const news = newsRes.status==='fulfilled' ? newsRes.value.data?.slice(0,3) || [] : [];
      const candles = candleRes.status==='fulfilled' ? candleRes.value.data : {};

      if (!q.c || q.c === 0) return null;

      const price = q.c;
      const change = q.dp || 0;
      const changeAbs = q.d || 0;
      const high52 = m['52WeekHigh'] || price;
      const low52  = m['52WeekLow']  || price;
      const pe     = m.peBasicExclExtraTTM || m.peTTM || null;
      const beta   = m.beta || null;
      const revenueGrowth = m.revenueGrowthTTMYoy || null;
      const grossMargin   = m.grossMarginTTM || null;
      const debtEq        = m.totalDebt_totalEquityQuarterly || null;
      const eps           = m.epsBasicExclExtraItemsTTM || null;
      const roe           = m.roeTTM || null;

      // ── Candle analysis ────────────────────────────────
      const closes: number[]    = candles.c || [];
      const highs: number[]     = candles.h || [];
      const lows: number[]      = candles.l || [];
      const opens: number[]     = candles.o || [];
      const volumes: number[]   = candles.v || [];
      const timestamps: number[]= candles.t || [];

      let breakoutStatus = ''; let breakoutAdvice = ''; let breakoutColor = 0x5865f2;
      let resistance = 0; let support = 0; let volSpike = 1; let trend = 'שטוח';

      if (closes.length >= 20) {
        resistance = Math.max(...highs.slice(-20));
        support    = Math.min(...lows.slice(-20));
        const last5C = closes.slice(-5);
        const last5range = (Math.max(...last5C) - Math.min(...last5C)) / price * 100;
        const distToRes = (resistance - price) / price * 100;
        const distToSup = (price - support)    / price * 100;
        const avgVol  = volumes.slice(-11,-1).reduce((a,b)=>a+b,0)/10;
        const todayVol= volumes[volumes.length-1]||0;
        volSpike = avgVol > 0 ? todayVol/avgVol : 1;
        const avg5     = last5C.reduce((a,b)=>a+b,0)/5;
        const prev5    = closes.slice(-10,-5);
        const avgPrev5 = prev5.length ? prev5.reduce((a,b)=>a+b,0)/prev5.length : avg5;
        trend = avg5 > avgPrev5 ? 'עולה ↗' : avg5 < avgPrev5 ? 'יורד ↘' : 'שטוח →';

        if (last5range < 1.5) {
          breakoutStatus = '😴 דישדוש — המניה תקועה';
          breakoutAdvice = `נסחרת בטווח צר של **${last5range.toFixed(1)}%** ב-5 הימים האחרונים\n🎯 **מתי להיכנס:** המתן לפריצה מעל **$${resistance.toFixed(2)}** עם נפח גבוה\n⚠️ **מתי לצאת:** ירידה מתחת **$${support.toFixed(2)}** = אות מכירה`;
          breakoutColor = 0xf39c12;
        } else if (distToRes < 1.5 && change > 0 && volSpike > 1.3) {
          breakoutStatus = '🚀 פריצה עכשיו! — כנס עכשיו';
          breakoutAdvice = `פורצת את ההתנגדות **$${resistance.toFixed(2)}** עם נפח ×${volSpike.toFixed(1)} מהממוצע!\n🟢 **כניסה:** עכשיו או מעל $${(resistance*1.005).toFixed(2)}\n🎯 **יעד:** $${(resistance*1.05).toFixed(2)} (+5%) | 🛑 **סטופ:** $${(resistance*0.97).toFixed(2)}`;
          breakoutColor = 0x00d084;
        } else if (distToRes < 3 && trend.includes('עולה')) {
          breakoutStatus = '⚡ מתקרב לפריצה — היה מוכן';
          breakoutAdvice = `רק **${distToRes.toFixed(1)}%** מתחת להתנגדות **$${resistance.toFixed(2)}**\n👀 **מה לעשות:** שים עין — פריצה + נפח גבוה = כנס\n📌 **תמיכה מתחת:** $${support.toFixed(2)}`;
          breakoutColor = 0xf1c40f;
        } else if (distToSup < 2 && change < 0) {
          breakoutStatus = '⚠️ על גבול התמיכה — שים לב';
          breakoutAdvice = `יורדת לתמיכה **$${support.toFixed(2)}**\n🟢 **אם תחזיק:** אפשר כניסה בניסיון קפיצה\n🔴 **אם תשבר מטה:** מכור מיד — יעד הבא $${(support*0.95).toFixed(2)}`;
          breakoutColor = 0xe67e22;
        } else if (change < -2) {
          breakoutStatus = '🔴 ירידה חדה — אל תיכנס';
          breakoutAdvice = `ירדה **${change.toFixed(1)}%** היום — לא זמן לקנייה\n⏳ **מה לעשות:** המתן לייצוב מעל $${support.toFixed(2)} לפחות יום-יומיים`;
          breakoutColor = 0xe74c3c;
        } else {
          breakoutStatus = `📊 מגמה ${trend}`;
          breakoutAdvice = `🔴 **התנגדות:** $${resistance.toFixed(2)} — פריצה = כנס\n🔵 **תמיכה:** $${support.toFixed(2)} — שבירה = צא`;
          breakoutColor = 0x3498db;
        }
      }

      // ── Chart: QuickChart candlestick dark theme ───────
      let chartUrl = '';
      if (closes.length >= 10) {
        const N = Math.min(25, closes.length);
        const sO = opens.slice(-N), sH = highs.slice(-N), sL = lows.slice(-N);
        const sC = closes.slice(-N), sT = timestamps.slice(-N), sV = volumes.slice(-N);
        const labels = sT.map(t => { const d=new Date(t*1000); return `${d.getMonth()+1}/${d.getDate()}`; });
        const candleData = sT.map((_,i) => ({x:labels[i],o:+sO[i].toFixed(2),h:+sH[i].toFixed(2),l:+sL[i].toFixed(2),c:+sC[i].toFixed(2)}));
        const calcMA = (arr:number[], period:number) => arr.map((_,i)=>i<period-1?null:+(arr.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period).toFixed(2));
        const allC = closes.slice(-(N+50));
        const ma20 = calcMA(allC,20).slice(-N).map((y,i)=>({x:labels[i],y}));
        const ma50 = calcMA(allC,50).slice(-N).map((y,i)=>({x:labels[i],y}));
        const priceMin=Math.min(...sL)*0.997, priceMax=Math.max(...sH)*1.003;
        const maxV=Math.max(...sV)||1, volH=(priceMax-priceMin)*0.18;
        const volBars=sV.map((v,i)=>({x:labels[i],y:+(priceMin+(v/maxV)*volH).toFixed(2)}));
        const resLine=resistance?labels.map(x=>({x,y:+resistance.toFixed(2)})):[];
        const supLine=support?labels.map(x=>({x,y:+support.toFixed(2)})):[];
        const cfg={
          type:'candlestick',
          data:{
            labels,
            datasets:[
              {label:symbol, data:candleData, color:{up:'#26a69a',down:'#ef5350',unchanged:'#888'}},
              {type:'line',label:'MA20',data:ma20,borderColor:'#f6c90e',borderWidth:1.5,pointRadius:0,fill:false},
              {type:'line',label:'MA50',data:ma50,borderColor:'#c678dd',borderWidth:1.5,pointRadius:0,fill:false},
              ...(resistance?[{type:'line',label:`התנגדות $${resistance.toFixed(0)}`,data:resLine,borderColor:'rgba(239,83,80,0.9)',borderDash:[6,3],borderWidth:2,pointRadius:0,fill:false}]:[]),
              ...(support?[{type:'line',label:`תמיכה $${support.toFixed(0)}`,data:supLine,borderColor:'rgba(38,166,154,0.9)',borderDash:[6,3],borderWidth:2,pointRadius:0,fill:false}]:[]),
              {type:'bar',label:'נפח',data:volBars,backgroundColor:sC.map((c,i)=>c>=(sO[i]||c)?'rgba(38,166,154,0.45)':'rgba(239,83,80,0.45)'),borderWidth:0}
            ]
          },
          options:{
            legend:{display:true,labels:{fontColor:'#c0c0c0',fontSize:11,boxWidth:12,padding:10}},
            scales:{
              xAxes:[{ticks:{fontColor:'#666',maxTicksLimit:10,fontSize:10},gridLines:{color:'rgba(255,255,255,0.04)'}}],
              yAxes:[{position:'right',ticks:{fontColor:'#888',fontSize:10},gridLines:{color:'rgba(255,255,255,0.06)'}}]
            },
            title:{display:true,text:`${symbol}  ·  יומי  ·  MA20  MA50  ·  תמיכה/התנגדות`,fontColor:'#d0d0d0',fontSize:13,padding:10},
            layout:{padding:{top:5,bottom:5,left:5,right:10}}
          },
          backgroundColor:'#131722'
        };
        try {
          const qcRes = await axios.post('https://quickchart.io/chart/create', {chart: cfg, width:820, height:420, backgroundColor:'#131722'}, {timeout:10000});
          if (qcRes.data?.url) chartUrl = qcRes.data.url;
        } catch {
          chartUrl = `https://quickchart.io/chart?w=820&h=420&c=${encodeURIComponent(JSON.stringify(cfg))}`.slice(0,2000);
        }
      }

      // ── Analyst ────────────────────────────────────────
      const rec = recs[0]||{};
      const totalRec = (rec.strongBuy||0)+(rec.buy||0)+(rec.hold||0)+(rec.sell||0)+(rec.strongSell||0);
      const bullish = (rec.strongBuy||0)+(rec.buy||0);
      const bearish = (rec.sell||0)+(rec.strongSell||0);
      const analystBullPct = totalRec ? Math.round(bullish/totalRec*100) : 50;
      const analystBar = '🟢'.repeat(Math.round(bullish/Math.max(totalRec,1)*5)) + '⚪'.repeat(Math.round((rec.hold||0)/Math.max(totalRec,1)*5)) + '🔴'.repeat(Math.round(bearish/Math.max(totalRec,1)*5));

      // ── Score ──────────────────────────────────────────
      const rangePct = high52>low52 ? Math.round((price-low52)/(high52-low52)*100) : 50;
      const rangeBar = '█'.repeat(Math.round(rangePct/10))+'░'.repeat(10-Math.round(rangePct/10));
      let score = 50;
      if (change>0) score+=5; else score-=5;
      if (rangePct<30) score+=10; if (rangePct>80) score-=10;
      if (pe&&pe>0&&pe<20) score+=10; if (pe&&pe>40) score-=10;
      if (beta&&beta<1) score+=5; if (beta&&beta>2) score-=5;
      if (revenueGrowth&&revenueGrowth>10) score+=10;
      score = Math.round(Math.max(0,Math.min(100,score))*0.4 + analystBullPct*0.6);
      const scoreBar = '█'.repeat(Math.round(score/10))+'░'.repeat(10-Math.round(score/10));

      let mainVerdict: string, verdictColor: number;
      if (score>=70)      {mainVerdict='✅ כן — נראה טוב להיכנס';     verdictColor=breakoutColor||0x2ecc71;}
      else if (score>=55) {mainVerdict='🟡 אולי — המתן לאות ברור';    verdictColor=breakoutColor||0xf1c40f;}
      else                {mainVerdict='❌ לא עכשיו — המניה חלשה';     verdictColor=breakoutColor||0xe74c3c;}

      // ── News ───────────────────────────────────────────
      const newsLines: string[] = [];
      for (const n of news.slice(0,3)) {
        try {
          const tr = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=he&dt=t&q=${encodeURIComponent(n.headline?.slice(0,130)||'')}`,{timeout:3000});
          const headline = tr.data?.[0]?.[0]?.[0]||n.headline?.slice(0,120);
          const ago = Math.round((Date.now()/1000 - n.datetime)/3600);
          newsLines.push(`• ${headline} *(לפני ${ago}ש')*`);
        } catch { newsLines.push(`• ${n.headline?.slice(0,120)}`); }
      }

      // ── Build fields ───────────────────────────────────
      const now = new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',timeZone:'America/New_York'});

      // ── distances for display ──────────────────────────
      const distToRes = resistance ? ((resistance - price) / price * 100) : 0;
      const distToSup = support    ? ((price - support)   / price * 100) : 0;

      // ── Levels bar  ────────────────────────────────────
      const levelsVal = resistance && support
        ? `🔴 **התנגדות:** $${resistance.toFixed(2)}  *(${distToRes.toFixed(1)}% מעליך)*\n` +
          `🟢 **תמיכה:**    $${support.toFixed(2)}  *(${distToSup.toFixed(1)}% מתחתיך)*\n` +
          `📌 **עכשיו עומד על:** ${distToSup < distToRes ? `קרוב לתמיכה $${support.toFixed(2)}` : `מרחק מהתנגדות $${resistance.toFixed(2)}`}`
        : '—';

      // ── News ───────────────────────────────────────────
      const safeNews = newsLines.map(l=>l.slice(0,150)).join('\n').slice(0,600);

      // ── Fundamentals row ───────────────────────────────
      const peVal   = !pe?'—':pe<0?`${pe.toFixed(0)} 🔴`:pe<15?`${pe.toFixed(0)} ✅`:pe<30?`${pe.toFixed(0)} 🟡`:`${pe.toFixed(0)} 🔴`;
      const epsVal  = eps ? `$${eps.toFixed(2)} ${eps>0?'✅':'🔴'}` : '—';
      const betaVal = !beta?'—':beta<0.8?`${beta.toFixed(2)} 🟢`:beta<1.5?`${beta.toFixed(2)} 🟡`:`${beta.toFixed(2)} 🔴`;
      const growVal = revenueGrowth?`${revenueGrowth.toFixed(1)}% ${revenueGrowth>10?'✅':revenueGrowth>0?'🟡':'🔴'}`:'—';
      const margVal = grossMargin?`${grossMargin.toFixed(1)}% ${grossMargin>40?'✅':grossMargin>20?'🟡':'🔴'}`:'—';
      const debtVal = debtEq?`${debtEq.toFixed(2)}x ${debtEq<0.5?'✅':debtEq<1.5?'🟡':'🔴'}`:'—';

      const marketCap = p.marketCapitalization ? `$${(p.marketCapitalization/1000).toFixed(1)}B` : 'N/A';
      const capSize = p.marketCapitalization>500000?'🏢 Large':p.marketCapitalization>10000?'🏗️ Mid':'🏠 Small';

      const e = new EmbedBuilder()
        .setTitle(`${change>=0?'📈':'📉'} ${symbol} — $${price.toFixed(2)}  (${change>=0?'+':''}${change.toFixed(2)}%)`)
        .setDescription(
          `**${p.name||symbol}** · ${capSize} Cap · ${p.finnhubIndustry||'—'} · שווי ${marketCap}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${mainVerdict}\n` +
          `**${breakoutStatus}**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 ציון סוחר: **${score}/100**  \`${scoreBar}\`\n` +
          `📈 מגמה: **${trend}** · נפח ×${volSpike.toFixed(1)} · 🕐 NY ${now}`
        )
        .addFields(
          {name:'🎯 מה לעשות עכשיו', value:breakoutAdvice.slice(0,500)||'—', inline:false},
          {name:'📍 על מה המניה עומדת', value:levelsVal, inline:false},
          {name:'📅 טווח 52 שבועות', value:`$${low52.toFixed(0)} \`${rangeBar}\` $${high52.toFixed(0)}  (${rangePct}% מהשפל)`, inline:false},
          {name:'💵 P/E', value:peVal, inline:true},
          {name:'💰 EPS', value:epsVal, inline:true},
          {name:'⚡ בטא', value:betaVal, inline:true},
          {name:'📈 צמיחה', value:growVal, inline:true},
          {name:'💹 מרג\'ין', value:margVal, inline:true},
          {name:'🏦 חוב', value:debtVal, inline:true},
          {name:'👨‍💼 אנליסטים', value:totalRec?`${analystBar}  🟢${bullish} ⚪${rec.hold||0} 🔴${bearish}`:'—', inline:false},
          {name:'📰 חדשות אחרונות', value:safeNews||'אין חדשות', inline:false}
        )
        .setColor(verdictColor)
        .setFooter({text:`${symbol} · ⚠️ לא ייעוץ פיננסי · מתעדכן כל 15 שניות`})
        .setTimestamp();

      if (chartUrl) e.setImage(chartUrl);
      if (p.logo) e.setThumbnail(p.logo);
      return e;
    };

    try {
      // Stop existing analysis in this channel
      for (const [msgId, item] of liveAnalyses.entries()) {
        if (item.channelId === interaction.channelId) {
          clearInterval(item.intervalId);
          liveAnalyses.delete(msgId);
          try {
            const ch = await client.channels.fetch(item.channelId) as any;
            const oldMsg = await ch.messages.fetch(msgId);
            await oldMsg.delete();
          } catch {}
        }
      }

      const firstEmbed = await buildAnalysis();
      if (!firstEmbed) return interaction.editReply({embeds:[errEmbed(`לא נמצאה מניה: ${symbol}`)]});

      const msg = await interaction.editReply({embeds:[firstEmbed]}) as any;

      const intervalId = setInterval(async () => {
        try {
          const e = await buildAnalysis();
          if (e) await msg.edit({embeds:[e]});
        } catch {}
      }, 15000);

      liveAnalyses.set(msg.id, {symbol, channelId: interaction.channelId, intervalId});
    } catch(err:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${err.message}`)]});
    }
  }

  // ══════════════════════════════════════════════════════
  //  COMPARE STOCKS
  // ══════════════════════════════════════════════════════
  if (commandName === 'compare') {
    const s1 = interaction.options.getString('symbol1').toUpperCase();
    const s2 = interaction.options.getString('symbol2').toUpperCase();
    const finnhubKey = process.env.FINNHUB_KEY || '';
    if (!finnhubKey) return interaction.editReply({embeds:[errEmbed('חסר FINNHUB_KEY')]});
    const fetchStock = async (s: string) => {
      const [q, p] = await Promise.all([
        axios.get(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${s}&token=${finnhubKey}`)
      ]);
      return { ...q.data, ...p.data };
    };
    try {
      const [d1, d2] = await Promise.all([fetchStock(s1), fetchStock(s2)]);
      const row = (label: string, v1: string, v2: string) => ({name: label, value: `**${s1}:** ${v1}\n**${s2}:** ${v2}`, inline: true});
      const chg1 = d1.dp || 0, chg2 = d2.dp || 0;
      const winner = chg1 > chg2 ? s1 : s2;
      const e = new EmbedBuilder()
        .setTitle(`📊 השוואה: ${s1} vs ${s2}`)
        .setDescription(`🏆 ביצועים טובים יותר היום: **${winner}**`)
        .addFields(
          row('💰 מחיר', `$${d1.c?.toFixed(2)||'N/A'}`, `$${d2.c?.toFixed(2)||'N/A'}`),
          row('📈 שינוי יומי', `${chg1>=0?'+':''}${chg1?.toFixed(2)||'0'}%`, `${chg2>=0?'+':''}${chg2?.toFixed(2)||'0'}%`),
          row('🔼 גבוה יומי', `$${d1.h?.toFixed(2)||'N/A'}`, `$${d2.h?.toFixed(2)||'N/A'}`),
          row('🔽 נמוך יומי', `$${d1.l?.toFixed(2)||'N/A'}`, `$${d2.l?.toFixed(2)||'N/A'}`),
          row('🏢 שווי שוק', d1.marketCapitalization ? `$${(d1.marketCapitalization/1000).toFixed(1)}B` : 'N/A', d2.marketCapitalization ? `$${(d2.marketCapitalization/1000).toFixed(1)}B` : 'N/A'),
          row('🏭 ענף', d1.finnhubIndustry||'N/A', d2.finnhubIndustry||'N/A')
        )
        .setColor(chg1 > chg2 ? 0x2ecc71 : 0xe74c3c)
        .setTimestamp();
      return interaction.editReply({embeds:[e]});
    } catch(err:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${err.message}`)]});
    }
  }

  // ══════════════════════════════════════════════════════
  //  MARKET SUMMARY
  // ══════════════════════════════════════════════════════
  if (commandName === 'market-summary') {
    const finnhubKey = process.env.FINNHUB_KEY || '';
    if (!finnhubKey) return interaction.editReply({embeds:[errEmbed('חסר FINNHUB_KEY')]});
    const indices = [
      {symbol:'SPY', name:'S&P 500'},
      {symbol:'QQQ', name:'NASDAQ'},
      {symbol:'DIA', name:'DOW JONES'},
      {symbol:'IWM', name:'Russell 2000'},
      {symbol:'VIX', name:'VIX פחד'},
      {symbol:'GLD', name:'זהב (GLD)'},
      {symbol:'TLT', name:'אג"ח ארוך'},
      {symbol:'BTC-USD', name:'Bitcoin'},
    ];
    const results = await Promise.allSettled(
      indices.map(i => axios.get(`https://finnhub.io/api/v1/quote?symbol=${i.symbol}&token=${finnhubKey}`))
    );
    const fields = indices.map((idx, i) => {
      const r = results[i];
      if (r.status === 'rejected' || !r.value.data.c) return {name: idx.name, value: '❌ N/A', inline: true};
      const d = r.value.data;
      const chg = d.dp || 0;
      const arrow = chg >= 0 ? '🟢' : '🔴';
      return {name: idx.name, value: `${arrow} $${d.c?.toFixed(2)} (${chg>=0?'+':''}${chg.toFixed(2)}%)`, inline: true};
    });
    const now = new Date().toLocaleString('he-IL', {timeZone:'America/New_York'});
    const e = new EmbedBuilder()
      .setTitle('🌍 סיכום שוק עולמי')
      .setDescription(`⏰ שעון ניו יורק: ${now}`)
      .addFields(fields)
      .setColor(0x3498db)
      .setTimestamp();
    return interaction.editReply({embeds:[e]});
  }

  // ══════════════════════════════════════════════════════
  //  FEAR & GREED INDEX
  // ══════════════════════════════════════════════════════
  if (commandName === 'fear-greed') {
    try {
      const r = await axios.get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
        headers: {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.cnn.com/'}
      });
      const score = Math.round(r.data?.fear_and_greed?.score || 0);
      const rating = r.data?.fear_and_greed?.rating || '';
      const prev_close = Math.round(r.data?.fear_and_greed?.previous_close || 0);
      const prev_week = Math.round(r.data?.fear_and_greed?.previous_1_week || 0);
      const prev_month = Math.round(r.data?.fear_and_greed?.previous_1_month || 0);
      const prev_year = Math.round(r.data?.fear_and_greed?.previous_1_year || 0);
      const getEmoji = (s:number) => s <= 25 ? '😱 פחד קיצוני' : s <= 45 ? '😨 פחד' : s <= 55 ? '😐 ניטרלי' : s <= 75 ? '😏 חמדנות' : '🤑 חמדנות קיצונית';
      const getColor = (s:number) => s <= 25 ? 0xe74c3c : s <= 45 ? 0xe67e22 : s <= 55 ? 0xf1c40f : s <= 75 ? 0x2ecc71 : 0x27ae60;
      const bar = '█'.repeat(Math.round(score/10)) + '░'.repeat(10-Math.round(score/10));
      const e = new EmbedBuilder()
        .setTitle('😱 Fear & Greed Index — CNN')
        .setDescription(`## ${score}/100 — ${getEmoji(score)}\n\`${bar}\`\n\n**ציון רשמי:** ${rating}`)
        .addFields(
          {name:'📅 אתמול', value:`${prev_close} — ${getEmoji(prev_close)}`, inline:true},
          {name:'📅 שבוע שעבר', value:`${prev_week} — ${getEmoji(prev_week)}`, inline:true},
          {name:'📅 חודש שעבר', value:`${prev_month} — ${getEmoji(prev_month)}`, inline:true},
          {name:'📅 שנה שעברה', value:`${prev_year} — ${getEmoji(prev_year)}`, inline:true},
          {name:'💡 מה זה אומר?', value:score<=45?'🐻 **זמן לקנות?** — שוק פחד לרוב יוצר הזדמנויות':score>=55?'🐂 **שוק חמדני** — היזהר מבועות':'⚖️ **שוק מאוזן** — אין לחץ', inline:false}
        )
        .setColor(getColor(score))
        .setTimestamp();
      return interaction.editReply({embeds:[e]});
    } catch(err:any) {
      return interaction.editReply({embeds:[errEmbed(`לא ניתן לטעון את המדד: ${err.message}`)]});
    }
  }

  if (commandName === 'setup-stocks') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    await interaction.editReply({embeds:[embed('📈 בונה שרת מניות...','אנא המתן...',0x2ecc71)]});
    try {
      const everyone = guild?.roles?.everyone;

      // תפקידים
      const roles = [
        {name:'👑 Owner',       color:0xf1c40f, hoist:true},
        {name:'⚡ Admin',       color:0xe74c3c, hoist:true},
        {name:'📊 Analyst',     color:0x3498db, hoist:true},
        {name:'💎 Premium',     color:0x9b59b6, hoist:true},
        {name:'🐂 Bull',        color:0x2ecc71, hoist:true},
        {name:'🐻 Bear',        color:0xe74c3c, hoist:false},
        {name:'✅ Verified',    color:0x1abc9c, hoist:false},
        {name:'👥 Member',      color:0x95a5a6, hoist:false},
      ];
      const createdRoles: Record<string,any> = {};
      for (const r of roles) {
        try {
          const role = await guild?.roles?.create({name:r.name,color:r.color,hoist:r.hoist,reason:'Stocks Server Setup'});
          createdRoles[r.name] = role;
        } catch {}
      }

      // ─── קטגוריות וערוצים ──────────────────
      const cats = [
        {
          name:'📋 ─── מידע ───',
          channels:[
            {name:'📜│rules',         topic:'חוקי השרת'},
            {name:'📢│announcements',  topic:'הכרזות חשובות'},
            {name:'🎯│introduction',   topic:'הצג את עצמך'},
          ]
        },
        {
          name:'📈 ─── מניות ───',
          channels:[
            {name:'📊│stocks-general',  topic:'שיחה כללית על מניות'},
            {name:'🔥│hot-picks',       topic:'מניות חמות של היום'},
            {name:'📉│short-ideas',     topic:'פוזיציות שורט'},
            {name:'🚀│long-ideas',      topic:'פוזיציות לונג'},
            {name:'💹│day-trading',     topic:'טריידינג יומי'},
            {name:'📆│swing-trading',   topic:'סווינג טריידינג'},
          ]
        },
        {
          name:'💰 ─── קריפטו ───',
          channels:[
            {name:'₿│bitcoin',          topic:'Bitcoin בלבד'},
            {name:'Ξ│ethereum',         topic:'Ethereum בלבד'},
            {name:'🪙│altcoins',        topic:'Altcoins וטוקנים'},
            {name:'📡│crypto-news',     topic:'חדשות קריפטו'},
          ]
        },
        {
          name:'🛒 ─── Etsy & חנויות ───',
          channels:[
            {name:'🎨│etsy-general',    topic:'שיחה על Etsy'},
            {name:'💡│product-ideas',   topic:'רעיונות למוצרים'},
            {name:'📦│suppliers',       topic:'ספקים וסיטונאים'},
            {name:'💰│pricing',         topic:'תמחור ורווחיות'},
            {name:'📸│listings-review', topic:'ביקורת על Listings'},
            {name:'🏆│success-stories', topic:'סיפורי הצלחה'},
          ]
        },
        {
          name:'📊 ─── ניתוח ───',
          channels:[
            {name:'📰│market-news',     topic:'חדשות שוק'},
            {name:'📈│charts',          topic:'גרפים וטכניקל'},
            {name:'🧮│fundamental',     topic:'ניתוח פונדמנטלי'},
            {name:'🤖│bots-commands',   topic:'פקודות בוט'},
          ]
        },
        {
          name:'💬 ─── קהילה ───',
          channels:[
            {name:'💬│general',         topic:'שיחה חופשית'},
            {name:'😂│memes',           topic:'מימים על שוק ההון'},
            {name:'🎯│goals',           topic:'יעדים פיננסיים'},
          ]
        },
        {
          name:'🔊 ─── קולי ───',
          channels:[
            {name:'📞 Trading Room',    voice:true},
            {name:'📊 Analysis Call',   voice:true},
            {name:'🎮 Chill Zone',      voice:true},
          ]
        },
      ];

      for (const cat of cats) {
        try {
          const category = await guild?.channels?.create({name:cat.name, type:4});
          for (const ch of cat.channels) {
            try {
              await guild?.channels?.create({
                name: ch.name,
                type: ch.voice ? 2 : 0,
                parent: category?.id,
                topic: ch.topic,
                permissionOverwrites: ch.name.includes('staff') ? [
                  {id:everyone.id, deny:['ViewChannel']},
                  {id:createdRoles['⚡ Admin']?.id||'', allow:['ViewChannel']},
                ] : [],
              });
            } catch {}
          }
        } catch {}
      }

      // embed ברוכים הבאים
      const welcomeCh = guild?.channels?.cache?.find((c:any)=>c.name?.includes('rules'));
      if (welcomeCh) {
        const e = new EmbedBuilder()
          .setTitle('📈 ברוכים הבאים לשרת המניות!')
          .setColor(0x2ecc71)
          .setDescription('**שרת מקצועי למסחר, ניתוח ו-Etsy**')
          .addFields(
            {name:'📊 פקודות מניות', value:'`/stock AAPL` — מחיר מניה\n`/crypto bitcoin` — מחיר קריפטו\n`/currency 100 USD ILS` — המרה', inline:false},
            {name:'🛒 פקודות Etsy', value:'`/etsy-search keyword` — חפש מוצרים\n`/profit 5 25` — מחשבון רווח', inline:false},
            {name:'📜 חוקים', value:'✅ כבדו זה את זה\n✅ אין ספאם\n✅ מסחר אחראי בלבד\n⚠️ אין המלצות השקעה מחייבות', inline:false},
          )
          .setFooter({text:'Bot by Yaniv 🚀 | DYOR - Do Your Own Research'});
        await (welcomeCh as any).send({embeds:[e]}).catch(()=>{});
      }

      return interaction.editReply({embeds:[embed(
        '✅ שרת מניות נבנה בהצלחה!',
        `נוצרו **${roles.length} תפקידים** ו-**${cats.reduce((a,c)=>a+c.channels.length,0)} ערוצים**\n\n📈 מניות | 💰 קריפטו | 🛒 Etsy | 📊 ניתוח`,
        0x2ecc71
      )]});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה: ${e.message}`)]});
    }
  }

  // ══════════════════════════════════════════════════════
  //  SETUP SERVER
  // ══════════════════════════════════════════════════════
  if (commandName === 'setup-server') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    await interaction.editReply({embeds:[embed('🏗️ בונה שרת...','אנא המתן, זה יכול לקחת כמה שניות...',0xffa500)]});

    try {
      const everyone = guild?.roles?.everyone;

      // ── יצירת תפקידים ──────────────────────────────────
      const roleData = [
        {name:'👑 Owner',      color:0xf1c40f, hoist:true, position:10},
        {name:'⚡ Admin',      color:0xe74c3c, hoist:true, position:9},
        {name:'🛡️ Moderator', color:0x3498db, hoist:true, position:8},
        {name:'💎 VIP',        color:0x9b59b6, hoist:true, position:7},
        {name:'🎫 Staff',      color:0xe67e22, hoist:true, position:6},
        {name:'✅ Verified',   color:0x2ecc71, hoist:false, position:5},
        {name:'👥 Member',     color:0x95a5a6, hoist:false, position:4},
        {name:'🤖 Bot',        color:0x34495e, hoist:false, position:3},
      ];
      const createdRoles: Record<string,any> = {};
      for (const r of roleData) {
        try {
          const role = await guild?.roles?.create({name:r.name,color:r.color,hoist:r.hoist,reason:'Server Setup by Yaniv Bot'});
          createdRoles[r.name] = role;
        } catch {}
      }
      const staffRole   = createdRoles['🎫 Staff'];
      const verifiedRole= createdRoles['✅ Verified'];
      const everyoneDeny= {ViewChannel:false};
      const verifiedAllow={ViewChannel:true};

      // ── יצירת קטגוריות וערוצים ──────────────────────────
      // 📋 INFO (גלוי לכולם)
      const catInfo = await guild?.channels?.create({name:'📋 ─── INFO ───',type:4});
      await guild?.channels?.create({name:'📌│rules',        type:0, parent:catInfo?.id, topic:'חוקי השרת'});
      await guild?.channels?.create({name:'📢│announcements',type:0, parent:catInfo?.id, topic:'הכרזות רשמיות'});
      const welcomeCh = await guild?.channels?.create({name:'👋│welcome',    type:0, parent:catInfo?.id, topic:'ברוכים הבאים!'});
      await guild?.channels?.create({name:'🗺️│server-guide', type:0, parent:catInfo?.id, topic:'מדריך השרת'});

      // 🔐 VERIFY (גלוי לכולם, רק לקריאה)
      const catVerify = await guild?.channels?.create({name:'🔐 ─── VERIFY ───',type:4,
        permissionOverwrites:[
          {id:everyone?.id,allow:['ViewChannel','ReadMessageHistory'],deny:['SendMessages']},
          ...(verifiedRole?[{id:verifiedRole.id,allow:['ViewChannel']}]:[]),
        ]
      });
      const verifyCh = await guild?.channels?.create({name:'✅│verify',type:0,parent:catVerify?.id,
        permissionOverwrites:[
          {id:everyone?.id,allow:['ViewChannel','ReadMessageHistory'],deny:['SendMessages']},
        ]
      });

      // 💬 GENERAL (רק מאומתים)
      const catGeneral = await guild?.channels?.create({name:'💬 ─── GENERAL ───',type:4,
        permissionOverwrites:[
          {id:everyone?.id,...everyoneDeny},
          ...(verifiedRole?[{id:verifiedRole.id,...verifiedAllow}]:[]),
        ]
      });
      await guild?.channels?.create({name:'💬│general',     type:0, parent:catGeneral?.id});
      await guild?.channels?.create({name:'🖼️│media',       type:0, parent:catGeneral?.id, topic:'תמונות וסרטונים'});
      await guild?.channels?.create({name:'😂│memes',       type:0, parent:catGeneral?.id});
      await guild?.channels?.create({name:'🔗│links',       type:0, parent:catGeneral?.id});
      await guild?.channels?.create({name:'🤖│bot-commands',type:0, parent:catGeneral?.id});

      // 🎵 MUSIC
      const catMusic = await guild?.channels?.create({name:'🎵 ─── MUSIC ───',type:4,
        permissionOverwrites:[{id:everyone?.id,...everyoneDeny},...(verifiedRole?[{id:verifiedRole.id,...verifiedAllow}]:[])]
      });
      await guild?.channels?.create({name:'🎵│music-commands',type:0, parent:catMusic?.id});
      await guild?.channels?.create({name:'🎙️ Music Room',   type:2, parent:catMusic?.id, userLimit:20});
      await guild?.channels?.create({name:'🎙️ Chill Zone',   type:2, parent:catMusic?.id, userLimit:10});
      await guild?.channels?.create({name:'🎙️ 24/7 Radio',   type:2, parent:catMusic?.id, userLimit:50});

      // 🎮 GAMING
      const catGaming = await guild?.channels?.create({name:'🎮 ─── GAMING ───',type:4,
        permissionOverwrites:[{id:everyone?.id,...everyoneDeny},...(verifiedRole?[{id:verifiedRole.id,...verifiedAllow}]:[])]
      });
      await guild?.channels?.create({name:'🎮│gaming-chat',  type:0, parent:catGaming?.id});
      await guild?.channels?.create({name:'🏆│achievements', type:0, parent:catGaming?.id});
      await guild?.channels?.create({name:'📋│lfg',          type:0, parent:catGaming?.id, topic:'חפש שחקנים'});
      await guild?.channels?.create({name:'🎙️ Gaming #1',   type:2, parent:catGaming?.id, userLimit:10});
      await guild?.channels?.create({name:'🎙️ Gaming #2',   type:2, parent:catGaming?.id, userLimit:10});
      await guild?.channels?.create({name:'🎙️ Squad',       type:2, parent:catGaming?.id, userLimit:6});

      // 🛒 SHOP
      const catShop = await guild?.channels?.create({name:'🛒 ─── SHOP ───',type:4,
        permissionOverwrites:[{id:everyone?.id,...everyoneDeny},...(verifiedRole?[{id:verifiedRole.id,...verifiedAllow}]:[])]
      });
      await guild?.channels?.create({name:'🛒│shop',   type:0, parent:catShop?.id, topic:'השתמש ב /shop'});
      await guild?.channels?.create({name:'💰│orders', type:0, parent:catShop?.id});
      await guild?.channels?.create({name:'⭐│reviews',type:0, parent:catShop?.id});

      // 🎫 TICKETS
      const catTickets = await guild?.channels?.create({name:'🎫 ─── TICKETS ───',type:4,
        permissionOverwrites:[
          {id:everyone?.id,deny:['ViewChannel','SendMessages']},
          ...(staffRole?[{id:staffRole.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','ManageChannels']}]:[]),
        ]
      });
      const ticketInfoCh = await guild?.channels?.create({name:'📋│open-ticket',type:0,parent:catTickets?.id,
        permissionOverwrites:[
          {id:everyone?.id,allow:['ViewChannel','ReadMessageHistory'],deny:['SendMessages']},
          ...(verifiedRole?[{id:verifiedRole.id,allow:['ViewChannel','ReadMessageHistory']}]:[]),
        ]
      });
      ticketConfig[guild?.id] = {categoryId: catTickets?.id, staffRoleId: staffRole?.id};

      // 🔊 VOICE LOUNGE
      const catVoice = await guild?.channels?.create({name:'🔊 ─── LOUNGE ───',type:4,
        permissionOverwrites:[{id:everyone?.id,...everyoneDeny},...(verifiedRole?[{id:verifiedRole.id,...verifiedAllow}]:[])]
      });
      await guild?.channels?.create({name:'🎙️ Lobby',  type:2, parent:catVoice?.id, userLimit:0});
      await guild?.channels?.create({name:'🎙️ Chill',  type:2, parent:catVoice?.id, userLimit:8});
      await guild?.channels?.create({name:'📚 Study',  type:2, parent:catVoice?.id, userLimit:5});
      await guild?.channels?.create({name:'😴 AFK',    type:2, parent:catVoice?.id, userLimit:99});

      // 👑 STAFF (סגור)
      const catStaff = await guild?.channels?.create({name:'👑 ─── STAFF ───',type:4,
        permissionOverwrites:[
          {id:everyone?.id,...everyoneDeny},
          ...(staffRole?[{id:staffRole.id,allow:['ViewChannel','SendMessages','ReadMessageHistory']}]:[]),
        ]
      });
      await guild?.channels?.create({name:'💬│staff-chat', type:0, parent:catStaff?.id});
      await guild?.channels?.create({name:'📝│mod-logs',   type:0, parent:catStaff?.id});
      await guild?.channels?.create({name:'🔨│action-log', type:0, parent:catStaff?.id});
      await guild?.channels?.create({name:'🎙️ Staff VC',  type:2, parent:catStaff?.id, userLimit:10});

      // ── שלח embed לverify ──────────────────────────────
      if (verifyCh && verifiedRole) {
        verifyConfig[guild?.id] = {roleId: verifiedRole.id, channelId: verifyCh.id};
        if (!verifiedUsers[guild?.id]) verifiedUsers[guild?.id] = new Set();
        const vEmbed = new EmbedBuilder()
          .setTitle('🛡️ אימות חברים')
          .setDescription('## ברוכים הבאים! 🎉\n\nכדי לקבל גישה לכל ערוצי השרת **לחץ על הכפתור למטה**.\n\nהאימות חד-פעמי ולוקח שנייה אחת ⚡')
          .setColor(0x57F287)
          .setThumbnail(guild?.iconURL({size:512})||'')
          .addFields({name:'✅ מה תקבל?',value:'גישה לכל הערוצים 🔓',inline:true},{name:'⏱️ כמה זמן?',value:'שנייה! ⚡',inline:true})
          .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp();
        const vRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('verify_button').setLabel('✅ אמת אותי!').setStyle(ButtonStyle.Success).setEmoji('🛡️')
        );
        await verifyCh.send({embeds:[vEmbed], components:[vRow]});
      }

      // ── שלח embed לtickets ─────────────────────────────
      if (ticketInfoCh) {
        const tEmbed = new EmbedBuilder()
          .setTitle('🎫 מערכת טיקטים')
          .setDescription('## צריך עזרה? פתח טיקט! 🎫\n\nהצוות שלנו כאן בשבילך.\nלחץ על הכפתור למטה כדי לפתוח טיקט פרטי.')
          .setColor(0x5865f2)
          .addFields(
            {name:'⏱️ זמן תגובה',value:'עד 24 שעות',inline:true},
            {name:'🔒 פרטיות',value:'כל טיקט פרטי',inline:true},
            {name:'📋 קטגוריות',value:'תמיכה / דיווח / שאלות / אחר',inline:false},
          )
          .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp();
        const tRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 פתח טיקט').setStyle(ButtonStyle.Primary).setEmoji('📩'),
          new ButtonBuilder().setCustomId('ticket_report').setLabel('🚨 דווח').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
          new ButtonBuilder().setCustomId('ticket_question').setLabel('❓ שאלה').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
        );
        await ticketInfoCh.send({embeds:[tEmbed], components:[tRow]});
      }

      // ── welcome embed ──────────────────────────────────
      if (welcomeCh) {
        const wEmbed = new EmbedBuilder()
          .setTitle(`🎉 ברוכים הבאים ל-${guild?.name}!`)
          .setDescription('אנחנו שמחים שהצטרפת אלינו!\n\n📋 קרא את החוקים ב **#📌│rules**\n✅ אמת את עצמך ב **#✅│verify**\n💬 התחל לשוחח ב **#💬│general**\n🎫 צריך עזרה? פתח **#📋│open-ticket**')
          .setColor(0xffd700)
          .setThumbnail(guild?.iconURL({size:512})||'')
          .setImage('https://i.imgur.com/your-banner.png')
          .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp();
        await welcomeCh.send({embeds:[wEmbed]});
      }

      return interaction.editReply({embeds:[new EmbedBuilder()
        .setTitle('✅ השרת הוכן בהצלחה!')
        .setColor(0x57F287)
        .setDescription('🏗️ כל הערוצים, הקטגוריות והתפקידים נוצרו!')
        .addFields(
          {name:'🎭 תפקידים שנוצרו',value:'👑 Owner • ⚡ Admin • 🛡️ Moderator • 💎 VIP • 🎫 Staff • ✅ Verified • 👥 Member',inline:false},
          {name:'📁 קטגוריות',value:'📋 INFO • 🔐 VERIFY • 💬 GENERAL • 🎵 MUSIC • 🎮 GAMING • 🛒 SHOP • 🎫 TICKETS • 🔊 LOUNGE • 👑 STAFF',inline:false},
          {name:'⚡ מה הבא?',value:'1. תן לעצמך תפקיד **👑 Owner**\n2. הסתר את הקטגוריה הישנה\n3. תן לבוט הרשאות **Administrator**',inline:false},
        )
        .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp()
      ]});
    } catch(e:any) {
      return interaction.editReply({embeds:[errEmbed(`שגיאה בבניית השרת: ${e.message?.slice(0,200)}`)]});
    }
  }

  // ══════════════════════════════════════════════════════
  //  TICKETS
  // ══════════════════════════════════════════════════════
  if (commandName === 'setup-tickets') {
    if (!isAdmin(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות Admin')]});
    let ticketCh = interaction.options.getChannel('channel');
    if (!ticketCh) {
      const cat = await guild?.channels?.create({name:'🎫 ─── TICKETS ───',type:4});
      ticketCh = await guild?.channels?.create({name:'📋│open-ticket',type:0,parent:cat?.id,
        permissionOverwrites:[{id:guild?.roles?.everyone?.id,allow:['ViewChannel','ReadMessageHistory'],deny:['SendMessages']}]
      });
      ticketConfig[guild?.id] = {categoryId:cat?.id};
    }
    const tEmbed = new EmbedBuilder()
      .setTitle('🎫 מערכת טיקטים')
      .setDescription('## צריך עזרה? פתח טיקט! 🎫\n\nלחץ על אחד הכפתורים למטה לפתיחת טיקט פרטי.')
      .setColor(0x5865f2)
      .addFields(
        {name:'⏱️ זמן תגובה',value:'עד 24 שעות',inline:true},
        {name:'🔒 פרטיות',value:'כל טיקט פרטי',inline:true},
      )
      .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp();
    const tRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel('🎫 תמיכה').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_report').setLabel('🚨 דיווח').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_question').setLabel('❓ שאלה').setStyle(ButtonStyle.Secondary),
    );
    await ticketCh?.send({embeds:[tEmbed],components:[tRow]});
    return interaction.editReply({embeds:[embed('✅ מערכת טיקטים הוגדרה!',`טיקטים נפתחים ב <#${ticketCh?.id}>`,0x00ff00)]});
  }

  if (commandName === 'close-ticket') {
    if (!channel?.name?.startsWith('ticket-') && !channel?.name?.startsWith('🎫')) {
      return interaction.editReply({embeds:[errEmbed('פקודה זו עובדת רק בתוך טיקט')]});
    }
    const closeEmbed = embed('🔒 הטיקט נסגר',`נסגר על ידי **${user.username}**\nהערוץ ימחק תוך 5 שניות...`,0xff6b35);
    await interaction.editReply({embeds:[closeEmbed]});
    setTimeout(()=>channel?.delete('Ticket closed').catch(()=>{}),5000);
  }

  if (commandName === 'add-ticket') {
    if (!channel?.name?.startsWith('ticket-') && !channel?.name?.startsWith('🎫')) {
      return interaction.editReply({embeds:[errEmbed('פקודה זו עובדת רק בתוך טיקט')]});
    }
    const u = interaction.options.getUser('user');
    await channel?.permissionOverwrites?.edit(u.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});
    return interaction.editReply({embeds:[embed('✅ נוסף לטיקט',`<@${u.id}> נוסף לטיקט`,0x00ff00)]});
  }

  if (commandName === 'ticket-rename') {
    if (!isMod(member)) return interaction.editReply({embeds:[errEmbed('נדרשות הרשאות מוד')]});
    const name = interaction.options.getString('name');
    await channel?.setName(`🎫-${name}`);
    return interaction.editReply({embeds:[embed('✅ שם שונה',`הטיקט שונה ל-**🎫-${name}**`,0x00ff00)]});
  }
});

// ─── Button interactions (Verify + Tickets) ───────────────────────────────────
client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isButton()) return;
  const {guild, user, customId} = interaction;

  // ── VERIFY ──────────────────────────────────────────
  if (customId === 'verify_button') {
    const guildId = guild?.id;
    const cfg = verifyConfig[guildId];
    if (!cfg) return interaction.reply({content:'❌ מערכת האימות לא מוגדרת. פנה למנהל.',flags:64});
    const member = interaction.member;
    if (member?.roles?.cache?.has(cfg.roleId)) {
      return interaction.reply({content:'✅ אתה כבר מאומת! יש לך גישה מלאה לשרת.',flags:64});
    }
    try {
      await member?.roles?.add(cfg.roleId);
      if (!verifiedUsers[guildId]) verifiedUsers[guildId] = new Set();
      verifiedUsers[guildId].add(user.id);
      return interaction.reply({
        embeds:[new EmbedBuilder()
          .setTitle('✅ אומת בהצלחה!')
          .setDescription(`ברוך הבא **${user.username}**! 🎉\nקיבלת גישה מלאה לשרת!`)
          .setColor(0x57F287)
          .setThumbnail(user.displayAvatarURL({size:256}))
          .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp()
        ],
        flags:64
      });
    } catch(e:any) {
      return interaction.reply({content:`❌ שגיאה: ${e.message}`,flags:64});
    }
  }

  // ── TICKETS ─────────────────────────────────────────
  if (['ticket_open','ticket_report','ticket_question'].includes(customId)) {
    const guildId = guild?.id;
    const cfg = ticketConfig[guildId];
    if (!ticketCounter[guildId]) ticketCounter[guildId] = 0;
    ticketCounter[guildId]++;
    const num = String(ticketCounter[guildId]).padStart(4,'0');
    const typeEmoji = customId==='ticket_report'?'🚨':customId==='ticket_question'?'❓':'🎫';
    const typeName  = customId==='ticket_report'?'דיווח':customId==='ticket_question'?'שאלה':'תמיכה';

    try {
      const ticketChannel = await guild?.channels?.create({
        name: `${typeEmoji}ticket-${num}`,
        type: 0,
        parent: cfg?.categoryId||undefined,
        topic: `טיקט ${typeName} של ${user.username} | #${num}`,
        permissionOverwrites: [
          {id: guild?.roles?.everyone?.id, deny:['ViewChannel']},
          {id: user.id, allow:['ViewChannel','SendMessages','ReadMessageHistory','AttachFiles']},
          ...(cfg?.staffRoleId?[{id:cfg.staffRoleId, allow:['ViewChannel','SendMessages','ReadMessageHistory','ManageChannels']}]:[]),
          {id: guild?.members?.me?.id, allow:['ViewChannel','SendMessages','ReadMessageHistory','ManageChannels']},
        ],
      });

      const tEmbed = new EmbedBuilder()
        .setTitle(`${typeEmoji} טיקט ${typeName} #${num}`)
        .setDescription(
          `שלום <@${user.id}>! 👋\n\nהצוות שלנו יחזור אליך בהקדם.\n**אנא תאר את הבעיה/השאלה שלך**\n\nלסגירת הטיקט לחץ על הכפתור למטה.`
        )
        .setColor(customId==='ticket_report'?0xe74c3c:customId==='ticket_question'?0x95a5a6:0x5865f2)
        .addFields(
          {name:'👤 פתח על ידי',value:`<@${user.id}>`,inline:true},
          {name:'📋 סוג',value:typeName,inline:true},
          {name:'🔢 מספר',value:`#${num}`,inline:true},
        )
        .setFooter({text:'Bot by Yaniv 🚀'}).setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 סגור טיקט').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('✋ קח טיקט').setStyle(ButtonStyle.Success),
      );

      await ticketChannel?.send({content:`<@${user.id}>${cfg?.staffRoleId?` <@&${cfg.staffRoleId}>`:''}`});
      await ticketChannel?.send({embeds:[tEmbed], components:[closeRow]});

      return interaction.reply({content:`✅ הטיקט שלך נפתח! <#${ticketChannel?.id}>`, flags:64});
    } catch(e:any) {
      return interaction.reply({content:`❌ שגיאה: ${e.message}`,flags:64});
    }
  }

  if (customId.startsWith('stock_refresh_')) {
    const symbol = customId.replace('stock_refresh_', '');
    await interaction.deferUpdate();
    const finnhubKey = process.env.FINNHUB_KEY || '';
    try {
      const [quoteRes, newsRes, sentimentRes, profileRes] = await Promise.allSettled([
        axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(Date.now()-86400000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${finnhubKey}`),
        axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${finnhubKey}`),
      ]);
      const q = quoteRes.status==='fulfilled' ? quoteRes.value.data : null;
      const p = profileRes.status==='fulfilled' ? profileRes.value.data : {};
      const news = newsRes.status==='fulfilled' ? newsRes.value.data?.slice(0,3) : [];
      const sent = sentimentRes.status==='fulfilled' ? sentimentRes.value.data : null;
      if (!q?.c) return interaction.editReply({content:'לא נמצאו נתונים'});

      const price = q.c, change = q.d||0, changePct = Math.abs(q.dp||0);
      const isUp = change >= 0;
      let color = isUp ? (changePct>3?0x00ff00:0x2ecc71) : (changePct>3?0xff0000:0xe74c3c);
      const signal = changePct>3?(isUp?'🚀 זינוק חזק!':'💥 נפילה חדה!'):changePct>1?(isUp?'📈 עלייה':'📉 ירידה'):'😐 יציב';
      const rangePos = Math.min(100,Math.max(0,((price-q.l)/(q.h-q.l||1))*100));
      const bar = '█'.repeat(Math.round(rangePos/10))+'░'.repeat(10-Math.round(rangePos/10));
      const sentText = sent?.sentiment ? `🐂 ${(sent.sentiment.bullishPercent*100).toFixed(0)}% | 🐻 ${(sent.sentiment.bearishPercent*100).toFixed(0)}%` : 'N/A';
      const whyMoved = news?.length ? news.map((n:any)=>`• ${n.headline?.slice(0,80)||''}`).join('\n') : 'אין חדשות';

      const e = new EmbedBuilder()
        .setTitle(`${isUp?'🟢':'🔴'} **${symbol}** ${signal}`)
        .setColor(color)
        .setDescription(`> **${p?.name||symbol}** | ${p?.exchange||''} | ${p?.finnhubIndustry||''}`)
        .setThumbnail(p?.logo||null)
        .addFields(
          {name:'💵 מחיר', value:`# $${price.toFixed(2)}`, inline:true},
          {name:`${isUp?'📈':'📉'} שינוי`, value:`**${isUp?'+':''}${change.toFixed(2)}** (${isUp?'+':''}${changePct.toFixed(2)}%)`, inline:true},
          {name:'📅 אתמול', value:`$${q.pc?.toFixed(2)||'N/A'}`, inline:true},
          {name:'📊 טווח יומי', value:`\`${bar}\` ${rangePos.toFixed(0)}%\n⬇️$${q.l?.toFixed(2)} ——— ⬆️$${q.h?.toFixed(2)}`, inline:false},
          {name:'🧠 סנטימנט', value:sentText, inline:true},
          {name:'📰 חדשות', value:whyMoved.slice(0,400), inline:false},
        )
        .setFooter({text:`עדכון: ${new Date().toLocaleTimeString('he-IL')}`})
        .setTimestamp();

      const refreshBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_refresh_${symbol}`).setLabel('🔄 רענן').setStyle(ButtonStyle.Primary),
      );
      return interaction.editReply({embeds:[e], components:[refreshBtn]});
    } catch(e:any) {
      return interaction.editReply({content:`שגיאה: ${e.message}`});
    }
  }

  if (customId === 'ticket_close') {
    const closeEmbed = new EmbedBuilder()
      .setTitle('🔒 הטיקט נסגר')
      .setDescription(`נסגר על ידי **${user.username}**\nהערוץ ימחק תוך 5 שניות...`)
      .setColor(0xff6b35).setTimestamp();
    await interaction.reply({embeds:[closeEmbed]});
    setTimeout(()=>interaction.channel?.delete('Ticket closed').catch(()=>{}),5000);
  }

  if (customId === 'ticket_claim') {
    const member = interaction.member;
    await interaction.channel?.permissionOverwrites?.edit(user.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,ManageChannels:true});
    return interaction.reply({embeds:[new EmbedBuilder().setTitle('✋ טיקט נלקח').setDescription(`<@${user.id}> לקח את הטיקט הזה`).setColor(0x57F287)], ephemeral:false});
  }
});

// ─── New member join → send to verify channel ─────────────────────────────────
client.on('guildMemberAdd', async (member: any) => {
  const cfg = verifyConfig[member.guild?.id];
  if (!cfg) return;
  const verifyChannel = member.guild?.channels?.cache?.get(cfg.channelId);
  if (!verifyChannel) return;
  const e = new EmbedBuilder()
    .setTitle('👋 חבר חדש הצטרף!')
    .setDescription(`ברוך הבא **${member.user.username}**! 🎉\nכדי לקבל גישה לשרת — לחץ על כפתור האימות למעלה 👆`)
    .setColor(0x5865f2)
    .setThumbnail(member.user.displayAvatarURL({size:256}))
    .setFooter({text:'Bot by Yaniv 🚀'})
    .setTimestamp();
  verifyChannel.send({content:`<@${member.id}>`, embeds:[e]}).catch(()=>{});
});

// ─── Message handler (AFK + AI mentions) ──────────────────────────────────────
client.on('messageCreate', async (message: any) => {
  if (message.author.bot) return;

  // AFK
  if (afkUsers[message.author.id]) {
    delete afkUsers[message.author.id];
    message.reply(`👋 ברוך שובך **${message.author.username}**! הוסר מצב AFK.`).catch(()=>{});
  }
  for (const mention of message.mentions?.users?.values()||[]) {
    if (afkUsers[mention.id]) {
      message.reply(`💤 **${mention.username}** כרגע AFK: ${afkUsers[mention.id]}`).catch(()=>{});
    }
  }

});

client.login(TOKEN);
console.log('🎮 Discord Bot by Yaniv v3.0 מתחבר...');

export default client;
// groq-sdk force redeploy Sat Jun 20 11:28:36 UTC 2026
