/* =====================================================================
 *  SOMAR Admin — Dashboard
 *  Protege /admin, carga métricas reales y maneja logout + drawer móvil.
 * ===================================================================== */
(function () {
  var AUTH = window.SOMAR_AUTH;

  function q(sel) { return document.querySelector(sel); }
  function count(sb, table, filters) {
    var query = sb.from(table).select('*', { count: 'exact', head: true });
    (filters || []).forEach(function (f) { query = query.eq(f[0], f[1]); });
    return query;
  }

  async function loadDashboard() {
    var sb = AUTH.client();
    var me = AUTH.me();
    if (me) {
      q('#whoName').textContent = me.full_name || 'Administrador';
      q('#whoAvatar').textContent = (me.full_name || 'S').trim().charAt(0).toUpperCase();
    }

    // Umbral de stock bajo desde settings
    var threshold = 3;
    try {
      var st = await sb.from('site_settings').select('low_stock_threshold').limit(1).maybeSingle();
      if (st.data && st.data.low_stock_threshold != null) threshold = st.data.low_stock_threshold;
    } catch (e) {}

    try {
      var res = await Promise.all([
        count(sb, 'products', []),
        count(sb, 'products', [['is_active', true]]),
        count(sb, 'products', [['is_featured', true]]),
        sb.from('products').select('*', { count: 'exact', head: true }).lte('stock', threshold),
        count(sb, 'categories', []),
        count(sb, 'brands', []),
        sb.from('products').select('id,name,price,stock,is_active').order('created_at', { ascending: false }).limit(6),
        sb.from('products').select('id,name,stock').lte('stock', threshold).order('stock', { ascending: true }).limit(8)
      ]);

      setStat('stTotal', res[0].count);
      setStat('stActive', res[1].count);
      setStat('stFeatured', res[2].count);
      setStat('stLow', res[3].count);
      setStat('stCats', res[4].count);
      setStat('stBrands', res[5].count);
      renderRecent(res[6].data || []);
      renderLowStock(res[7].data || [], threshold);
    } catch (err) {
      console.error(err);
      q('#dashError').style.display = 'block';
    }
  }

  function setStat(id, v) { var el = document.getElementById(id); if (el) el.textContent = (v == null ? '—' : v); }

  function fmtGs(n) { return 'Gs. ' + Math.round(Number(n || 0)).toLocaleString('de-DE'); }

  function renderRecent(rows) {
    var box = q('#recentBox');
    if (!rows.length) { box.innerHTML = '<div class="empty">Todavía no hay productos.</div>'; return; }
    box.innerHTML = rows.map(function (p) {
      var badge = p.is_active ? '<span style="color:#1D703A;font-weight:800">Activo</span>'
                              : '<span class="muted">Inactivo</span>';
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 4px;border-bottom:1px solid #f1f5f2">' +
        '<span style="font-weight:700">' + esc(p.name) + '</span>' +
        '<span class="muted" style="white-space:nowrap">' + fmtGs(p.price) + ' · stock ' + p.stock + ' · ' + badge + '</span>' +
        '</div>';
    }).join('');
  }

  function renderLowStock(rows, threshold) {
    var box = q('#lowBox');
    if (!rows.length) { box.innerHTML = '<div class="empty">Sin alertas de stock (umbral: ' + threshold + ').</div>'; return; }
    box.innerHTML = rows.map(function (p) {
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 4px;border-bottom:1px solid #f1f5f2">' +
        '<span style="font-weight:700">' + esc(p.name) + '</span>' +
        '<span style="color:#b0433a;font-weight:800">' + p.stock + ' u.</span></div>';
    }).join('');
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Wire UI
  function wire() {
    q('#logoutBtn').addEventListener('click', async function () {
      await AUTH.signOut(); location.replace('/admin/login/');
    });
    var app = q('#app');
    q('#burger').addEventListener('click', function () { app.classList.toggle('open'); });
    q('#backdrop').addEventListener('click', function () { app.classList.remove('open'); });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var ok = await AUTH.requireAdmin(); // redirige si no es admin
    if (!ok) return;
    wire();
    loadDashboard();
  });
})();
