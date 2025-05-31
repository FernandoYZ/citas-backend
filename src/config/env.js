import 'dotenv/config';
import Joi from 'joi';

const schema = Joi.object({
  HOST: Joi.string().default('localhost'),
  PORT: Joi.number().default(3055),
  NODE_ENV: Joi.string().valid('dev', 'production', 'test').default('dev'),
  TZ: Joi.string().default('America/Lima'),

  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SERVER: Joi.string().required(),
  DB_DATABASE_PRINCIPAL: Joi.string().required(),
  DB_DATABASE_SECUNDARIA: Joi.string().optional(),
  DB_PORT: Joi.number().default(1433),
  DB_ENCRYPT: Joi.boolean().default(false),
  DB_TRUST_SERVER_CERTIFICATE: Joi.boolean().default(false),

  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRATION_TIME: Joi.string().default('4h'),
  JWT_REFRESH_EXPIRATION_TIME: Joi.string().default('7d'),
  JWT_EXPIRATION_TIME_MS: Joi.number().default(21600000),
  JWT_REFRESH_EXPIRATION_TIME_MS: Joi.number().default(604800000),

  CORS_ORIGINS: Joi.string().default('*'),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_TO_FILE: Joi.boolean().default(false),
}).unknown(true);

const { error, value } = schema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
  stripUnknown: true,
});

if (error) {
  throw new Error(`Error en configuración: ${error.message}`);
}

export default value;
