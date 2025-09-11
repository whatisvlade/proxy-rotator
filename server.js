// server.js (Railway TCP Proxy)
// Запускать так (по умолчанию хост уже задан):
//   PUBLIC_HOST=tramway.proxy.rlwy.net:49452 node server.js
// или просто: node server.js

const express = require('express');
const http = require('http');
const net = require('net');
const { URL } = require('url');

const app = express();
app.use(express.json());

// ====== Пользователи (Basic-auth к твоему прокси) ======
const users = { client1: 'pass123', client2: 'pass456' };

// ====== Апстрим-прокси списки ======
const client1Proxies = [
  'http://5NDcu6:EAZSkX@212.81.39.66:9401',
  'http://5NDcu6:EAZSkX@212.81.38.83:9925',
  'http://5NDcu6:EAZSkX@212.81.39.148:9560',
  'http://5NDcu6:EAZSkX@212.81.38.110:9488',
  'http://5NDcu6:EAZSkX@212.81.37.208:9353',
  'http://5NDcu6:EAZSkX@212.81.38.203:9541',
  'http://5NDcu6:EAZSkX@212.81.36.230:9752',
  'http://5NDcu6:EAZSkX@212.81.39.197:9982',
  'http://5NDcu6:EAZSkX@212.81.36.140:9419',
  'http://5NDcu6:EAZSkX@212.81.39.159:9466',
  'http://5NDcu6:EAZSkX@212.81.39.191:9277',
  'http://5NDcu6:EAZSkX@212.81.39.168:9460',
  'http://5NDcu6:EAZSkX@212.81.37.16:9290',
  'http://5NDcu6:EAZSkX@212.81.38.33:9541',
  'http://5NDcu6:EAZSkX@212.81.37.186:9716',
  'http://5NDcu6:EAZSkX@212.81.38.144:9994',
  'http://5NDcu6:EAZSkX@212.81.38.132:9674',
  'http://5NDcu6:EAZSkX@212.81.39.42:9528',
  'http://5NDcu6:EAZSkX@212.81.39.155:9926',
  'http://5NDcu6:EAZSkX@194.67.223.167:9988',
  'http://5NDcu6:EAZSkX@194.67.220.77:9907',
  'http://5NDcu6:EAZSkX@194.67.219.72:9725',
  'http://5NDcu6:EAZSkX@194.67.219.82:9400',
  'http://5NDcu6:EAZSkX@194.67.221.176:9241',
  'http://5NDcu6:EAZSkX@193.31.100.247:9275',
  'http://5NDcu6:EAZSkX@193.31.101.117:9649',
  'http://5NDcu6:EAZSkX@194.124.49.75:9492',
  'http://5NDcu6:EAZSkX@194.226.233.71:9841',
  'http://5NDcu6:EAZSkX@194.226.233.130:9235'
];

const client2Proxies = [
  'http://5NDcu6:EAZSkX@194.226.234.140:9860',
  'http://5NDcu6:EAZSkX@194.226.234.46:9174',
  'http://5NDcu6:EAZSkX@194.226.234.166:9036',
  'http://5NDcu6:EAZSkX@194.226.233.109:9686',
  'http://5NDcu6:EAZSkX@194.226.235.14:9681',
  'http://5NDcu6:EAZSkX@194.226.235.179:9449',
  'http://5NDcu6:EAZSkX@194.226.235.166:9820',
  'http://5NDcu6:EAZSkX@194.226.235.145:9138',
  'http://5NDcu6:EAZSkX@194.226.234.19:9952',
  'http://5NDcu6:EAZSkX@194.226.233.126:9670',
  'http://5NDcu6:EAZSkX@194.226.233.137:9114',
  'http://RFANYW:Ujk7cU@46.161.45.39:9920',
  'http://RFANYW:Ujk7cU@46.161.46.183:9037',
  'http://RFANYW:Ujk7cU@46.161.46.27:9074',
  'http://RFANYW:Ujk7cU@46.161.44.42:9349',
  'http://RFANYW:Ujk7cU@46.161.44.220:9945',
  'http://RFANYW:Ujk7cU@46.161.47.28:9823',
  'http://RFANYW:Ujk7cU@46.161.44.196:9466',
  'http://RFANYW:Ujk7cU@46.161.46.133:9593',
  'http://RFANYW:Ujk7cU@46.161.47.148:9601',
  'http://RFANYW:Ujk7cU@46.161.45.205:9044',
  'http://RFANYW:Ujk7cU@46.161.45.244:9521',
  'http://RFANYW:Ujk7cU@46.161.47.97:9360',
  'http://RFANYW:Ujk7cU@46.161.46.237:9249',
  'http://RFANYW:Ujk7cU@46.161.47.163:9094',
  'http://RFANYW:Ujk7cU@46.161.47.228:9926',
  'http://RFANYW:Ujk7cU@46.161.44.204:9892',
  'http://RFANYW:Ujk7cU@46.161.44.173:9081',
  'http://RFANYW:Ujk7cU@46.161.46.171:9121',
  'http://RFANYW:Ujk7cU@31.44.188.26:9910',
  'http://RFANYW:Ujk7cU@31.44.189.64:9878'
];

// ====== Состояние/ротация ======
const currentProxies = { client1: [...client1Proxies], client2: [...client2Proxies] };
let rotationCounters = { client1: 0, client2: 0 };

// Активные CONNECT-туннели (для «разрыва» после /rotate)
const activeTunnels = { client1: new Set(), client2: new Set() };
function closeUserTunnels(username) {
  const set = activeTunnels[username];
  if (!set) return 0;
  let n = 0;
  for (const pair of set) {
    try { pair.clientSocket.destroy(); } catch {}
    try { pair.proxySocket.destroy(); } catch {}
    n++;
  }
  set.clear();
  return n;
}

// ====== Хелперы ======
function parseProxyUrl(proxyUrl) {
  try {
    const u = new URL(proxyUrl);
    return { host: u.hostname, port: +u.port, username: u.username, password: u.password };
  } catch { return null; }
}
function getCurrentProxy(username) {
  const list = currentProxies[username];
  return (list && list[0]) || null;
}
function rotateProxy(username) {
  const list = currentProxies[username];
  if (!list || list.length <= 1) return getCurrentProxy(username);
  const oldProxy = list.shift();
  list.push(oldProxy);
  rotationCounters[username]++;
  const newProxy = list[0];
  console.log(`🔄 ROTATE ${username}: ${oldProxy.split('@')[1]} -> ${newProxy.split('@')[1]} (#${rotationCounters[username]})`);
  return newProxy;
}
function authenticate(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  try {
    const [u, p] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    return users[u] === p ? u : null;
  } catch { return null; }
}

// ====== Опознание «своих» API-запросов (absolute-form + Host) ======
const PUBLIC_HOST = (process.env.PUBLIC_HOST || 'tramway.proxy.rlwy.net:49452').toLowerCase();

function expandHostVariants(h) {
  if (!h) return [];
  const out = new Set();
  const low = h.toLowerCase();
  out.add(low);
  const [name, port] = low.split(':');
  if (name) {
    out.add(name);
    out.add(`${name}:443`);
    out.add(`${name}:80`);
    if (port) out.add(`${name}:${port}`);
  }
  return [...out];
}

const SELF_HOSTS = new Set([
  ...expandHostVariants(PUBLIC_HOST),
  ...expandHostVariants(process.env.RAILWAY_STATIC_URL || ''),
  ...expandHostVariants(process.env.RAILWAY_PUBLIC_DOMAIN || '')
].filter(Boolean));

function isSelfApiRequest(req) {
  try {
    // absolute-form
    if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
      const u = new URL(req.url);
      if (SELF_HOSTS.has(u.host.toLowerCase())) {
        const p = u.pathname;
        return p === '/' || p.startsWith('/status') || p.startsWith('/current') || p.startsWith('/rotate');
      }
    }
    // origin-form
    const host = (req.headers.host || '').toLowerCase();
    if (SELF_HOSTS.has(host)) {
      const p = (req.url || '').split('?')[0];
      return p === '/' || p.startsWith('/status') || p.startsWith('/current') || p.startsWith('/rotate');
    }
  } catch {}
  return false;
}

// Закрываем keep-alive на API
app.use((req, res, next) => { res.setHeader('Connection', 'close'); next(); });

// ====== API ======
app.post('/rotate', (req, res) => {
  const user = authenticate(req.headers['authorization']);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const oldProxy = getCurrentProxy(user);
  const newProxy = rotateProxy(user);
  const killed = closeUserTunnels(user);

  console.log(`[API] POST /rotate user=${user} killed=${killed} ${oldProxy?.split('@')[1]} -> ${newProxy?.split('@')[1]}`);

  res.json({
    success: true,
    message: 'Proxy rotated',
    oldProxy: oldProxy?.split('@')[1],
    newProxy: newProxy?.split('@')[1],
    rotationCount: rotationCounters[user],
    totalProxies: currentProxies[user].length,
    closedTunnels: killed
  });
});

app.get('/current', (req, res) => {
  const user = authenticate(req.headers['authorization']);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const cur = getCurrentProxy(user);

  console.log(`[API] GET /current user=${user} -> ${cur?.split('@')[1]}`);

  res.json({
    user,
    currentProxy: cur?.split('@')[1],
    fullProxy: cur,
    totalProxies: currentProxies[user].length,
    rotationCount: rotationCounters[user],
    activeTunnels: activeTunnels[user].size
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    platform: 'Railway TCP Proxy',
    port: PORT,
    publicHost: PUBLIC_HOST,
    clients: {
      client1: {
        totalProxies: client1Proxies.length,
        currentProxy: getCurrentProxy('client1')?.split('@')[1],
        rotationCount: rotationCounters.client1,
        activeTunnels: activeTunnels.client1.size
      },
      client2: {
        totalProxies: client2Proxies.length,
        currentProxy: getCurrentProxy('client2')?.split('@')[1],
        rotationCount: rotationCounters.client2,
        activeTunnels: activeTunnels.client2.size
      }
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Railway Proxy Rotator</h1>
    <pre>
Host: ${PUBLIC_HOST.split(':')[0]}
Port: ${PUBLIC_HOST.split(':')[1] || '80/443'}
Auth: Basic (client1/pass123 или client2/pass456)
    </pre>
    <ul>
      <li>GET /status</li>
      <li>GET /current (requires Basic)</li>
      <li>POST /rotate (requires Basic)</li>
    </ul>
    <p>После /rotate сервер разрывает активные CONNECT-туннели пользователя.</p>
  `);
});

// ====== Прокси-сервер ======
const server = http.createServer();

// -------- HTTP (origin/absolute-form) c авто-фейловером ----------
async function handleHttpProxy(req, res, user, attempt = 1, maxAttempts = 2) {
  const up = parseProxyUrl(getCurrentProxy(user));
  if (!up) { res.writeHead(502); return res.end('502 No upstream'); }

  console.log(`HTTP[try ${attempt}/${maxAttempts}]: ${user} -> ${up.host}:${up.port} -> ${req.url}`);

  const options = {
    hostname: up.host,
    port: up.port,
    path: req.url,               // для HTTP-прокси — абсолютный URL
    method: req.method,
    headers: {
      ...req.headers,
      'Proxy-Authorization': `Basic ${Buffer.from(`${up.username}:${up.password}`).toString('base64')}`,
      'Connection': 'close'
    },
    timeout: 20000
  };
  delete options.headers['proxy-authorization'];

  const proxyReq = http.request(options, (proxyRes) => {
    if ([407, 502, 503].includes(proxyRes.statusCode) && attempt < maxAttempts) {
      proxyRes.resume();
      rotateProxy(user);
      return handleHttpProxy(req, res, user, attempt + 1, maxAttempts);
    }
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Upstream timeout')));
  proxyReq.on('error', (err) => {
    console.error(`HTTP upstream error (${user}):`, err.message);
    if (attempt < maxAttempts) {
      rotateProxy(user);
      return handleHttpProxy(req, res, user, attempt + 1, maxAttempts);
    }
    if (!res.headersSent) res.writeHead(502);
    res.end('502 Bad Gateway - Proxy error');
  });

  req.pipe(proxyReq);
}

server.on('request', (req, res) => {
  if (isSelfApiRequest(req)) {
    // чтобы в логах было видно, что API схватили локально
    const host = req.headers.host || '(no-host)';
    console.log(`[SELF-API] ${req.method} ${req.url} Host:${host}`);
    return app(req, res);
  }

  const user = authenticate(req.headers['proxy-authorization']);
  if (!user) {
    res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="Proxy"' });
    return res.end('407 Proxy Authentication Required');
  }

  handleHttpProxy(req, res, user);
});

// -------- CONNECT (HTTPS) c авто-фейловером ----------
function tryConnect(req, clientSocket, user, attempt = 1, maxAttempts = 2) {
  const upUrl = getCurrentProxy(user);
  const up = parseProxyUrl(upUrl);
  if (!up) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    return clientSocket.end();
  }

  console.log(`CONNECT[try ${attempt}/${maxAttempts}]: ${user} -> ${up.host}:${up.port} -> ${req.url}`);
  const proxySocket = net.createConnection(up.port, up.host);

  const pair = { clientSocket, proxySocket };
  activeTunnels[user]?.add(pair);

  const cleanup = () => activeTunnels[user]?.delete(pair);
  proxySocket.on('close', cleanup);
  clientSocket.on('close', cleanup);

  proxySocket.setTimeout(30000, () => proxySocket.destroy(new Error('upstream timeout')));
  clientSocket.setTimeout(30000, () => clientSocket.destroy(new Error('client timeout')));

  proxySocket.on('connect', () => {
    const auth = Buffer.from(`${up.username}:${up.password}`).toString('base64');
    const connectReq =
      `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: Basic ${auth}\r\n\r\n`;
    proxySocket.write(connectReq);
  });

  let established = false;
  proxySocket.on('data', (data) => {
    if (!established) {
      const line = data.toString('utf8').split('\r\n')[0];
      if (/^HTTP\/1\.[01]\s+200/i.test(line)) {
        established = true;
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        clientSocket.pipe(proxySocket);
        proxySocket.pipe(clientSocket);
      } else {
        proxySocket.end();
        if (attempt < maxAttempts) {
          rotateProxy(user);
          return tryConnect(req, clientSocket, user, attempt + 1, maxAttempts);
        }
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        clientSocket.end();
      }
    }
  });

  proxySocket.on('error', (err) => {
    console.error(`CONNECT upstream error (${user}):`, err.message);
    if (attempt < maxAttempts && !clientSocket.destroyed) {
      rotateProxy(user);
      return tryConnect(req, clientSocket, user, attempt + 1, maxAttempts);
    }
    try { clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch {}
    clientSocket.end();
  });

  clientSocket.on('error', () => { try { proxySocket.destroy(); } catch {} });
}

server.on('connect', (req, clientSocket) => {
  const user = authenticate(req.headers['proxy-authorization']);
  if (!user) {
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Proxy"\r\n\r\n');
    return clientSocket.end();
  }
  tryConnect(req, clientSocket, user);
});

// ====== Запуск ======
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`🌐 Public (TCP Proxy): ${PUBLIC_HOST}`);
  console.log(`📊 Client1: ${client1Proxies.length} proxies`);
  console.log(`📊 Client2: ${client2Proxies.length} proxies`);
  console.log(`✅ API self-hosts:`, [...SELF_HOSTS].join(', '));
});
