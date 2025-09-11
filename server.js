const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

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

// Получить текущий прокси (первый в списке)
function getCurrentProxy(username) {
  const proxies = currentProxies[username];
  return proxies && proxies.length > 0 ? proxies[0] : null;
}

// Сменить прокси (первый в конец, взять новый первый)
function rotateProxy(username) {
  const proxies = currentProxies[username];
  if (proxies && proxies.length > 1) {
    const first = proxies.shift(); // Убираем первый
    proxies.push(first); // Добавляем в конец
  }
  return getCurrentProxy(username);
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

// Основной прокси
app.use('/', basicAuth({ users: users }), (req, res, next) => {
  const username = req.auth.user;
  const proxyUrl = getCurrentProxy(username);
  
  if (!proxyUrl) {
    return res.status(500).send('Нет прокси');
  }
  
  const proxy = createProxyMiddleware({
    target: proxyUrl,
    changeOrigin: true,
    onError: (err, req, res) => {
      res.status(500).send('Ошибка прокси');
    }
  });
  
  proxy(req, res, next);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Сервер на порту ${PORT}`);
  console.log('API endpoints:');
  console.log('POST /rotate - сменить прокси');
  console.log('GET /current - текущий прокси');
});
