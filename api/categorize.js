/**
 * Vercel Serverless Function: /api/categorize
 * Entry point for secure server-side AI transaction categorization.
 */

import { createClient } from '@supabase/supabase-js';
import { handleCategorizeRequest } from '../src/server/aiCategorizer.js';

// Initialize server-side Supabase client for session verification
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabaseClient = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default async function handler(req, res) {
  // CORS Headers for API calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Will be caught by validateCategorizeRequest
      }
    }

    const result = await handleCategorizeRequest({
      ...req,
      body
    }, { supabaseClient });
    if (result.headers) {
      for (const [key, val] of Object.entries(result.headers)) {
        res.setHeader(key, val);
      }
    }
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Unhandled error in /api/categorize:', error);
    return res.status(500).json({ error: 'Internal server error processing categorization request.' });
  }
}
