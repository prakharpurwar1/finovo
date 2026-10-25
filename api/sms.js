/**
 * Vercel Serverless Function: /api/sms
 * Secure entry point for server-side SMS dispatch.
 */

import { createClient } from '@supabase/supabase-js';
import { handleSmsSendRequest } from '../src/server/smsService.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabaseClient = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Will be handled
      }
    }

    const result = await handleSmsSendRequest({
      ...req,
      body
    }, { supabaseClient, env: process.env });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Unhandled error in /api/sms:', err);
    return res.status(500).json({ success: false, error: 'Internal server error processing SMS dispatch.' });
  }
}
