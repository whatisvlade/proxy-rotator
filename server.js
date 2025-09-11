const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');
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

// Пользователи и пароли
const users = {
  'client1': 'pass123',
  'client2': 'pass456'
};

// Текущие прокси для каждого клиента
const currentProxies = {
  'client1': [...client1Proxies],
  'client2': [...client2Proxies]
};

// Функция парсинга прокси URL
function parseProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port),
      auth: url.username + ':' + url.password
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
function checkAuth(req, res, next) {
  const auth = req.headers['proxy-authorization'] || req.headers['authorization'];
  
  if (!auth) {
    res.writeHead(407, {
      'Proxy-Authenticate': 'Basic realm="Proxy"',
      'Content-Type': 'text/plain'
    });
    res.end('Proxy Authentication Required');
    return;
  }

  const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  const username = credentials[0];
  const password = credentials[1];

  if (!users[username] || users[username] !== password) {
    res.writeHead(407, {
      'Proxy-Authenticate': 'Basic realm="Proxy"',
      'Content-Type': 'text/plain'
    });
    res.end('Invalid credentials');
    return;
  }

  req.username = username;
  next();
}

// API для смены прокси
app.post('/rotate', basicAuth({ users: users }), (req, res) => {
  const username = req.auth.user;
  const newProxy = rotateProxy(username);
  
  console.log(`${username} сменил прокси на: ${newProxy}`);
  
  res.json({
    success: true,
    newProxy: newProxy,
    message: 'Прокси сменен'
  });
});

// API для получения текущего прокси
app.get('/current', basicAuth({ users: users }), (req, res) => {
  const username = req.auth.user;
  const proxy = getCurrentProxy(username);
  
  res.json({
    currentProxy: proxy,
    user: username
  });
});

// Создаем HTTP сервер для обработки прокси запросов
const server = http.createServer((req, res) => {
  // Обработка CONNECT запросов (HTTPS)
  if (req.method === 'CONNECT') {
    handleConnect(req, res);
    return;
  }

  // Обработка обычных HTTP запросов
  checkAuth(req, res, () => {
    const username = req.username;
    const proxyUrl = getCurrentProxy(username);
    
    if (!proxyUrl) {
      res.writeHead(500);
      res.end('No proxy available');
      return;
    }

    const proxyConfig = parseProxyUrl(proxyUrl);
    if (!proxyConfig) {
      res.writeHead(500);
      res.end('Invalid proxy configuration');
      return;
    }

    console.log(`${username} -> ${proxyUrl} -> ${req.url}`);

    // Создаем запрос к целевому прокси
    const options = {
      hostname: proxyConfig.host,
      port: proxyConfig.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        'Proxy-Authorization': `Basic ${Buffer.from(proxyConfig.auth).toString('base64')}`
      }
    };

    delete options.headers['authorization'];
    delete options.headers['proxy-authorization'];

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.writeHead(500);
      res.end('Proxy error');
    });

    req.pipe(proxyReq);
  });
});

// Обработка CONNECT запросов для HTTPS
function handleConnect(req, res) {
  checkAuth(req, res, () => {
    const username = req.username;
    const proxyUrl = getCurrentProxy(username);
    
    if (!proxyUrl) {
      res.writeHead(500);
      res.end('No proxy available');
      return;
    }

    const proxyConfig = parseProxyUrl(proxyUrl);
    if (!proxyConfig) {
      res.writeHead(500);
      res.end('Invalid proxy configuration');
      return;
    }

    console.log(`${username} CONNECT -> ${proxyUrl} -> ${req.url}`);

    // Подключаемся к прокси серверу
    const proxySocket = require('net').createConnection({
      host: proxyConfig.host,
      port: proxyConfig.port
    });

    proxySocket.on('connect', () => {
      // Отправляем CONNECT запрос к прокси
      const connectReq = `CONNECT ${req.url} HTTP/1.1\r\n` +
                        `Host: ${req.url}\r\n` +
                        `Proxy-Authorization: Basic ${Buffer.from(proxyConfig.auth).toString('base64')}\r\n` +
                        `\r\n`;
      
      proxySocket.write(connectReq);
    });

    proxySocket.on('data', (data) => {
      const response = data.toString();
      if (response.includes('200 Connection established')) {
        res.writeHead(200, 'Connection established');
        res.end();
        
        // Соединяем клиента с прокси
        req.socket.pipe(proxySocket);
        proxySocket.pipe(req.socket);
      } else {
        res.writeHead(500);
        res.end('Proxy connection failed');
      }
    });

    proxySocket.on('error', (err) => {
      console.error('Proxy socket error:', err);
      res.writeHead(500);
      res.end('Proxy connection error');
    });
  });
}

// Используем Express для API endpoints
server.on('request', (req, res) => {
  if (req.url.startsWith('/rotate') || req.url.startsWith('/current')) {
    app(req, res);
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log('Client1 proxies:', client1Proxies.length);
  console.log('Client2 proxies:', client2Proxies.length);
});
