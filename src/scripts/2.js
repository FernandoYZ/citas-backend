import http from 'k6/http';
import { sleep, check } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./users.json')).users;
});

// ⚠️ IMPORTANTE: Tu servidor funciona con IPv6
const BASE_URL = 'http://[::1]:3069';

export const options = {
  scenarios: {
    // Escenario 1: Rampa gradual para 2000 usuarios
    stress_test: {
      executor: 'ramping-vus',
      stages: [
        // Calentamiento muy gradual
        { duration: '2m', target: 100 },    // 0-100 usuarios en 2min
        { duration: '3m', target: 500 },    // 100-500 usuarios en 3min
        { duration: '5m', target: 1000 },   // 500-1000 usuarios en 5min
        { duration: '5m', target: 1500 },   // 1000-1500 usuarios en 5min
        { duration: '5m', target: 2000 },   // 1500-2000 usuarios en 5min
        
        // Mantener carga máxima
        { duration: '10m', target: 2000 },  // Mantener 2000 usuarios por 10min
        
        // Reducción gradual
        { duration: '3m', target: 1000 },   // Reducir a 1000
        { duration: '2m', target: 0 },      // Reducir a 0
      ],
      gracefulRampDown: '1m',
      gracefulStop: '30s',
    }
  },
  
  thresholds: {
    // Umbrales más realistas para 2000 usuarios concurrentes
    'http_req_duration{scenario:stress_test}': [
      'p(50)<1000',   // 50% de peticiones bajo 1s
      'p(90)<3000',   // 90% de peticiones bajo 3s
      'p(95)<5000',   // 95% de peticiones bajo 5s
      'p(99)<10000',  // 99% de peticiones bajo 10s
    ],
    'http_req_failed': ['rate<0.05'],  // Máximo 5% de fallos
    'http_reqs': ['rate>100'],         // Mínimo 100 req/s en promedio
    
    // Umbrales específicos por tipo de petición
    'http_req_duration{name:login}': ['p(95)<3000'],
    'http_req_duration{name:verify}': ['p(95)<1000'],
  },
  
  // Configuraciones para manejar alta concurrencia
  noConnectionReuse: false,
  userAgent: 'k6-load-test/1.0',
  insecureSkipTLSVerify: true,
  
  // Configurar timeouts para alta carga
  httpDebug: 'full',
};

// Función para distribuir la carga de manera más inteligente
function getRandomDelay() {
  // Distribución no uniforme para simular comportamiento real
  const rand = Math.random();
  if (rand < 0.6) return Math.random() * 0.5;      // 60% con delay corto
  if (rand < 0.9) return 0.5 + Math.random() * 2;  // 30% con delay medio
  return 2.5 + Math.random() * 3;                  // 10% con delay largo
}

// Pool de usuarios para mejor distribución
function getRandomUser() {
  return users[Math.floor(Math.random() * users.length)];
}

export default function () {
  const user = getRandomUser();
  const startTime = Date.now();

  // Configuración de petición optimizada para alta concurrencia
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
      'Accept': 'application/json',
    },
    timeout: '30s',
    tags: { name: 'login' }  // Tag para métricas específicas
  };

  const payload = JSON.stringify({
    usuario: user.username,
    contraseña: user.password,
  });

  // Petición de login con manejo de errores mejorado
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  
  // Verificaciones más detalladas
  const loginChecks = check(loginResponse, {
    'login: status is 200': (r) => r.status === 200,
    'login: response time OK': (r) => r.timings.duration < 5000,
    'login: has response body': (r) => r.body && r.body.length > 0,
    'login: content type is JSON': (r) => 
      r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
    'login: has token in response': (r) => {
      try {
        const body = r.json();
        return body && body.token && body.token.length > 0;
      } catch (e) {
        // Solo logear errores críticos para no saturar logs
        if (r.status >= 500) {
          console.error(`Critical error for user ${user.username}: Status ${r.status}`);
        }
        return false;
      }
    },
  }, { name: 'login' });

  // Solo verificar token si el login fue exitoso
  if (loginChecks && loginResponse.status === 200) {
    try {
      const loginBody = loginResponse.json();
      
      if (loginBody && loginBody.token) {
        // Pequeña pausa antes de verificar token (simula comportamiento real)
        sleep(0.1 + Math.random() * 0.2);
        
        const verifyParams = {
          headers: {
            'Authorization': `Bearer ${loginBody.token}`,
            'Accept': 'application/json',
            'Connection': 'keep-alive',
          },
          timeout: '15s',
          tags: { name: 'verify' }
        };
        
        const verifyResponse = http.get(`${BASE_URL}/api/auth/verify`, verifyParams);
        
        check(verifyResponse, {
          'verify: status is 200': (r) => r.status === 200,
          'verify: response time OK': (r) => r.timings.duration < 2000,
          'verify: token is valid': (r) => {
            try {
              const body = r.json();
              return body && body.valid === true;
            } catch (e) {
              return false;
            }
          },
        }, { name: 'verify' });
      }
    } catch (e) {
      // Manejar errores de parsing silenciosamente
    }
  }

  // Pausa inteligente basada en el tiempo de respuesta
  const responseTime = Date.now() - startTime;
  let sleepTime = getRandomDelay();
  
  // Si la respuesta fue lenta, hacer una pausa más corta para no sobrecargar
  if (responseTime > 2000) {
    sleepTime = Math.min(sleepTime, 0.5);
  }
  
  // Añadir jitter para evitar sincronización
  sleepTime += (Math.random() - 0.5) * 0.2;
  
  sleep(Math.max(sleepTime, 0.1)); // Mínimo 100ms de pausa
}