/* =====================================================================
 *  SOMAR — Capa de acceso a datos (frontend público)
 *  Lee desde Supabase (schema somarelectrodomesticos) y transforma los
 *  registros al formato que ya usa la web (compatible con el P() actual).
 *  Expone window.SOMAR_DATA con métodos async.
 * ===================================================================== */
(function () {
  var sb = window.SOMAR_SB;
  var mediaUrl = window.SOMAR_MEDIA_URL || function (p) { return p; };

  function bySort(a, b) { return (a.display_order || 0) - (b.display_order || 0); }

  // --- Transforma un row de products (con embeds) al shape de la web ---
  function toProduct(r) {
    var imgs = (r.product_images || []).slice().sort(bySort);
    var primary = imgs.find(function (i) { return i.is_primary; }) || imgs[0];
    var feats = (r.product_features || []).slice().sort(bySort).map(function (f) { return f.feature; });
    var specs = (r.product_specifications || []).slice().sort(bySort)
      .map(function (s) { return { k: s.label, v: s.value }; });
    var cuotasFix = {};
    (r.product_installments || []).forEach(function (c) { cuotasFix[c.installments] = Number(c.amount); });
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      brand: (r.brand && r.brand.name) || '',
      category: (r.category && r.category.name) || '',
      color: r.color || 'Varios',
      price: Number(r.price),
      previousPrice: r.previous_price != null ? Number(r.previous_price) : null,
      badge: r.badge || null,
      stock: r.stock != null ? Number(r.stock) : 0,
      featured: !!r.is_featured,
      best: !!r.is_best_seller,
      isNew: !!r.is_new,
      description: r.description || '',
      features: feats,
      specs: specs,
      rate: r.installment_rate != null ? Number(r.installment_rate) : null,
      cuotasFix: cuotasFix,
      maxCuotas: r.max_installments || 12,
      warrantyMonths: r.warranty_months || null,
      image: primary ? mediaUrl(primary.image_url) : '',
      gallery: imgs.map(function (i) { return mediaUrl(i.image_url); })
    };
  }

  var PRODUCT_SELECT =
    '*, category:categories(name,slug), brand:brands(name,slug),' +
    ' product_images(image_url,is_primary,display_order),' +
    ' product_features(feature,display_order),' +
    ' product_specifications(label,value,display_order),' +
    ' product_installments(installments,amount)';

  var api = {
    ready: function () { return !!sb; },

    getSiteSettings: async function () {
      var r = await sb.from('site_settings').select('*').limit(1).maybeSingle();
      if (r.error) throw r.error;
      return r.data || null;
    },

    getCategories: async function () {
      var r = await sb.from('categories').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return r.data || [];
    },

    getBrands: async function () {
      var r = await sb.from('brands').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return r.data || [];
    },

    getProducts: async function () {
      var r = await sb.from('products').select(PRODUCT_SELECT)
        .eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return (r.data || []).map(toProduct);
    },

    getProductBySlug: async function (slug) {
      var r = await sb.from('products').select(PRODUCT_SELECT)
        .eq('slug', slug).eq('is_active', true).maybeSingle();
      if (r.error) throw r.error;
      return r.data ? toProduct(r.data) : null;
    },

    getBenefits: async function () {
      var r = await sb.from('benefits').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return r.data || [];
    },

    getPurchaseSteps: async function () {
      var r = await sb.from('purchase_steps').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return r.data || [];
    },

    getTestimonials: async function () {
      var r = await sb.from('testimonials').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return r.data || [];
    },

    getStats: async function () {
      var r = await sb.from('stats').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return r.data || [];
    },

    getSocialPosts: async function () {
      var r = await sb.from('social_posts').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      return (r.data || []).map(function (p) { return Object.assign({}, p, { image_url: mediaUrl(p.image_url) }); });
    },

    getBanners: async function () {
      var r = await sb.from('banners').select('*').eq('is_active', true).order('display_order');
      if (r.error) throw r.error;
      var out = {};
      (r.data || []).forEach(function (b) { out[b.type] = Object.assign({}, b, { image_url: mediaUrl(b.image_url) }); });
      return out; // { hero:{...}, featured_promotion:{...}, offers:{...}, about:{...} }
    },

    // Carga TODO en paralelo para el arranque de la página pública.
    getBootstrap: async function () {
      var res = await Promise.all([
        api.getSiteSettings(), api.getCategories(), api.getBrands(), api.getProducts(),
        api.getBenefits(), api.getPurchaseSteps(), api.getTestimonials(),
        api.getStats(), api.getSocialPosts(), api.getBanners()
      ]);
      return {
        settings: res[0], categories: res[1], brands: res[2], products: res[3],
        benefits: res[4], steps: res[5], testimonials: res[6],
        stats: res[7], social: res[8], banners: res[9]
      };
    }
  };

  window.SOMAR_DATA = api;
})();
