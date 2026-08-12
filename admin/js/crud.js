/* =====================================================================
 *  SOMAR Admin — Motor CRUD genérico
 *  Un solo motor configurable por entidad. Renderiza lista con filtros
 *  y formulario auto-generado a partir de `fields`. Soporta varias
 *  instancias en la misma página (tabs) y un modo singleton (settings).
 *
 *  Requiere: supabase-js, /js/config.js, /admin/js/auth.js
 *
 *  API:
 *    SOMAR_CRUD.page(config)                 -> una entidad en #crudRoot
 *    SOMAR_CRUD.tabs(mountSel, [{label,config}])  -> varias entidades
 *    SOMAR_CRUD.settings(mountSel, {table, groups:[{title,fields}]})
 *
 *  config = { table, mount?, title?, singular?, search?, orderBy?,
 *             reorder?, duplicate?, columns:[...], fields:[...] }
 *  columns[] = { field, label, type?('primary'|'thumb'|'color'|'rating'
 *                |'money'|'icon'|'order'|'text'), sub?, width? }
 *  fields[]  = { name, label, type('text'|'textarea'|'number'|'checkbox'
 *                |'select'|'color'|'image'|'url'|'slug'), required?, col?,
 *                default?, options?, min?, max?, step?, rows?, placeholder?,
 *                hint?, slugFrom? }
 * ===================================================================== */
(function () {
  var AUTH = window.SOMAR_AUTH;
  var cfg = window.SOMAR_CONFIG || {};

  // ---- helpers -------------------------------------------------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gs(n) { return 'Gs. ' + Math.round(Number(n || 0)).toLocaleString('de-DE'); }
  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function mediaUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path) || /^data:/.test(path)) return path;
    if (String(path).charAt(0) === '/') return path;
    // Recursos locales del repo (imágenes semilla): root-absolutos para que
    // funcionen desde cualquier subcarpeta del admin, no desde Storage.
    if (String(path).indexOf('assets/') === 0) return '/' + path;
    var base = (cfg.SUPABASE_URL || '').replace(/\/+$/, '');
    return base + '/storage/v1/object/public/' + (cfg.STORAGE_BUCKET || 'somar-media') + '/' + String(path).replace(/^\/+/, '');
  }
  function toast(msg, type) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast show ' + (type || 'ok');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 3200);
  }
  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function setWho() {
    var me = (AUTH.me && AUTH.me()) || {};
    var n = document.getElementById('whoName'); var a = document.getElementById('whoAvatar');
    if (n) n.textContent = me.full_name || 'Administrador';
    if (a) a.textContent = (me.full_name || 'S').charAt(0).toUpperCase();
  }

  // ---- generación de campos -----------------------------------------
  function fieldControl(f) {
    switch (f.type) {
      case 'textarea':
        return '<textarea name="' + f.name + '" rows="' + (f.rows || 3) + '"' +
          (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></textarea>';
      case 'number':
        return '<input name="' + f.name + '" type="number"' +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
          (f.step != null ? ' step="' + f.step + '"' : '') +
          (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
      case 'select':
        return '<select name="' + f.name + '">' +
          (f.optional === false ? '' : '<option value="">— Seleccionar —</option>') +
          (f.options || []).map(function (o) {
            var val = (o && typeof o === 'object') ? o.value : o;
            var lab = (o && typeof o === 'object') ? o.label : o;
            return '<option value="' + esc(val) + '">' + esc(lab) + '</option>';
          }).join('') + '</select>';
      case 'color':
        return '<div class="color-field"><span class="swatch" data-swatch></span>' +
          '<input name="' + f.name + '" type="text" placeholder="' + esc(f.placeholder || '#1D703A') + '"></div>';
      case 'image':
        return '<div class="img-single" data-imgfield="' + f.name + '">' +
          '<div class="img-single-preview" data-prev></div>' +
          '<div class="img-single-actions">' +
            '<label class="linkbtn">Subir imagen<input type="file" accept="image/*" hidden data-file></label>' +
            '<button type="button" class="linkbtn danger" data-clear hidden>Quitar</button>' +
          '</div></div>';
      case 'url':
        return '<input name="' + f.name + '" type="url"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
      case 'slug':
        return '<input name="' + f.name + '" type="text" data-auto="1" placeholder="' + esc(f.placeholder || 'se-genera-solo') + '">';
      default:
        return '<input name="' + f.name + '" type="text"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
    }
  }
  function renderField(f) {
    if (f.type === 'checkbox') {
      return '<div class="field col2" data-field="' + f.name + '"><label class="chk"><input name="' + f.name +
        '" type="checkbox"> ' + esc(f.label || f.name) + '</label>' +
        (f.hint ? '<span class="fhint">' + esc(f.hint) + '</span>' : '') + '</div>';
    }
    var col = (f.type === 'textarea' || f.type === 'image' || f.col === 2 || f.full) ? ' col2' : '';
    var inner = fieldControl(f) + (f.hint ? '<span class="fhint">' + esc(f.hint) + '</span>' : '');
    return '<div class="field' + col + '" data-field="' + f.name + '"><label>' + esc(f.label || f.name) +
      (f.required ? ' *' : '') + '</label>' + inner + '</div>';
  }

  function updateSwatch(input) {
    var sw = input.parentNode.querySelector('[data-swatch]');
    if (sw) sw.style.background = (input.value || '').trim() || 'transparent';
  }
  function renderImagePreview(scope, f, inst) {
    var wrap = scope.querySelector('[data-imgfield="' + f.name + '"]'); if (!wrap) return;
    var im = inst.images[f.name] || {};
    var prev = wrap.querySelector('[data-prev]'); var clear = wrap.querySelector('[data-clear]');
    var url = im.file ? URL.createObjectURL(im.file) : (im.path ? mediaUrl(im.path) : '');
    if (url) { prev.innerHTML = '<img src="' + esc(url) + '" alt="">'; if (clear) clear.hidden = false; }
    else { prev.innerHTML = '<span class="img-ph">Sin imagen</span>'; if (clear) clear.hidden = true; }
  }

  // ---- fill / read ---------------------------------------------------
  function fillForm(scope, row, fields, inst) {
    fields.forEach(function (f) {
      if (f.type === 'image') {
        inst.images[f.name] = { path: row ? (row[f.name] || '') : '', file: null, cleared: false };
        renderImagePreview(scope, f, inst);
        return;
      }
      var elx = scope.querySelector('[name="' + f.name + '"]'); if (!elx) return;
      if (f.type === 'checkbox') { elx.checked = row ? !!row[f.name] : !!f.default; return; }
      if (f.type === 'slug') { elx.value = row ? (row[f.name] || '') : ''; elx.setAttribute('data-auto', row ? '0' : '1'); return; }
      var val = row ? row[f.name] : (f.default != null ? f.default : '');
      elx.value = (val == null ? '' : val);
      if (f.type === 'color') updateSwatch(elx);
    });
  }
  function readForm(scope, fields) {
    var payload = {};
    fields.forEach(function (f) {
      if (f.type === 'image') return;
      var elx = scope.querySelector('[name="' + f.name + '"]'); if (!elx) return;
      if (f.type === 'checkbox') { payload[f.name] = !!elx.checked; return; }
      var v = elx.value;
      if (f.type === 'number') { payload[f.name] = (v === '' ? (f.default != null ? f.default : null) : Number(v)); return; }
      v = (v == null ? '' : String(v)).trim();
      payload[f.name] = (v === '' ? (f.keepEmpty ? '' : null) : v);
    });
    return payload;
  }
  function applySlug(payload, fields) {
    fields.forEach(function (f) {
      if (f.type === 'slug' && !payload[f.name]) {
        payload[f.name] = slugify(payload[f.slugFrom || 'name'] || payload.name || payload.title || 'item');
      }
    });
  }
  function validate(payload, fields) {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.required && f.type !== 'checkbox' && f.type !== 'image') {
        var v = payload[f.name];
        if (v == null || v === '') { toast('Completá el campo "' + (f.label || f.name) + '".', 'err'); return false; }
      }
    }
    return true;
  }
  async function uploadImages(inst, fields, payload) {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i]; if (f.type !== 'image') continue;
      var im = inst.images[f.name] || {};
      if (im.file) {
        var ext = (im.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        var path = inst.table + '/' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.' + ext;
        var up = await inst.sb.storage.from(cfg.STORAGE_BUCKET || 'somar-media').upload(path, im.file, { contentType: im.file.type });
        if (up.error) throw up.error;
        payload[f.name] = path;
      } else if (im.cleared) { payload[f.name] = null; }
      else { payload[f.name] = im.path || null; }
    }
  }

  // ---- cableado de widgets (color/imagen/slug) -----------------------
  function wireWidgets(scope, fields, inst) {
    Array.prototype.forEach.call(scope.querySelectorAll('.color-field input'), function (i) {
      updateSwatch(i); i.addEventListener('input', function () { updateSwatch(i); });
    });
    fields.forEach(function (f) {
      if (f.type !== 'image') return;
      var wrap = scope.querySelector('[data-imgfield="' + f.name + '"]'); if (!wrap) return;
      if (!inst.images[f.name]) inst.images[f.name] = { path: '', file: null, cleared: false };
      var file = wrap.querySelector('[data-file]'); var clear = wrap.querySelector('[data-clear]');
      if (file) file.addEventListener('change', function (e) {
        var fl = e.target.files && e.target.files[0]; if (!fl) return;
        if (!/^image\//.test(fl.type)) { toast('Solo imágenes.', 'err'); return; }
        if (fl.size > 5 * 1024 * 1024) { toast('Máximo 5MB por imagen.', 'err'); return; }
        inst.images[f.name].file = fl; inst.images[f.name].cleared = false;
        renderImagePreview(scope, f, inst); e.target.value = '';
      });
      if (clear) clear.addEventListener('click', function () {
        inst.images[f.name] = { path: '', file: null, cleared: true };
        renderImagePreview(scope, f, inst);
      });
    });
    var slugField = fields.filter(function (f) { return f.type === 'slug'; })[0];
    if (slugField) {
      var slugEl = scope.querySelector('[name="' + slugField.name + '"]');
      var fromEl = scope.querySelector('[name="' + (slugField.slugFrom || 'name') + '"]');
      if (slugEl) slugEl.addEventListener('input', function () { slugEl.setAttribute('data-auto', '0'); });
      if (slugEl && fromEl) fromEl.addEventListener('input', function () {
        if (slugEl.getAttribute('data-auto') !== '0' || !slugEl.value) slugEl.value = slugify(fromEl.value);
      });
    }
  }

  // ---- render de celdas de la lista ---------------------------------
  function cell(row, c) {
    switch (c.type) {
      case 'primary':
        return '<td><div style="font-weight:700">' + esc(row[c.field]) + '</div>' +
          (c.sub ? '<div class="muted" style="font-size:12.5px">' + esc(row[c.sub] || '') + '</div>' : '') + '</td>';
      case 'thumb':
        var u = mediaUrl(row[c.field]);
        return '<td>' + (u ? '<img src="' + esc(u) + '" alt="" style="width:46px;height:46px;object-fit:contain;border-radius:8px;background:var(--prod-bg)">'
          : '<div style="width:46px;height:46px;border-radius:8px;background:var(--prod-bg)"></div>') + '</td>';
      case 'color':
        var col = row[c.field] || '';
        return '<td><span style="display:inline-flex;align-items:center;gap:7px">' +
          '<span style="width:16px;height:16px;border-radius:5px;border:1px solid #d7e0d9;background:' + esc(col || 'transparent') + '"></span>' +
          '<span class="muted">' + esc(col || '—') + '</span></span></td>';
      case 'rating':
        var n = Math.max(0, Math.min(5, Number(row[c.field] || 0)));
        var stars = '';
        for (var s = 0; s < 5; s++) stars += (s < n ? '<span style="color:#e0a100">&#9733;</span>' : '<span style="color:#d7e0d9">&#9733;</span>');
        return '<td style="letter-spacing:1px;white-space:nowrap">' + stars + '</td>';
      case 'money':
        return '<td style="white-space:nowrap;font-weight:700">' + gs(row[c.field]) + '</td>';
      case 'icon':
        return '<td style="font-size:20px">' + esc(row[c.field] || '') + '</td>';
      case 'order':
        return '<td class="muted">' + (row.display_order != null ? row.display_order : '—') + '</td>';
      default:
        var v = row[c.field];
        return '<td class="muted">' + esc(v != null && v !== '' ? v : '—') + '</td>';
    }
  }
  function actionsCell(row, conf) {
    var a = '<td>' + ('is_active' in row ? (row.is_active
      ? '<span class="pill on">Activo</span>' : '<span class="pill off">Inactivo</span>') : '') + '<div class="actions">';
    a += '<button data-act="edit" data-id="' + row.id + '">Editar</button>';
    if (conf.reorder !== false) a += '<button data-act="up" data-id="' + row.id + '" title="Subir">&#8593;</button>' +
      '<button data-act="down" data-id="' + row.id + '" title="Bajar">&#8595;</button>';
    if ('is_active' in row) a += '<button data-act="toggle" data-id="' + row.id + '">' + (row.is_active ? 'Desactivar' : 'Activar') + '</button>';
    a += '<button data-act="del" data-id="' + row.id + '" class="danger">Eliminar</button>';
    a += '</div></td>';
    return a;
  }

  // ---- construcción de una instancia --------------------------------
  function build(conf) {
    conf.orderBy = conf.orderBy || 'display_order';
    conf.columns = conf.columns || [];
    conf.fields = conf.fields || [];
    var inst = { table: conf.table, sb: null, rows: [], editing: null, images: {} };

    var root = h('div', { class: 'crud' });
    var header = conf.columns.map(function (c) {
      return '<th' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>';
    }).join('') + '<th style="min-width:240px">Estado / Acciones</th>';

    root.innerHTML =
      '<div class="listView">' +
        '<div class="toolbar">' +
          (conf.search ? '<input class="inp fSearch" type="search" placeholder="Buscar…">' : '') +
          '<select class="inp fStatus"><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>' +
          '<button class="btn newBtn" type="button">+ Nuevo</button>' +
        '</div>' +
        '<div class="panel" style="padding:0;overflow:hidden"><div style="overflow-x:auto">' +
          '<table class="tbl"><thead><tr>' + header + '</tr></thead>' +
          '<tbody class="rows"><tr><td colspan="' + (conf.columns.length + 1) + '"><div class="skeleton" style="height:80px;margin:14px"></div></td></tr></tbody></table>' +
        '</div></div>' +
      '</div>' +
      '<div class="formView" style="display:none">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
          '<button class="btn ghost backBtn" type="button">← Volver</button>' +
          '<h2 class="formTitle" style="font-size:20px;font-weight:900;margin:0"></h2>' +
        '</div>' +
        '<form class="crudForm"><div class="card-sec"><div class="fgrid">' +
          conf.fields.map(renderField).join('') +
        '</div></div>' +
        '<div class="save-bar"><button class="btn saveBtn" type="submit">Guardar</button>' +
        '<button class="btn ghost cancelBtn" type="button">Cancelar</button></div></form>' +
      '</div>';

    var listView = root.querySelector('.listView');
    var formView = root.querySelector('.formView');
    var form = root.querySelector('.crudForm');
    var fSearch = root.querySelector('.fSearch');
    var fStatus = root.querySelector('.fStatus');

    function renderRows() {
      var tb = root.querySelector('.rows');
      if (!inst.rows.length) {
        tb.innerHTML = '<tr><td colspan="' + (conf.columns.length + 1) + '"><div class="empty">Sin registros todavía.</div></td></tr>';
        return;
      }
      tb.innerHTML = inst.rows.map(function (row) {
        return '<tr>' + conf.columns.map(function (c) { return cell(row, c); }).join('') + actionsCell(row, conf) + '</tr>';
      }).join('');
    }

    async function reload() {
      var q = inst.sb.from(conf.table).select('*');
      var term = fSearch ? fSearch.value.trim() : '';
      var status = fStatus ? fStatus.value : '';
      if (term && conf.search) q = q.ilike(conf.search, '%' + term + '%');
      if (status === 'active') q = q.eq('is_active', true);
      if (status === 'inactive') q = q.eq('is_active', false);
      q = q.order(conf.orderBy, { ascending: true }).order('id', { ascending: true });
      var r = await q;
      if (r.error) { toast('Error al cargar: ' + r.error.message, 'err'); return; }
      var rows = r.data || [];
      // Ocultar filas de la lista sin borrarlas de la base (filtro opcional por config).
      if (typeof conf.hideWhere === 'function') rows = rows.filter(function (row) { return !conf.hideWhere(row); });
      inst.rows = rows; renderRows();
    }

    function openForm(row) {
      inst.editing = row || null;
      inst.images = {};
      root.querySelector('.formTitle').textContent = (row ? 'Editar ' : 'Nuevo ') + (conf.singular || 'registro');
      fillForm(form, row, conf.fields, inst);
      listView.style.display = 'none'; formView.style.display = 'block';
      window.scrollTo(0, 0);
    }
    function closeForm() { formView.style.display = 'none'; listView.style.display = 'block'; }

    async function save(e) {
      e.preventDefault();
      var payload = readForm(form, conf.fields);
      if (!validate(payload, conf.fields)) return;
      applySlug(payload, conf.fields);
      var btn = form.querySelector('.saveBtn'); var old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await uploadImages(inst, conf.fields, payload);
        if (inst.editing && inst.editing.id != null) {
          var u = await inst.sb.from(conf.table).update(payload).eq('id', inst.editing.id);
          if (u.error) throw u.error;
        } else {
          var ins = await inst.sb.from(conf.table).insert(payload).select('id').single();
          if (ins.error) throw ins.error;
        }
        toast(inst.editing ? 'Cambios guardados.' : (conf.singular ? conf.singular[0].toUpperCase() + conf.singular.slice(1) + ' creado.' : 'Creado.'));
        closeForm(); await reload();
      } catch (err) {
        toast('No se pudo guardar: ' + (err.message || err), 'err');
      } finally { btn.disabled = false; btn.textContent = old; }
    }

    async function dup(row) {
      var copy = Object.assign({}, row);
      delete copy.id; delete copy.created_at; delete copy.updated_at;
      if ('is_active' in copy) copy.is_active = false;
      ['name', 'title', 'customer_name', 'label'].some(function (k) {
        if (k in copy && copy[k]) { copy[k] = copy[k] + ' (copia)'; return true; } return false;
      });
      if ('slug' in copy) copy.slug = slugify((copy.slug || 'item') + '-copia-' + String(Date.now()).slice(-4));
      var r = await inst.sb.from(conf.table).insert(copy);
      if (r.error) toast(r.error.message, 'err'); else { toast('Duplicado (inactivo).'); reload(); }
    }

    async function move(id, dir) {
      var idx = inst.rows.findIndex(function (r) { return String(r.id) === String(id); });
      var j = dir === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || j < 0 || j >= inst.rows.length) return;
      var a = inst.rows[idx], b = inst.rows[j];
      var ao = a.display_order, bo = b.display_order;
      if (ao === bo) { ao = idx; bo = j; }
      var u1 = await inst.sb.from(conf.table).update({ display_order: bo }).eq('id', a.id);
      var u2 = await inst.sb.from(conf.table).update({ display_order: ao }).eq('id', b.id);
      if (u1.error || u2.error) toast((u1.error || u2.error).message, 'err');
      reload();
    }

    async function onAction(act, id) {
      var row = inst.rows.find(function (r) { return String(r.id) === String(id); });
      if (!row && act !== 'up' && act !== 'down') return;
      if (act === 'edit') openForm(row);
      else if (act === 'toggle') {
        var u = await inst.sb.from(conf.table).update({ is_active: !row.is_active }).eq('id', id);
        if (u.error) toast(u.error.message, 'err'); else { toast(row.is_active ? 'Desactivado.' : 'Activado.'); reload(); }
      } else if (act === 'del') {
        if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.\n(Sugerencia: podés Desactivar en lugar de eliminar.)')) return;
        var d = await inst.sb.from(conf.table).delete().eq('id', id);
        if (d.error) toast(d.error.message, 'err'); else { toast('Eliminado.'); reload(); }
      } else if (act === 'dup') dup(row);
      else if (act === 'up' || act === 'down') move(id, act);
    }

    // wire
    root.querySelector('.newBtn').addEventListener('click', function () { openForm(null); });
    root.querySelector('.backBtn').addEventListener('click', closeForm);
    root.querySelector('.cancelBtn').addEventListener('click', closeForm);
    form.addEventListener('submit', save);
    root.querySelector('.rows').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b) return;
      onAction(b.getAttribute('data-act'), b.getAttribute('data-id'));
    });
    if (fSearch) { var deb; fSearch.addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(reload, 300); }); }
    if (fStatus) fStatus.addEventListener('change', reload);
    wireWidgets(form, conf.fields, inst);

    return {
      el: root,
      init: async function (sb) { inst.sb = sb; await reload(); }
    };
  }

  // ---- APIs públicas -------------------------------------------------
  async function page(conf) {
    if (!AUTH || !(await AUTH.requireAdmin())) return;
    setWho();
    var mountEl = document.querySelector(conf.mount || '#crudRoot'); if (!mountEl) return;
    var inst = build(conf);
    mountEl.appendChild(inst.el);
    await inst.init(AUTH.client());
  }

  async function tabs(mountSel, list) {
    if (!AUTH || !(await AUTH.requireAdmin())) return;
    setWho();
    var mountEl = document.querySelector(mountSel); if (!mountEl) return;
    var bar = h('div', { class: 'tabs' });
    var panels = h('div', { class: 'tabpanels' });
    var built = [];
    list.forEach(function (t, i) {
      var btn = h('button', { class: 'tab' + (i === 0 ? ' active' : ''), type: 'button' }, esc(t.label));
      var panel = h('div', { class: 'tabpanel' + (i === 0 ? ' active' : '') });
      var inst = build(t.config);
      panel.appendChild(inst.el);
      bar.appendChild(btn); panels.appendChild(panel);
      built.push({ btn: btn, panel: panel, inst: inst });
      btn.addEventListener('click', function () {
        built.forEach(function (x) { x.btn.classList.remove('active'); x.panel.classList.remove('active'); });
        btn.classList.add('active'); panel.classList.add('active');
      });
    });
    mountEl.appendChild(bar); mountEl.appendChild(panels);
    var sb = AUTH.client();
    for (var k = 0; k < built.length; k++) { await built[k].inst.init(sb); }
  }

  async function settings(mountSel, conf) {
    if (!AUTH || !(await AUTH.requireAdmin())) return;
    setWho();
    var mountEl = document.querySelector(mountSel); if (!mountEl) return;
    var sb = AUTH.client();
    var r = await sb.from(conf.table).select('*').order('id', { ascending: true }).limit(1).maybeSingle();
    if (r.error) toast('No se pudo cargar: ' + r.error.message, 'err');
    var row = r.data || null;

    var allFields = [];
    var form = h('form', { class: 'crudForm' });
    (conf.groups || []).forEach(function (g) {
      var sec = h('div', { class: 'card-sec' });
      sec.innerHTML = '<h3>' + esc(g.title) + '</h3><div class="fgrid">' + g.fields.map(renderField).join('') + '</div>';
      form.appendChild(sec);
      g.fields.forEach(function (f) { allFields.push(f); });
    });
    var bar = h('div', { class: 'save-bar' });
    bar.innerHTML = '<button class="btn" type="submit">Guardar cambios</button>';
    form.appendChild(bar);
    mountEl.appendChild(form);

    var inst = { table: conf.table, sb: sb, images: {} };
    fillForm(form, row, allFields, inst);
    wireWidgets(form, allFields, inst);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var payload = readForm(form, allFields);
      if (!validate(payload, allFields)) return;
      var btn = form.querySelector('button[type="submit"]'); var old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        await uploadImages(inst, allFields, payload);
        if (row && row.id != null) {
          var u = await sb.from(conf.table).update(payload).eq('id', row.id); if (u.error) throw u.error;
        } else {
          var ins = await sb.from(conf.table).insert(payload).select('*').single(); if (ins.error) throw ins.error; row = ins.data;
        }
        toast('Configuración guardada.');
      } catch (err) { toast('No se pudo guardar: ' + (err.message || err), 'err'); }
      finally { btn.disabled = false; btn.textContent = old; }
    });
  }

  window.SOMAR_CRUD = { page: page, tabs: tabs, settings: settings, _build: build };
})();
