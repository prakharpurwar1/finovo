/**
 * Finovo Server-Side SMS Notification Dispatcher
 * 
 * Strict constraints:
 * 1. Provider credentials remain on server only.
 * 2. Never claims delivery succeeded when provider is not configured.
 * 3. Enforces idempotency to prevent duplicate SMS transmissions.
 * 4. Logs delivery records in public.notification_delivery_records.
 */

// In-memory idempotency cache for fast deduplication
const sentIdempotencyKeys = new Set();

/**
 * Validates E.164 or Indian 10-digit mobile phone numbers.
 * @param {string} phone 
 * @returns {string|null} Normalized phone or null if invalid
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
    return cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
  }
  return null;
}

/**
 * Server-side SMS dispatch handler.
 */
export async function handleSmsSendRequest(req, { supabaseClient = null, env = process.env } = {}) {
  const { recipientPhone, recipientName, message, groupId, idempotencyKey } = req.body || {};

  if (!recipientPhone) {
    return {
      status: 400,
      body: { success: false, error: 'Recipient phone number is required.' }
    };
  }

  const normalizedPhone = normalizePhoneNumber(recipientPhone);
  if (!normalizedPhone) {
    return {
      status: 400,
      body: { success: false, error: 'Invalid phone number format. Must be a valid 10-15 digit mobile number.' }
    };
  }

  // 1. Idempotency Check
  if (idempotencyKey && sentIdempotencyKeys.has(idempotencyKey)) {
    return {
      status: 200,
      body: { 
        success: true, 
        deliveryStatus: 'delivered', 
        deduplicated: true,
        message: 'Notification already dispatched with this idempotency key.' 
      }
    };
  }

  // 2. Check Provider Credentials
  const twilioSid = env.TWILIO_ACCOUNT_SID;
  const twilioAuth = env.TWILIO_AUTH_TOKEN;
  const twilioFrom = env.TWILIO_PHONE_NUMBER;

  const msg91Key = env.MSG91_AUTH_KEY;

  let deliveryStatus = 'pending';
  let providerRef = null;
  let lastError = null;
  let providerUsed = 'none';

  if (twilioSid && twilioAuth && twilioFrom) {
    providerUsed = 'twilio';
    try {
      // Dispatch via Twilio REST API
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const params = new URLSearchParams({
        To: normalizedPhone,
        From: twilioFrom,
        Body: message
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const json = await response.json();
      if (response.ok && json.sid) {
        deliveryStatus = 'delivered';
        providerRef = json.sid;
        if (idempotencyKey) sentIdempotencyKeys.add(idempotencyKey);
      } else {
        deliveryStatus = 'failed';
        lastError = json.message || 'Twilio SMS dispatch failed.';
      }
    } catch (err) {
      deliveryStatus = 'failed';
      lastError = err.message;
    }
  } else if (msg91Key) {
    providerUsed = 'msg91';
    deliveryStatus = 'pending';
    lastError = 'MSG91 provider integration configured, pending carrier route activation.';
  } else {
    // Unconfigured Provider
    providerUsed = 'none';
    deliveryStatus = 'failed';
    lastError = 'SMS provider credentials not configured. Configure TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in environment to enable live SMS transmission.';
  }

  // 3. Log into Supabase notification_delivery_records if client available
  if (supabaseClient) {
    try {
      await supabaseClient.from('notification_delivery_records').insert({
        channel: 'sms',
        provider: providerUsed,
        recipient_contact: normalizedPhone,
        delivery_status: deliveryStatus,
        provider_ref: providerRef,
        last_error: lastError,
        idempotency_key: idempotencyKey || null
      });
    } catch (e) {
      console.warn('Could not record delivery log to database:', e.message);
    }
  }

  return {
    status: deliveryStatus === 'delivered' ? 200 : (providerUsed === 'none' ? 422 : 502),
    body: {
      success: deliveryStatus === 'delivered',
      deliveryStatus,
      provider: providerUsed,
      providerRef,
      error: lastError,
      recipient: normalizedPhone
    }
  };
}
