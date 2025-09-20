// server.js — Railway Proxy (rotate only via /rotate)

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
  'http://2ue16J:pCgcm8@194.67.219.212:9391',
  'http://2ue16J:pCgcm8@194.67.221.184:9514',
  'http://2ue16J:pCgcm8@194.67.219.169:9060',
  'http://UoERJB:p6n6ns@193.31.100.119:9374',
  'http://UoERJB:p6n6ns@193.31.101.146:9400',
  'http://UoERJB:p6n6ns@193.31.101.7:9432',
  'http://UoERJB:p6n6ns@193.31.101.231:9641',
  'http://UoERJB:p6n6ns@193.31.100.36:9929',
  'http://UoERJB:p6n6ns@193.31.102.71:9403',
  'http://UoERJB:p6n6ns@193.31.103.239:9590',
  'http://UoERJB:p6n6ns@193.31.101.100:9334',
  'http://UoERJB:p6n6ns@193.31.101.221:9332',
  'http://UoERJB:p6n6ns@193.31.102.50:9114'
];

const client2Proxies = [
  'http://UoERJB:p6n6ns@193.31.102.65:9234',
  'http://UoERJB:p6n6ns@193.31.101.36:9594',
  'http://UoERJB:p6n6ns@193.31.101.106:9176',
  'http://UoERJB:p6n6ns@193.31.103.117:9560',
  'http://UoERJB:p6n6ns@193.31.102.207:9791',
  'http://UoERJB:p6n6ns@193.31.103.230:9089',
  'http://UoERJB:p6n6ns@193.31.103.211:9859',
  'http://UoERJB:p6n6ns@193.31.101.217:9861',
  'http://UoERJB:p6n6ns@193.31.100.100:9744',
  'http://UoERJB:p6n6ns@193.31.102.55:9283'
];

// ====== Состояние/ротация ======
const currentProxies = { client1: [...client1Proxies], client2: [...client2Proxies] };
let rotationCounters = { client1: 0, client2: 0 };

// Активные CONNECT-туннели (закрываем при /rotate)
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

// ====== «Свои» API-запросы (чтобы не проксировать их наружу) ======
const PUBLIC_HOST = (process.env.PUBLIC_HOST || 'tramway.proxy.rlwy.net:49452').toLowerCase();
const EXTRA_HOSTS = (process.env.EXTRA_HOSTS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const SELF_HOSTNAMES = new Set([
  PUBLIC_HOST.split(':')[0],
  ...EXTRA_HOSTS.map(h => h.split(':')[0]),
  ...(process.env.RAILWAY_STATIC_URL ? [String(process.env.RAILWAY_STATIC_URL).toLowerCase().split(':')[0]] : []),
  ...(process.env.RAILWAY_PUBLIC_DOMAIN ? [String(process.env.RAILWAY_PUBLIC_DOMAIN).toLowerCase().split(':')[0]] : [])
].filter(Boolean));

function isSelfApiRequest(req) {
  try {
    if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
      const u = new URL(req.url);
      if (SELF_HOSTNAMES.has(u.hostname.toLowerCase())) {
        const p = u.pathname;
        return p === '/' || p.startsWith('/status') || p.startsWith('/current') || p.startsWith('/rotate');
      }
    }
    const hostHeader = (req.headers.host || '').toLowerCase();
    const onlyHost = hostHeader.split(':')[0];
    if (SELF_HOSTNAMES.has(onlyHost)) {
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
    selfHostnames: [...SELF_HOSTNAMES],
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
Public host: ${PUBLIC_HOST}
Known hostnames: ${[...SELF_HOSTNAMES].join(', ')}

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

/**
 * ВАЖНО: дальше — версии без авто-ротации.
 * НИКАКОГО rotateProxy() в обработчиках сетевых ошибок и НИКАКИХ повторов.
 */

// -------- HTTP (origin/absolute-form) БЕЗ авто-ротации ----------
async function handleHttpProxy(req, res, user) {
  const up = parseProxyUrl(getCurrentProxy(user));
  if (!up) { res.writeHead(502); return res.end('502 No upstream'); }

  console.log(`HTTP: ${user} -> ${up.host}:${up.port} -> ${req.url}`);

  const options = {
    hostname: up.host,
    port: up.port,
    path: req.url,               // абсолютный URL для HTTP-прокси
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
    // НИКАКИХ повторов и rotateProxy здесь.
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Upstream timeout')));
  proxyReq.on('error', (err) => {
    console.error(`HTTP upstream error (${user}):`, err.message);
    if (!res.headersSent) res.writeHead(502);
    res.end('502 Bad Gateway - Proxy error');
  });

  req.pipe(proxyReq);
}

server.on('request', (req, res) => {
  if (isSelfApiRequest(req)) {
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

// -------- CONNECT (HTTPS) БЕЗ авто-ротации ----------
function tryConnect(req, clientSocket, user) {
  const up = parseProxyUrl(getCurrentProxy(user));
  if (!up) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    return clientSocket.end();
  }

  console.log(`CONNECT: ${user} -> ${up.host}:${up.port} -> ${req.url}`);
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
        // НИКАКОЙ rotateProxy здесь (просто 502)
        try { clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch {}
        clientSocket.end();
        proxySocket.end();
      }
    }
  });

  proxySocket.on('error', (err) => {
    console.error(`CONNECT upstream error (${user}):`, err.message);
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
  console.log(`✅ API self hostnames: ${[...SELF_HOSTNAMES].join(', ')}`);
  console.log(`📊 Client1: ${client1Proxies.length} proxies`);
  console.log(`📊 Client2: ${client2Proxies.length} proxies`);
});
