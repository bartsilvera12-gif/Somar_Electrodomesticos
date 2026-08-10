/* =====================================================================
 *  SOMAR Admin — Autenticación (Supabase Auth)
 *  Requiere: supabase-js UMD, /js/config.js cargados antes.
 *  Expone window.SOMAR_AUTH.
 * ===================================================================== */
(function () {
  var cfg = window.SOMAR_CONFIG || {};
  var lib = window.supabase;
  var client = null;

  function getClient() {
    if (client) return client;
    if (!lib || !lib.createClient) { console.error('[SOMAR Admin] supabase-js no cargado'); return null; }
    client = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      db: { schema: cfg.DB_SCHEMA || 'somarelectrodomestico' },
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'somar-admin-auth' }
    });
    return client;
  }

  var AUTH = {
    client: getClient,

    // Login con email + contraseña. Devuelve {ok, error, isAdmin}.
    signIn: async function (email, password) {
      var sb = getClient();
      if (!sb) return { ok: false, error: 'No se pudo inicializar Supabase.' };
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) return { ok: false, error: res.error.message };
      var admin = await AUTH.isAdmin();
      if (!admin) {
        await sb.auth.signOut();
        return { ok: false, error: 'Tu usuario no tiene acceso al panel.' };
      }
      return { ok: true };
    },

    // ¿La sesión actual pertenece a un admin activo?
    isAdmin: async function () {
      var sb = getClient();
      if (!sb) return false;
      var s = await sb.auth.getSession();
      if (!s.data || !s.data.session) return false;
      var uid = s.data.session.user.id;
      var r = await sb.from('admin_users').select('id, is_active, role, full_name')
        .eq('user_id', uid).eq('is_active', true).maybeSingle();
      if (r.error) { console.warn('[SOMAR Admin] admin_users:', r.error.message); return false; }
      AUTH._me = r.data || null;
      return !!r.data;
    },

    me: function () { return AUTH._me || null; },

    signOut: async function () {
      var sb = getClient();
      if (sb) await sb.auth.signOut();
    },

    resetPassword: async function (email) {
      var sb = getClient();
      if (!sb) return { ok: false, error: 'Supabase no disponible.' };
      var redirect = location.origin + '/admin/login/';
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      return r.error ? { ok: false, error: r.error.message } : { ok: true };
    },

    // Guard para páginas protegidas: si no es admin -> /admin/login
    requireAdmin: async function () {
      var ok = await AUTH.isAdmin();
      if (!ok) { location.replace('/admin/login/'); return false; }
      return true;
    }
  };

  window.SOMAR_AUTH = AUTH;
})();
