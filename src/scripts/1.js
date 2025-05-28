import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  console.log('🔍 Verificando conectividad del servidor...');
  
  // Probar diferentes formas de acceder al servidor
  const endpoints = [
    'http://localhost:3069/api',
    'http://127.0.0.1:3069/api',
    'http://[::1]:3069/api'  // IPv6 localhost
  ];
  
  let workingEndpoint = null;
  
  for (const endpoint of endpoints) {
    console.log(`🔗 Probando: ${endpoint}`);
    
    try {
      const res = http.get(endpoint, { timeout: '5s' });
      
      if (res.status === 200) {
        console.log(`✅ ${endpoint} - FUNCIONA (Status: ${res.status})`);
        workingEndpoint = endpoint;
        break;
      } else {
        console.log(`❌ ${endpoint} - Status: ${res.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
  
  if (!workingEndpoint) {
    console.error('❌ ¡Ningún endpoint funciona! Verifica que el servidor esté ejecutándose.');
    return;
  }
  
  console.log(`🎯 Usando endpoint: ${workingEndpoint}`);
  
  // Usar el endpoint que funciona para las pruebas
  const baseUrl = workingEndpoint.replace('/api', '');
  
  // 1. Verificar que la API base responda
  const baseRes = http.get(`${baseUrl}/api`);
  const baseCheck = check(baseRes, {
    'API base responde': (r) => r.status === 200,
    'API base response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  if (!baseCheck) {
    console.error(`❌ Error: El servidor no responde en ${baseUrl}/api`);
    console.error(`Status: ${baseRes.status}, Body: ${baseRes.body}`);
    return;
  }

  console.log('✅ Servidor base respondiendo correctamente');

  // 2. Verificar endpoint de login con credenciales de prueba
  console.log('🔍 Verificando endpoint de login...');
  
  const loginPayload = JSON.stringify({
    usuario: "rcruz",
    contraseña: "70162216"
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginRes = http.post(`${baseUrl}/api/login/login`, loginPayload, loginParams);
  
  const loginCheck = check(loginRes, {
    'Login endpoint responde': (r) => r.status === 200 || r.status === 401,
    'Login response time < 2000ms': (r) => r.timings.duration < 2000,
    'Login tiene response body': (r) => r.body && r.body.length > 0,
  });

  if (loginRes.status === 200) {
    console.log('✅ Login endpoint funcionando - credenciales válidas');
    
    try {
      const loginBody = loginRes.json();
      if (loginBody.token) {
        console.log('✅ Token JWT generado correctamente');
        
        // 3. Verificar endpoint de verificación de token
        const verifyRes = http.get(`${baseUrl}/api/login/verify-token`, {
          headers: {
            'Authorization': `Bearer ${loginBody.token}`,
          },
        });
        
        check(verifyRes, {
          'Verify token endpoint responde': (r) => r.status === 200,
          'Token es válido': (r) => {
            try {
              const body = r.json();
              return body && body.valid === true;
            } catch (e) {
              return false;
            }
          },
        });
        
        console.log('✅ Endpoint de verificación de token funcionando');
      }
    } catch (e) {
      console.error('❌ Error parseando respuesta de login:', e.message);
    }
  } else if (loginRes.status === 401) {
    console.log('⚠️  Login endpoint responde pero credenciales inválidas (normal)');
  } else {
    console.error(`❌ Login endpoint retorna status inesperado: ${loginRes.status}`);
    console.error(`Response: ${loginRes.body}`);
  }

  console.log(`🎯 Verificación completada. Usa ${baseUrl} para las pruebas de carga.`);
}