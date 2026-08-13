/* =====================================================================
 *  SOMAR Admin — Productos (CRUD)
 *  Requiere: supabase-js, /js/config.js, /admin/js/auth.js
 * ===================================================================== */
(function () {
  var AUTH = window.SOMAR_AUTH;
  var cfg = window.SOMAR_CONFIG || {};
  var sb = null;

  var state = { products: [], categories: [], brands: [], editing: null, images: [], removedImageIds: [], removedPaths: [] };

  // ---- helpers -------------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gs(n) { return 'Gs. ' + Math.round(Number(n || 0)).toLocaleString('de-DE'); }
  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function toast(msg, type) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast show ' + (type || 'ok');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 3000);
  }
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (label) btn.textContent = on ? 'Guardando…' : label; }

  // ---- data ----------------------------------------------------------
  async function loadRefs() {
    var c = await sb.from('categories').select('id,name').order('display_order');
    var b = await sb.from('brands').select('id,name').order('display_order');
    state.categories = c.data || [];
    state.brands = b.data || [];
  }
  async function loadProducts() {
    var q = sb.from('products').select(
      '*, category:categories(name), brand:brands(name), product_images(id,image_url,is_primary,display_order)'
    ).order('display_order');
    var cat = $('#fCat').value, br = $('#fBrand').value, st = $('#fStatus').value, term = $('#fSearch').value.trim();
    if (cat) q = q.eq('category_id', cat);
    if (br) q = q.eq('brand_id', br);
    if (st === 'active') q = q.eq('is_active', true);
    if (st === 'inactive') q = q.eq('is_active', false);
    if (st === 'featured') q = q.eq('is_featured', true);
    if (term) q = q.ilike('name', '%' + term + '%');
    var r = await q;
    if (r.error) { toast('Error al cargar: ' + r.error.message, 'err'); return; }
    state.products = r.data || [];
    renderList();
  }

  function primaryImg(p) {
    var imgs = p.product_images || [];
    var pr = imgs.find(function (i) { return i.is_primary; }) || imgs[0];
    return pr ? mediaUrl(pr.image_url) : '';
  }
  function mediaUrl(path) { return window.SOMAR_MEDIA_URL ? window.SOMAR_MEDIA_URL(path) : path; }

  // ---- render list ---------------------------------------------------
  function renderList() {
    var box = $('#rows');
    if (!state.products.length) { box.innerHTML = '<tr><td colspan="7"><div class="empty">No hay productos con esos filtros.</div></td></tr>'; return; }
    box.innerHTML = state.products.map(function (p) {
      var img = primaryImg(p);
      var thumb = img ? '<img src="' + esc(img) + '" alt="" style="width:46px;height:46px;object-fit:contain;border-radius:8px;background:var(--prod-bg)">'
                      : '<div style="width:46px;height:46px;border-radius:8px;background:var(--prod-bg)"></div>';
      var status = p.is_active ? '<span class="pill on">Activo</span>' : '<span class="pill off">Inactivo</span>';
      var low = p.stock <= 3 ? ' style="color:#b0433a;font-weight:800"' : '';
      return '<tr>' +
        '<td>' + thumb + '</td>' +
        '<td><div style="font-weight:700">' + esc(p.name) + '</div><div class="muted" style="font-size:12.5px">' + esc(p.slug) + '</div></td>' +
        '<td class="muted">' + esc((p.category && p.category.name) || '—') + '</td>' +
        '<td class="muted">' + esc((p.brand && p.brand.name) || '—') + '</td>' +
        '<td style="white-space:nowrap;font-weight:700">' + gs(p.price) + '</td>' +
        '<td' + low + '>' + p.stock + '</td>' +
        '<td>' + status +
          '<div class="actions">' +
          '<button data-act="edit" data-id="' + p.id + '">Editar</button>' +
          '<button data-act="toggle" data-id="' + p.id + '">' + (p.is_active ? 'Desactivar' : 'Activar') + '</button>' +
          '<button data-act="del" data-id="' + p.id + '" class="danger">Eliminar</button>' +
          '</div></td>' +
        '</tr>';
    }).join('');
  }

  // ---- form ----------------------------------------------------------
  function fillSelect(sel, items, value) {
    sel.innerHTML = '<option value="">— Seleccionar —</option>' + items.map(function (i) {
      return '<option value="' + i.id + '"' + (String(value) === String(i.id) ? ' selected' : '') + '>' + esc(i.name) + '</option>';
    }).join('');
  }

  function openForm(product) {
    state.editing = product || null;
    state.images = product ? (product.product_images || []).slice().sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); }) : [];
    state.removedImageIds = []; state.removedPaths = [];
    $('#formTitle').textContent = product ? 'Editar producto' : 'Nuevo producto';

    var f = document.forms.productForm;
    f.name.value = product ? (product.name || '') : '';
    f.slug.value = product ? (product.slug || '') : '';
    f.sku.value = product ? (product.sku || '') : '';
    fillSelect(f.category_id, state.categories, product ? product.category_id : '');
    fillSelect(f.brand_id, state.brands, product ? product.brand_id : '');
    f.color.value = product ? (product.color || '') : '';
    f.price.value = product ? (product.price || '') : '';
    f.previous_price.value = product && product.previous_price != null ? product.previous_price : '';
    f.stock.value = product ? (product.stock || 0) : 0;
    f.badge.value = product ? (product.badge || '') : '';
    f.is_active.checked = product ? !!product.is_active : true;
    f.is_featured.checked = product ? !!product.is_featured : false;
    f.is_best_seller.checked = product ? !!product.is_best_seller : false;
    f.is_new.checked = product ? !!product.is_new : false;
    f.short_description.value = product ? (product.short_description || '') : '';
    f.description.value = product ? (product.description || '') : '';
    f.installment_rate.value = product && product.installment_rate != null ? product.installment_rate : (cfg.defaultRate || 0.064);
    f.max_installments.value = product ? (product.max_installments || 12) : 12;
    f.warranty_months.value = product ? (product.warranty_months || '') : 12;

    renderImages();

    // Repeaters
    var feats = [], specs = [], inst = [];
    if (product) {
      feats = (product.product_features || []).slice().sort(so).map(function (x) { return x.feature; });
      specs = (product.product_specifications || []).slice().sort(so).map(function (x) { return { label: x.label, value: x.value }; });
      inst = (product.product_installments || []).map(function (x) { return { installments: x.installments, amount: x.amount }; });
    }
    if (!feats.length) feats = [''];
    if (!specs.length) specs = [{ label: '', value: '' }];
    renderFeatures(feats);
    renderSpecs(specs);
    renderInstallments(inst);

    $('#listView').style.display = 'none';
    $('#formView').style.display = 'block';
    window.scrollTo(0, 0);
  }
  function so(a, b) { return (a.display_order || 0) - (b.display_order || 0); }

  function closeForm() { $('#formView').style.display = 'none'; $('#listView').style.display = 'block'; }

  // Repeater: features
  function renderFeatures(list) {
    var box = $('#featBox'); box.innerHTML = '';
    list.forEach(function (v) { box.appendChild(featRow(v)); });
  }
  function featRow(v) {
    var row = el('div', { class: 'rep-row' });
    row.innerHTML = '<input type="text" placeholder="Ej: 6 kg de capacidad" value="' + esc(v) + '">' +
      '<button type="button" class="rep-del" title="Quitar">×</button>';
    row.querySelector('.rep-del').onclick = function () { row.remove(); };
    return row;
  }
  // Repeater: specs
  function renderSpecs(list) {
    var box = $('#specBox'); box.innerHTML = '';
    list.forEach(function (s) { box.appendChild(specRow(s)); });
  }
  function specRow(s) {
    var row = el('div', { class: 'rep-row two' });
    row.innerHTML = '<input type="text" placeholder="Etiqueta (Capacidad)" value="' + esc(s.label) + '">' +
      '<input type="text" placeholder="Valor (6 kg)" value="' + esc(s.value) + '">' +
      '<button type="button" class="rep-del" title="Quitar">×</button>';
    row.querySelector('.rep-del').onclick = function () { row.remove(); };
    return row;
  }
  // Repeater: installments
  function renderInstallments(list) {
    var box = $('#instBox'); box.innerHTML = '';
    list.forEach(function (i) { box.appendChild(instRow(i)); });
  }
  function instRow(i) {
    var row = el('div', { class: 'rep-row two' });
    row.innerHTML = '<input type="number" min="1" placeholder="Cuotas (6)" value="' + esc(i.installments) + '">' +
      '<input type="number" min="0" step="1000" placeholder="Monto (493000)" value="' + esc(i.amount) + '">' +
      '<button type="button" class="rep-del" title="Quitar">×</button>';
    row.querySelector('.rep-del').onclick = function () { row.remove(); };
    return row;
  }

  // Images (con eliminación de fondo por IA en el navegador) ----------
  var procQueue = [];      // cola serial de imágenes a procesar
  var procRunning = false;

  function renderImages() {
    var box = $('#imgBox'); box.innerHTML = '';
    state.images.forEach(function (im, idx) {
      var cls = 'img-card' + (im.is_primary ? ' primary' : '') +
        (im._status === 'processing' ? ' busy' : '') + (im._status === 'error' ? ' err' : '');
      var card = el('div', { class: cls });
      if (im._status === 'processing') {
        card.innerHTML =
          '<div class="img-proc">' +
            '<span class="img-spin"></span>' +
            '<span class="img-proc-t">' + esc(im._statusText || 'Procesando…') + '</span>' +
            (im._pct != null ? '<span class="img-proc-bar"><i style="width:' + im._pct + '%"></i></span>' : '') +
          '</div>' +
          '<div class="img-tools"><button type="button" data-i="' + idx + '" data-a="rm" title="Quitar">×</button></div>';
      } else if (im._status === 'error') {
        card.innerHTML =
          '<img src="' + esc(im._localUrl || mediaUrl(im.image_url)) + '" alt="" style="opacity:.45">' +
          '<div class="img-err">' +
            '<span class="img-err-t">No pudimos quitar el fondo</span>' +
            '<span class="img-err-a">' +
              '<button type="button" class="mini" data-i="' + idx + '" data-a="retry">Reintentar</button>' +
              '<button type="button" class="mini ghost" data-i="' + idx + '" data-a="useorig">Usar original</button>' +
            '</span>' +
          '</div>' +
          '<div class="img-tools"><button type="button" data-i="' + idx + '" data-a="rm" title="Quitar">×</button></div>';
      } else {
        var url = im._localUrl || mediaUrl(im.image_url);
        card.innerHTML = '<img src="' + esc(url) + '" alt="">' +
          '<div class="img-tools">' +
          '<button type="button" data-i="' + idx + '" data-a="primary" title="Principal">★</button>' +
          '<button type="button" data-i="' + idx + '" data-a="up" title="Subir">↑</button>' +
          '<button type="button" data-i="' + idx + '" data-a="down" title="Bajar">↓</button>' +
          (im._bgRemoved ? '<button type="button" data-i="' + idx + '" data-a="reproc" title="Volver a quitar fondo">⟲</button>' : '') +
          '<button type="button" data-i="' + idx + '" data-a="rm" title="Quitar">×</button>' +
          '</div>' +
          (im._bgRemoved ? '<span class="img-ok">✓ Fondo eliminado</span>' : '') +
          (im.is_primary ? '<span class="img-badge">Principal</span>' : '');
      }
      box.appendChild(card);
    });
    updateProcCount();
  }

  function updateProcCount() {
    var elp = $('#imgProc'); if (!elp) return;
    var doing = state.images.filter(function (x) { return x._status === 'processing'; }).length;
    var pending = doing + procQueue.length;
    if (pending > 0) { elp.style.display = 'flex'; elp.querySelector('span').textContent = 'Procesando imágenes… (' + pending + ' en cola)'; }
    else { elp.style.display = 'none'; }
  }

  function addFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) { toast('Formato no soportado. Usá JPG, PNG o WebP.', 'err'); return; }
      if (file.size > 15 * 1024 * 1024) { toast('Máximo 15MB por imagen.', 'err'); return; }
      var im = {
        id: null, _file: null, _localUrl: URL.createObjectURL(file), _originalFile: file,
        _status: 'processing', _statusText: 'Preparando imagen…', _pct: null, _bgRemoved: false,
        is_primary: state.images.length === 0, display_order: state.images.length
      };
      state.images.push(im);
      procQueue.push(im);
    });
    renderImages();
    runQueue();
  }

  async function runQueue() {
    if (procRunning) return;
    procRunning = true;
    while (procQueue.length) {
      var im = procQueue.shift();
      if (state.images.indexOf(im) < 0) continue;   // fue eliminado mientras esperaba
      await processOne(im);
    }
    procRunning = false;
    updateProcCount();
  }

  async function processOne(im) {
    im._status = 'processing'; im._statusText = 'Preparando imagen…'; im._pct = null; renderImages();
    if (!window.SOMAR_BG || !SOMAR_BG.isSupported()) { im._status = 'error'; renderImages(); return; }
    try {
      var res = await SOMAR_BG.removeImageBackground(im._originalFile, {
        onProgress: function (p) { im._statusText = p.text; im._pct = (p.pct != null ? p.pct : null); renderImages(); }
      });
      if (state.images.indexOf(im) < 0) { URL.revokeObjectURL(res.previewUrl); return; }  // eliminado durante el proceso
      if (im._localUrl) URL.revokeObjectURL(im._localUrl);
      im._file = res.file; im._localUrl = res.previewUrl; im._bgRemoved = true; im._status = 'ready';
      im._uploadedPath = null;   // cambió el archivo: hay que volver a subirlo
    } catch (err) {
      console.warn('[SOMAR] bg-removal falló:', err && (err.message || err));
      im._status = 'error';   // el original queda como fallback (Usar original)
    }
    renderImages();
  }

  function imgAction(idx, action) {
    var arr = state.images; var im = arr[idx]; if (!im) return;
    if (action === 'primary') { arr.forEach(function (x) { x.is_primary = false; }); im.is_primary = true; }
    else if (action === 'rm') {
      var rm = arr.splice(idx, 1)[0];
      if (rm) { if (rm._localUrl) { try { URL.revokeObjectURL(rm._localUrl); } catch (e) {} } if (rm.id) { state.removedImageIds.push(rm.id); if (rm.storage_path) state.removedPaths.push(rm.storage_path); } }
      if (!arr.some(function (x) { return x.is_primary; }) && arr[0]) arr[0].is_primary = true;
    }
    else if (action === 'up' && idx > 0) { var t = arr[idx - 1]; arr[idx - 1] = arr[idx]; arr[idx] = t; }
    else if (action === 'down' && idx < arr.length - 1) { var t2 = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = t2; }
    else if (action === 'retry' || action === 'reproc') { im._status = 'processing'; im._bgRemoved = false; procQueue.push(im); renderImages(); runQueue(); return; }
    else if (action === 'useorig') {
      if (im._localUrl) { try { URL.revokeObjectURL(im._localUrl); } catch (e) {} }
      im._file = im._originalFile; im._localUrl = URL.createObjectURL(im._originalFile);
      im._bgRemoved = false; im._status = 'ready';
      im._uploadedPath = null;   // cambió el archivo: hay que volver a subirlo
    }
    renderImages();
  }

  // ---- save ----------------------------------------------------------
  async function save(e) {
    e.preventDefault();
    var f = document.forms.productForm;
    var name = f.name.value.trim();
    if (!name) { toast('El nombre es obligatorio.', 'err'); return; }
    if (state.images.some(function (x) { return x._status === 'processing'; })) { toast('Esperá a que terminen de procesarse las imágenes.', 'err'); return; }
    if (state.images.some(function (x) { return x._status === 'error'; })) { toast('Hay imágenes con error: reintentá o elegí "Usar original".', 'err'); return; }
    var slug = f.slug.value.trim() || slugify(name);
    var payload = {
      name: name, slug: slug, sku: f.sku.value.trim() || null,
      category_id: f.category_id.value || null, brand_id: f.brand_id.value || null,
      color: f.color.value.trim() || null,
      price: Number(f.price.value || 0),
      previous_price: f.previous_price.value ? Number(f.previous_price.value) : null,
      stock: Number(f.stock.value || 0),
      badge: f.badge.value.trim() || null,
      is_active: f.is_active.checked, is_featured: f.is_featured.checked,
      is_best_seller: f.is_best_seller.checked, is_new: f.is_new.checked,
      short_description: f.short_description.value.trim() || null,
      description: f.description.value.trim() || null,
      installment_rate: f.installment_rate.value ? Number(f.installment_rate.value) : null,
      max_installments: Number(f.max_installments.value || 12),
      warranty_months: f.warranty_months.value ? Number(f.warranty_months.value) : null
    };
    var saveBtn = $('#saveBtn'); busy(saveBtn, true, 'Guardar producto');
    try {
      // Las imágenes se suben ANTES de tocar la base. Si la subida falla,
      // no queda un producto creado a medias que el admin vuelve a cargar
      // (y termina duplicado). El path no depende del id: usa el slug, que
      // ya se conoce acá.
      await uploadNewImages(slug);

      var id = state.editing ? state.editing.id : null;
      if (id) {
        var up = await sb.from('products').update(payload).eq('id', id);
        if (up.error) throw up.error;
      } else {
        var ins = await sb.from('products').insert(payload).select('id').single();
        if (ins.error) throw ins.error;
        id = ins.data.id;
      }

      // Hijos: features, specs, installments (borrar + reinsertar)
      await sb.from('product_features').delete().eq('product_id', id);
      var feats = collectFeatures(id);
      if (feats.length) { var rf = await sb.from('product_features').insert(feats); if (rf.error) throw rf.error; }

      await sb.from('product_specifications').delete().eq('product_id', id);
      var specs = collectSpecs(id);
      if (specs.length) { var rs = await sb.from('product_specifications').insert(specs); if (rs.error) throw rs.error; }

      await sb.from('product_installments').delete().eq('product_id', id);
      var inst = collectInstallments(id);
      if (inst.length) { var ri = await sb.from('product_installments').insert(inst); if (ri.error) throw ri.error; }

      // Imágenes: eliminar quitadas, subir nuevas, actualizar orden/principal
      if (state.removedImageIds.length) await sb.from('product_images').delete().in('id', state.removedImageIds);
      // Borrar también los archivos de Storage de las imágenes quitadas (evita huérfanos).
      if (state.removedPaths.length) {
        // No es crítico: si falla, solo quedan archivos huérfanos en el bucket.
        var del = await window.SOMAR_STORAGE.remove(state.removedPaths.slice());
        if (del.error) console.warn('[SOMAR] no se pudieron borrar archivos de Storage:', del.error.message);
        state.removedPaths = [];
      }
      await syncImages(id);

      toast(state.editing ? 'Producto actualizado.' : 'Producto creado.');
      closeForm();
      await loadProducts();
    } catch (err) {
      toast('No se pudo guardar: ' + (err.message || err), 'err');
    } finally {
      busy(saveBtn, false, 'Guardar producto');
    }
  }

  function collectFeatures(id) {
    return Array.prototype.map.call($('#featBox').querySelectorAll('input'), function (i) { return i.value.trim(); })
      .filter(Boolean).map(function (v, k) { return { product_id: id, feature: v, display_order: k }; });
  }
  function collectSpecs(id) {
    var out = [];
    Array.prototype.forEach.call($('#specBox').querySelectorAll('.rep-row'), function (row, k) {
      var ins = row.querySelectorAll('input');
      var label = ins[0].value.trim(), value = ins[1].value.trim();
      if (label && value) out.push({ product_id: id, label: label, value: value, display_order: k });
    });
    return out;
  }
  function collectInstallments(id) {
    var out = [], seen = {};
    Array.prototype.forEach.call($('#instBox').querySelectorAll('.rep-row'), function (row) {
      var ins = row.querySelectorAll('input');
      var n = parseInt(ins[0].value, 10), amount = Number(ins[1].value);
      if (n >= 1 && amount >= 0 && !seen[n]) { seen[n] = true; out.push({ product_id: id, installments: n, amount: amount }); }
    });
    return out;
  }

  // Sube a Storage las imágenes nuevas del formulario y deja el path en
  // im._uploadedPath. Se llama antes de escribir en la base.
  // Las que ya se subieron en un intento anterior se saltean, así un
  // reintento después de un error no deja copias huérfanas en el bucket.
  async function uploadNewImages(slug) {
    var folder = 'products/' + (slug || 'producto');
    var stamp = Date.now();
    for (var i = 0; i < state.images.length; i++) {
      var im = state.images[i];
      if (!im._file || im._uploadedPath) continue;
      var ext = (im._file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = folder + '/' + stamp + '-' + i + '.' + ext;
      var up = await window.SOMAR_STORAGE.upload(path, im._file);
      if (up.error) throw up.error;
      im._uploadedPath = (up.data && up.data.path) || path;
    }
  }

  // Escribe las filas de product_images. Las imágenes ya están en Storage.
  async function syncImages(productId) {
    for (var i = 0; i < state.images.length; i++) {
      var im = state.images[i];
      if (im._uploadedPath) {
        var rec = await sb.from('product_images').insert({
          product_id: productId, image_url: im._uploadedPath, storage_path: im._uploadedPath,
          is_primary: !!im.is_primary, display_order: i
        });
        if (rec.error) throw rec.error;
      } else if (im.id) {
        var upd = await sb.from('product_images').update({ is_primary: !!im.is_primary, display_order: i }).eq('id', im.id);
        if (upd.error) throw upd.error;
      }
    }
  }

  // ---- row actions ---------------------------------------------------
  async function onRowAction(act, id) {
    var p = state.products.find(function (x) { return String(x.id) === String(id); });
    if (act === 'edit') {
      // Traer datos completos (features/specs/installments) para editar
      var r = await sb.from('products').select(
        '*, product_images(id,image_url,storage_path,is_primary,display_order), product_features(feature,display_order),' +
        ' product_specifications(label,value,display_order), product_installments(installments,amount)'
      ).eq('id', id).single();
      if (r.error) { toast(r.error.message, 'err'); return; }
      openForm(r.data);
    } else if (act === 'toggle') {
      var u = await sb.from('products').update({ is_active: !p.is_active }).eq('id', id);
      if (u.error) toast(u.error.message, 'err'); else { toast(p.is_active ? 'Producto desactivado.' : 'Producto activado.'); loadProducts(); }
    } else if (act === 'del') {
      if (!confirm('¿Eliminar "' + p.name + '"? Esta acción no se puede deshacer.\n(Sugerencia: podés Desactivar en lugar de eliminar.)')) return;
      var d = await sb.from('products').delete().eq('id', id);
      if (d.error) toast(d.error.message, 'err'); else { toast('Producto eliminado.'); loadProducts(); }
    } else if (act === 'dup') {
      var src = await sb.from('products').select('*').eq('id', id).single();
      if (src.error) { toast(src.error.message, 'err'); return; }
      var copy = Object.assign({}, src.data);
      delete copy.id; delete copy.created_at; delete copy.updated_at;
      copy.name = copy.name + ' (copia)';
      copy.slug = slugify(copy.name) + '-' + Date.now().toString().slice(-4);
      copy.is_active = false;
      var c = await sb.from('products').insert(copy);
      if (c.error) toast(c.error.message, 'err'); else { toast('Producto duplicado (inactivo).'); loadProducts(); }
    }
  }

  // ---- wire ----------------------------------------------------------
  function wire() {
    fillSelect($('#fCat'), state.categories); $('#fCat').insertAdjacentHTML('afterbegin', '<option value="">Todas las categorías</option>');
    fillSelect($('#fBrand'), state.brands); $('#fBrand').insertAdjacentHTML('afterbegin', '<option value="">Todas las marcas</option>');

    var deb;
    $('#fSearch').addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(loadProducts, 300); });
    $('#fCat').addEventListener('change', loadProducts);
    $('#fBrand').addEventListener('change', loadProducts);
    $('#fStatus').addEventListener('change', loadProducts);
    $('#newBtn').addEventListener('click', function () { openForm(null); });
    $('#cancelBtn').addEventListener('click', closeForm);
    $('#backBtn').addEventListener('click', closeForm);

    $('#rows').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b) return;
      onRowAction(b.getAttribute('data-act'), b.getAttribute('data-id'));
    });

    // auto-slug al escribir nombre (si el slug está vacío o no fue tocado)
    var slugTouched = false;
    document.forms.productForm.slug.addEventListener('input', function () { slugTouched = true; });
    document.forms.productForm.name.addEventListener('input', function (e) {
      if (!slugTouched || !document.forms.productForm.slug.value) document.forms.productForm.slug.value = slugify(e.target.value);
    });

    $('#addFeat').addEventListener('click', function () { $('#featBox').appendChild(featRow('')); });
    $('#addSpec').addEventListener('click', function () { $('#specBox').appendChild(specRow({ label: '', value: '' })); });
    $('#addInst').addEventListener('click', function () { $('#instBox').appendChild(instRow({ installments: '', amount: '' })); });

    $('#imgInput').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    $('#imgBox').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      imgAction(parseInt(b.getAttribute('data-i'), 10), b.getAttribute('data-a'));
    });
    var drop = $('#imgDrop');
    ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    document.forms.productForm.addEventListener('submit', save);
    // El shell (sidebar + logout + burger) lo maneja /admin/js/nav.js.
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!(await AUTH.requireAdmin())) return;
    sb = AUTH.client();
    var me = AUTH.me();
    if (me) { $('#whoName').textContent = me.full_name || 'Administrador'; $('#whoAvatar').textContent = (me.full_name || 'S').charAt(0).toUpperCase(); }
    await loadRefs();
    wire();
    await loadProducts();
  });
})();
