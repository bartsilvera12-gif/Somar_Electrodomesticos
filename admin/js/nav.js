/* =====================================================================
 *  SOMAR Admin — Sidebar compartido
 *  Renderiza la barra lateral y cablea burger/backdrop/logout una sola
 *  vez. La sección activa se toma de <body data-nav="clave">.
 *  Requiere: /admin/js/auth.js cargado antes (para signOut).
 * ===================================================================== */
(function () {
  var ITEMS = [
    { key: 'dashboard',     href: '/admin/',              icon: '◚', label: 'Dashboard' },
    { key: 'productos',     href: '/admin/productos/',    icon: '📦', label: 'Productos' },
    { key: 'categorias',    href: '/admin/categorias/',   icon: '🗂️', label: 'Categorías' },
    { key: 'marcas',        href: '/admin/marcas/',       icon: '🏷️', label: 'Marcas' },
    { key: 'contenido',     href: '/admin/contenido/',    icon: '📝', label: 'Contenido' },
    { key: 'testimonios',   href: '/admin/testimonios/',  icon: '⭐', label: 'Testimonios' },
    { key: 'redes',         href: '/admin/redes/',        icon: '📷', label: 'Redes' },
    { key: 'configuracion', href: '/admin/configuracion/',icon: '⚙️', label: 'Configuración' }
  ];

  function build(active) {
    var nav = ITEMS.map(function (it) {
      var cls = it.key === active ? ' class="active"' : '';
      return '<a' + cls + ' href="' + it.href + '"><span class="ic">' + it.icon + '</span> ' + it.label + '</a>';
    }).join('');
    return '' +
      '<div class="brand"><img src="/assets/somar-logo-oval.png" alt="SOMAR"></div>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="bottom">' +
        '<div class="sep"></div>' +
        '<a href="/" target="_blank" rel="noopener"><span class="ic">🌐</span> Ver sitio web</a>' +
        '<button id="logoutBtn"><span class="ic">⏋</span> Cerrar sesión</button>' +
      '</div>';
  }

  function wire() {
    var app = document.getElementById('app');
    var burger = document.getElementById('burger');
    var backdrop = document.getElementById('backdrop');
    if (burger && app) burger.addEventListener('click', function () { app.classList.toggle('open'); });
    if (backdrop && app) backdrop.addEventListener('click', function () { app.classList.remove('open'); });
    var logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', async function () {
      try { if (window.SOMAR_AUTH) await window.SOMAR_AUTH.signOut(); } catch (e) {}
      location.replace('/admin/login/');
    });
  }

  function render(active) {
    var side = document.querySelector('.sidebar');
    if (side) { side.innerHTML = build(active); side.setAttribute('data-filled', '1'); }
    wire();
  }

  function init() {
    var active = (document.body.getAttribute('data-nav') || '').trim();
    var side = document.querySelector('.sidebar');
    if (side && !side.getAttribute('data-filled')) render(active);
    else wire();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SOMAR_NAV = { render: render, items: ITEMS };
})();
