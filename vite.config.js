import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleCategorizeRequest } from './src/server/aiCategorizer.js';
import { createClient } from '@supabase/supabase-js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'finovo-dev-api-server',
        configureServer(server) {
          server.middlewares.use('/api/categorize', async (req, res) => {
            if (req.method === 'OPTIONS') {
              res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
              });
              return res.end();
            }

            if (req.method !== 'POST') {
              res.writeHead(405, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            }

            let bodyData = '';
            req.on('data', chunk => { bodyData += chunk; });
            req.on('end', async () => {
              let parsedBody;
              try {
                parsedBody = JSON.parse(bodyData || '{}');
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
              }

              const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
              const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
              const supabaseClient = (supabaseUrl && supabaseAnonKey) 
                ? createClient(supabaseUrl, supabaseAnonKey) 
                : null;

              try {
                const result = await handleCategorizeRequest({
                  method: req.method,
                  headers: req.headers,
                  body: parsedBody
                }, {
                  supabaseClient,
                  apiKey: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
                  model: env.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
                });

                res.writeHead(result.status, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(result.body));
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message || 'Internal server error in dev api.' }));
              }
            });
          });
        }
      }
    ]
  };
});

