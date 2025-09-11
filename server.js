const express = require('express');
const http = require('http');
const net = require('net');
const { URL } = require('url');

const app = express();
app.use(express.json());

// Прокси для клиента 1
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

// Прокси для клиента 2
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

// Пользователи
const users = {
  'client1': 'pass123',
  'client2': 'pass456'
};

// Текущие прокси
const currentProxies = {
  'client1': [...client1Proxies],
  'client2': [...client2Proxies]
};

// Парсинг прокси URL
function parseProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: url.password
    };
  } catch (e) {
    return null;
  }
}

// Получить текущий прокси
function getCurrentProxy(username) {
  const proxies = currentProxies[username];
  return proxies && proxies.length > 0 ? proxies[0] : null;
}

// Сменить прокси
function rotateProxy(username) {
  const proxies = currentProxies[username];
  if (proxies && proxies.length > 1) {
    const first = proxies.shift();
    proxies.push(first);
  }
  return getCurrentProxy(username);
}

// Проверка авторизации
function authenticate(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }

  try {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];

    if (users[username] && users[username] === password) {
      return username;
    }
  } catch (e) {
    // ignore
  }
  
  return null;
}

// API endpoints
app.post('/rotate', (req, res) => {
  const username = authenticate(req.headers['authorization']);
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const oldProxy = getCurrentProxy(username);
  const newProxy = rotateProxy(username);
  
  res.json({
    success: true,
    oldProxy: oldProxy,
    newProxy: newProxy
  });
});

app.get('/current', (req, res) => {
  const username = authenticate(req.headers['authorization']);
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({
    user: username,
    currentProxy: getCurrentProxy(username),
    totalProxies: currentProxies[username].length
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    clients: {
      client1: { totalProxies: client1Proxies.length, currentProxy: getCurrentProxy('client1') },
      client2: { totalProxies: client2Proxies.length, currentProxy: getCurrentProxy('client2') }
    }
  });
});

// Создаем сервер
const server = http.createServer();

// Обработка HTTP запросов
server.on('request', (req, res) => {
  // API запросы
  if (req.url.startsWith('/rotate') || req.url.startsWith('/current') || req.url.startsWith('/status')) {
    return app(req, res);
  }

  // Проверяем авторизацию
  const username = authenticate(req.headers['proxy-authorization']);
  if (!username) {
    res.writeHead(407, {
      'Proxy-Authenticate': 'Basic realm="Proxy"'
    });
    res.end();
    return;
  }

  // Получаем прокси
  const proxyUrl = getCurrentProxy(username);
  if (!proxyUrl) {
    res.writeHead(502);
    res.end('Bad Gateway');
    return;
  }

  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) {
    res.writeHead(502);
    res.end('Bad Gateway');
    return;
  }

  console.log(`${username} -> ${proxy.host}:${proxy.port} -> ${req.url}`);

  // Создаем запрос к прокси
  const options = {
    hostname: proxy.host,
    port: proxy.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`
    }
  };

  delete options.headers['proxy-authorization'];

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

// Обработка CONNECT (HTTPS)
server.on('connect', (req, clientSocket, head) => {
  const username = authenticate(req.headers['proxy-authorization']);
  if (!username) {
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\n' +
                      'Proxy-Authenticate: Basic realm="Proxy"\r\n' +
                      '\r\n');
    clientSocket.end();
    return;
  }

  const proxyUrl = getCurrentProxy(username);
  if (!proxyUrl) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.end();
    return;
  }

  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.end();
    return;
  }

  console.log(`${username} CONNECT -> ${proxy.host}:${proxy.port} -> ${req.url}`);

  // Подключаемся к прокси
  const proxySocket = net.createConnection(proxy.port, proxy.host);

  proxySocket.on('connect', () => {
    // Отправляем CONNECT запрос
    const connectReq = `CONNECT ${req.url} HTTP/1.1\r\n` +
                      `Host: ${req.url}\r\n` +
                      `Proxy-Authorization: Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}\r\n` +
                      '\r\n';
    
    proxySocket.write(connectReq);
  });

  let connected = false;
  proxySocket.on('data', (data) => {
    if (!connected) {
      const response = data.toString();
      if (response.includes('200')) {
        connected = true;
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        
        // Туннелируем данные
        clientSocket.pipe(proxySocket);
        proxySocket.pipe(clientSocket);
      } else {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        clientSocket.end();
      }
    }
  });

  proxySocket.on('error', (err) => {
    console.error('Proxy socket error:', err);
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.end();
  });

  clientSocket.on('error', () => {
    proxySocket.destroy();
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Client1: ${client1Proxies.length} proxies`);
  console.log(`Client2: ${client2Proxies.length} proxies`);
});
