import { Router } from 'express';

/* -----------------------------
   Polyfill fetch para Node < 18
   (si tu Node es 18+ este bloque no hace nada)
-------------------------------- */
if (typeof fetch === 'undefined') {
  const { default: fetchImpl } = await import('node-fetch');
  globalThis.fetch = fetchImpl;
}

/* -----------------------------
   (Opcional) Proxy corporativo
   Si usas proxy, define HTTPS_PROXY/HTTP_PROXY en tu entorno.
   Requiere: npm i https-proxy-agent
-------------------------------- */
let agent = undefined;
const proxyURL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
if (proxyURL) {
  try {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    agent = new HttpsProxyAgent(proxyURL);
    console.log('[weather] proxy activo:', proxyURL);
  } catch (e) {
    console.warn('[weather] Proxy definido pero falta dependencia https-proxy-agent. Ejecuta: npm i https-proxy-agent');
  }
}

/* -----------------------------
   Helper: timeout con AbortController
-------------------------------- */
function timeoutSignal(ms = 8000) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(new Error('timeout')), ms);
  // función para limpiar el timer si todo sale bien
  const cancel = () => clearTimeout(id);
  return { signal: ac.signal, cancel };
}

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Weather
 *     description: Proxy a OpenWeather (temperatura actual)
 *
 * /api/weather:
 *   get:
 *     tags: [Weather]
 *     summary: Obtiene la temperatura actual por lat/lon (unidades metric)
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number, example: 25.6866 }
 *       - in: query
 *         name: lon
 *         required: true
 *         schema: { type: number, example: -100.3161 }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Parámetros inválidos }
 *       503: { description: API Key no configurada }
 */
router.get('/', async (req, res) => {
  try {
    const { lat, lon } = req.query || {};
    const latN = Number(lat);
    const lonN = Number(lon);

    if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
      return res.status(400).json({ error: 'lat/lon requeridos y numéricos' });
    }

    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) {
      return res.status(503).json({ error: 'OPENWEATHER_API_KEY no configurada en .env' });
    }

    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.searchParams.set('lat', String(latN));
    url.searchParams.set('lon', String(lonN));
    url.searchParams.set('appid', key);
    url.searchParams.set('units', 'metric');
    url.searchParams.set('lang', 'es');

    const { signal, cancel } = timeoutSignal(8000);
    // Para node-fetch, el proxy se pasa como { agent }; en Node 18+ (undici) se ignora.
    const r = await fetch(url, { signal, agent });
    cancel();

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: `OpenWeather error: ${text}` });
    }

    const j = await r.json();

    // Respuesta simplificada para el widget
    const out = {
      place: {
        name: j.name || '',
        country: j.sys?.country || '',
        lat: j.coord?.lat,
        lon: j.coord?.lon
      },
      weather: {
        temp: j.main?.temp,
        feels_like: j.main?.feels_like,
        humidity: j.main?.humidity,
        pressure: j.main?.pressure,
        wind_kmh: (j.wind?.speed ?? 0) * 3.6, // m/s → km/h
        description: j.weather?.[0]?.description || '',
        icon: j.weather?.[0]?.icon || '01d',
        dt: j.dt || null
      }
    };

    res.json(out);
  } catch (err) {
    // Log detallado al servidor y mensaje útil al cliente
    console.error('weather error:', err);
    const message =
      err?.name === 'AbortError' ? 'Timeout al consultar OpenWeather' :
      err?.cause?.code ? `Fallo de red (${err.cause.code})` :
      err?.message || 'Fallo al obtener clima';

    res.status(500).json({ error: message });
  }
});

export default router;
