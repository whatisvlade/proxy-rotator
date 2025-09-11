// server.js
const express = require('express');
const http = require('http');
const net = require('net');
const { URL } = require('url');

const app = express();
app.use(express.json());

// --- Конфиг пользователей (Basic-авторизация к твоему Railway-прокси) ---
const users = { client1: 'pass123', client2: 'pass456' };

// --- Прокси-списки (апстримы) ---
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

// --- Состояние ротации ---
const currentProxies = {
  client1: [...client1Proxies],
  client2: [...client2Proxies]
};
let rotationCounters = { client1: 0, client2: 0 };

// --- Активные HTTPS-туннели (CONNECT) по пользователю ---
const activeTunnels = {
  client1: new Set(), // элементы: { clientSocket, proxySocket }
  client2: new Set()
};

function closeUserTunnels(username) {
  const set = activeTunnels[username];
  if (!set) return 0;
  let closed = 0;
  for (const pair of set) {
    try { pair.clientSocket.destroy(); } catch {}
    try { pair.proxySocket.destroy(); } catch {}
    closed++;
  }
  set.clear();
  return closed;
}

// --- Утилиты ---
function parseProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10),
      username: url.username,
      password: url.password
    };
  } catch { return null; }
}

function getCurrentProxy(username) {
  const proxies = currentProxies[username];
  if (!proxies || proxies.length === 0) return null;
  return proxies[0];
}

function rotateProxy(username) {
  const proxies = currentProxies[username];
  if (!proxies || proxies.length <= 1) return getCurrentProxy(username);

  const oldProxy = proxies.shift();
  proxies.push(oldProxy);
  rotationCounters[username]++;

  const newProxy = getCurrentProxy(username);
  const oldIP = oldProxy.split('@')[1];
  const newIP = newProxy.split('@')[1];
  console.log(`🔄 MANUAL ROTATION ${username}: ${oldIP} -> ${newIP} (count: ${rotationCounters[username]})`);
  return newProxy;
}

function authenticate(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  try {
    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    if (users[username] && users[username] === password) return username;
  } catch {}
  return null;
}

// --- Мелкая оптимизация API: закрывать keep-alive, чтобы клиенты не держали соединения ---
app.use((req, res, next) => {
  res.setHeader('Connection', 'close');
  next();
});

// --- API ---
app.post('/rotate', (req, res) => {
  const username = authenticate(req.headers['authorization']);
  if (!username) return res.status(401).json({ error: 'Unauthorized' });

  const oldProxy = getCurrentProxy(username);
  const newProxy = rotateProxy(username);

  // ВАЖНО: разрываем активные CONNECT-туннели пользователя,
  // чтобы клиент сразу переподключился к новому апстриму
  const killed = closeUserTunnels(username);

  res.json({
    success: true,
    message: 'Proxy rotated manually',
    oldProxy: oldProxy?.split('@')[1],
    newProxy: newProxy?.split('@')[1],
    rotationCount: rotationCounters[username],
    totalProxies: currentProxies[username].length,
    closedTunnels: killed
  });
});

app.get('/current', (req, res) => {
  const username = authenticate(req.headers['authorization']);
  if (!username) return res.status(401).json({ error: 'Unauthorized' });

  const currentProxy = getCurrentProxy(username);

  res.json({
    user: username,
    currentProxy: currentProxy?.split('@')[1],
    fullProxy: currentProxy,
    totalProxies: currentProxies[username].length,
    rotationCount: rotationCounters[username]
  });
});

app.get('/status', (req, res) => {
  const railwayUrl =
    process.env.RAILWAY_STATIC_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    'tramway.proxy.rlwy.net:49452'; // для TCP Proxy показываем внешний host:port

  res.json({
    status: 'running',
    platform: 'Railway',
    port: PORT,
    url: `http://${railwayUrl}`,
    rotationType: 'Manual (via /rotate)',
    clients: {
      client1: {
        totalProxies: client1Proxies.length,
        currentProxy: getCurrentProxy('client1')?.split('@')[1],
        rotationCount: rotationCounters['client1'],
        activeTunnels: activeTunnels.client1.size
      },
      client2: {
        totalProxies: client2Proxies.length,
        currentProxy: getCurrentProxy('client2')?.split('@')[1],
        rotationCount: rotationCounters['client2'],
        activeTunnels: activeTunnels.client2.size
      }
    },
    timestamp: new Date().toISOString()
  });
});

// --- Главная страница (под TCP Proxy) ---
app.get('/', (req, res) => {
  const publicHost = 'tramway.proxy.rlwy.net';
  const publicPort = '49452';
  res.send(`
    <h1>🚀 Railway Proxy Rotator (Manual)</h1>
    <h2>📋 Настройки клиента (TCP Proxy):</h2>
    <pre>
Хост: ${publicHost}
Порт: ${publicPort}
Тип: HTTP/HTTPS Proxy (с Basic auth)
Логин: client1 или client2
Пароль: pass123 или pass456
    </pre>

    <h2>🔄 Ротация: ТОЛЬКО по кнопке/Tampermonkey или POST /rotate</h2>
    <p><strong>После /rotate</strong> сервер разрывает активные HTTPS-туннели пользователя — новые соединения сразу пойдут через новый апстрим-прокси.</p>

    <h2>📊 Текущие прокси:</h2>
    <ul>
      <li><strong>client1:</strong> ${getCurrentProxy('client1')?.split('@')[1] || 'N/A'}
          (ротаций: ${rotationCounters['client1']}, активных туннелей: ${activeTunnels.client1.size})</li>
      <li><strong>client2:</strong> ${getCurrentProxy('client2')?.split('@')[1] || 'N/A'}
          (ротаций: ${rotationCounters['client2']}, активных туннелей: ${activeTunnels.client2.size})</li>
    </ul>

    <h2>📡 API:</h2>
    <ul>
      <li><a href="/status">GET /status</a> — статус сервера</li>
      <li>POST /rotate — смена прокси (Basic auth: client1/pass123 или client2/pass456)</li>
      <li>GET /current — текущий прокси (для авторизованного пользователя)</li>
    </ul>

    <p><strong>Статус:</strong> ✅ Сервер на порту ${PORT}</p>
    <p><strong>Время:</strong> ${new Date().toLocaleString()}</p>
  `);
});

// --- HTTP-сервер как прямой/прозрачный прокси для клиентов ---
const server = http.createServer();

// Проксирование обычных HTTP-запросов (не CONNECT)
server.on('request', (req, res) => {
  // Отдаём API через Express
  if (req.url === '/' || req.url.startsWith('/rotate') || req.url.startsWith('/current') || req.url.startsWith('/status')) {
    return app(req, res);
  }

  // Дальше — прокси логика
  const username = authenticate(req.headers['proxy-authorization']);
  if (!username) {
    res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="Proxy"' });
    return res.end('407 Proxy Authentication Required');
  }

  const proxyUrl = getCurrentProxy(username);
  if (!proxyUrl) {
    res.writeHead(502);
    return res.end('502 Bad Gateway - No proxy available');
  }

  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) {
    res.writeHead(502);
    return res.end('502 Bad Gateway - Invalid proxy');
  }

  console.log(`HTTP: ${username} -> ${proxy.host}:${proxy.port} -> ${req.url}`);

  const options = {
    hostname: proxy.host,
    port: proxy.port,
    path: req.url,            // для апстрим-прокси путь — это полный URL
    method: req.method,
    headers: {
      ...req.headers,
      'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`,
      'Connection': 'close'   // чтобы клиент не держал keep-alive к нам на API/HTTP
    },
    timeout: 20000
  };

  // Мы уже аутентифицировали клиента — его заголовок к нам убираем
  delete options.headers['proxy-authorization'];

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Upstream timeout'));
  });

  proxyReq.on('error', (err) => {
    console.error(`HTTP Proxy error for ${username}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end('502 Bad Gateway - Proxy error');
    }
  });

  req.pipe(proxyReq);
});

// CONNECT-туннели для HTTPS
server.on('connect', (req, clientSocket, head) => {
  const username = authenticate(req.headers['proxy-authorization']);
  if (!username) {
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Proxy"\r\n\r\n');
    return clientSocket.end();
  }

  const proxyUrl = getCurrentProxy(username);
  if (!proxyUrl) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    return clientSocket.end();
  }

  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    return clientSocket.end();
  }

  console.log(`CONNECT: ${username} -> ${proxy.host}:${proxy.port} -> ${req.url}`);

  const proxySocket = net.createConnection(proxy.port, proxy.host);

  // Регистрируем пару сокетов для управления (чтобы уметь разорвать при /rotate)
  const pair = { clientSocket, proxySocket };
  activeTunnels[username]?.add(pair);

  // Таймауты на всякий случай
  proxySocket.setTimeout(30000, () => proxySocket.destroy(new Error('proxySocket timeout')));
  clientSocket.setTimeout(30000, () => clientSocket.destroy(new Error('clientSocket timeout')));

  proxySocket.on('connect', () => {
    const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
    const connectReq =
      `CONNECT ${req.url} HTTP/1.1\r\n` +
      `Host: ${req.url}\r\n` +
      `Proxy-Authorization: Basic ${auth}\r\n` +
      `Connection: keep-alive\r\n\r\n`;
    proxySocket.write(connectReq);
  });

  let connected = false;
  proxySocket.on('data', (data) => {
    if (!connected) {
      const response = data.toString('utf8');
      if (/^HTTP\/1\.[01]\s+200/i.test(response)) {
        connected = true;
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        // Двусторонняя прокачка
        clientSocket.pipe(proxySocket);
        proxySocket.pipe(clientSocket);
      } else {
        console.error(`CONNECT failed for ${username}: ${response.split('\r\n')[0]}`);
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        clientSocket.end();
        proxySocket.end();
      }
    }
  });

  function cleanup() {
    activeTunnels[username]?.delete(pair);
  }

  proxySocket.on('close', cleanup);
  clientSocket.on('close', cleanup);

  proxySocket.on('error', (err) => {
    console.error(`CONNECT proxySocket error for ${username}:`, err.message);
    try { clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch {}
    clientSocket.end();
  });

  clientSocket.on('error', () => {
    try { proxySocket.destroy(); } catch {}
  });
});

// --- Запуск ---
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 8000;
// Railway TCP Proxy пробрасывает внешний порт (например, 49452) на этот внутренний PORT.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Railway Proxy server running on port ${PORT}`);
  console.log(`🌐 External (TCP Proxy): tramway.proxy.rlwy.net:49452`);
  console.log(`📊 Client1: ${client1Proxies.length} proxies, current: ${getCurrentProxy('client1')?.split('@')[1]}`);
  console.log(`📊 Client2: ${client2Proxies.length} proxies, current: ${getCurrentProxy('client2')?.split('@')[1]}`);
  console.log(`🔄 Rotation: Manual via /rotate (tunnels will be closed automatically)`);
});
