/**
 * Supabase DB Integration Helpers
 */
export function isValidUUID(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function getSupabaseProfile(userId, env) {
  if (!isValidUUID(userId)) return null;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=plan,usage_count,customer_portal_url`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    if (!res.ok) {
      console.warn(`[Supabase] Profile lookup returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data[0] || null;
  } catch (err) {
    console.error("[Supabase] Profile lookup failed:", err.message || err);
    return null;
  }
}

export async function incrementSupabaseUsage(userId, env) {
  if (!isValidUUID(userId)) return null;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const url = `${supabaseUrl}/rest/v1/rpc/increment_usage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ user_id: userId })
    });
    if (!res.ok) {
      console.warn(`[Supabase] Atomic increment RPC returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    return typeof data === "number" ? data : (data && typeof data.usage_count === "number" ? data.usage_count : null);
  } catch (err) {
    console.error("[Supabase] Atomic increment RPC failed:", err.message || err);
    return null;
  }
}

export async function updateSupabaseProfilePlan(userId, plan, customerPortalUrl, env) {
  if (!isValidUUID(userId)) return false;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;

  try {
    const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      method: "POST", // POST with resolution=merge-duplicates does upsert
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        id: userId,
        plan: plan,
        customer_portal_url: customerPortalUrl || "",
        updated_at: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (err) {
    console.error("[Supabase] Profile upsert failed:", err.message || err);
    return false;
  }
}
