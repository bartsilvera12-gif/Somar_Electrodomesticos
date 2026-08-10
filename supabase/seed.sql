-- =====================================================================
--  SOMAR Electrodomésticos — SEED
--  Reconstruye el contenido ACTUAL del sitio (18 productos + contenido)
--  Ejecutar DESPUÉS de la migración 20260809_001_somarelectrodomestico.sql
--  Es re-ejecutable (limpia y vuelve a cargar).
-- =====================================================================
set search_path = somarelectrodomestico, public;

begin;

-- Limpieza (orden por dependencias; cascade cubre tablas hijas de products)
truncate table
  somarelectrodomestico.product_installments,
  somarelectrodomestico.product_specifications,
  somarelectrodomestico.product_features,
  somarelectrodomestico.product_images,
  somarelectrodomestico.products,
  somarelectrodomestico.categories,
  somarelectrodomestico.brands,
  somarelectrodomestico.benefits,
  somarelectrodomestico.purchase_steps,
  somarelectrodomestico.testimonials,
  somarelectrodomestico.stats,
  somarelectrodomestico.social_posts,
  somarelectrodomestico.banners,
  somarelectrodomestico.site_settings
  restart identity cascade;

-- ---------------------------------------------------------------------
--  SITE SETTINGS (singleton)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.site_settings
  (business_name, slogan, logo_url, whatsapp_primary, whatsapp_secondary,
   facebook_url, instagram_url, currency, currency_symbol,
   default_installment_rate, default_max_installments, low_stock_threshold,
   seo_title, seo_description, footer_text)
values
  ('SOMAR Electrodomésticos', 'Innovación y calidad', 'assets/somar-logo-oval.png',
   '595971244226', '595975515519',
   'https://facebook.com', 'https://instagram.com', 'PYG', 'Gs.',
   0.0640, 12, 3,
   'SOMAR Electrodomésticos — Tecnología para tu hogar',
   'Electrodomésticos, tecnología y productos para el hogar. Comprá fácil por WhatsApp.',
   'Desarrollado por NEURA');

-- ---------------------------------------------------------------------
--  CATEGORÍAS (icon + accent tomados de CATEGORY_STYLE)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.categories (name, slug, icon, accent_color, display_order, is_active) values
  ('Televisores','televisores','📺','#3A6EA5',1,true),
  ('Heladeras','heladeras','❄️','#2AA5B5',2,true),
  ('Cocinas','cocinas','🍳','#E8722A',3,true),
  ('Lavarropas','lavarropas','🫧','#2F8FD6',4,true),
  ('Aires acondicionados','aires-acondicionados','🌬️','#17A2B8',5,true),
  ('Celulares','celulares','📱','#6C5CE7',6,true),
  ('Pequeños electrodomésticos','pequenos-electrodomesticos','🔌','#E1477E',7,true),
  ('Muebles','muebles','🛋️','#9A5B3B',8,true),
  ('Hogar','hogar','🏠','#1D703A',9,true),
  ('Pesca','pesca','🎣','#0E9488',10,true),
  ('Belleza y Salud','belleza-y-salud','💅','#D6336C',11,true),
  ('Deportes','deportes','🚴','#F08C00',12,true),
  ('Herramientas','herramientas','🛠️','#E03131',13,true);

-- ---------------------------------------------------------------------
--  MARCAS
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.brands (name, slug, display_order, is_active) values
  ('JAM','jam',1,true),
  ('Tokyo','tokyo',2,true),
  ('Paraná','parana',3,true),
  ('Nacional','nacional',4,true),
  ('Armafácil','armafacil',5,true),
  ('Babyliss','babyliss',6,true),
  ('Aspen','aspen',7,true),
  ('Milano','milano',8,true),
  ('Ecopower','ecopower',9,true),
  ('Xiaomi','xiaomi',10,true),
  ('Arno','arno',11,true),
  ('Nappo','nappo',12,true),
  ('VCP','vcp',13,true),
  ('Kolke','kolke',14,true),
  ('Enxuta','enxuta',15,true);

-- ---------------------------------------------------------------------
--  PRODUCTOS (IDs 1..18 preservados)
--  category_id / brand_id se resuelven por slug.
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.products
  (id, slug, name, category_id, brand_id, color, description, price, previous_price,
   stock, badge, is_active, is_featured, is_best_seller, is_new, display_order,
   installment_rate, max_installments, warranty_months)
values
  (1,'lavarropas-jam-grace-6kg','Lavarropas Automático JAM Grace 6 kg',
    (select id from categories where slug='lavarropas'),(select id from brands where slug='jam'),'Blanco',
    'Lavarropas automático de carga frontal JAM Grace (modelo F-056B) con 6 kilos de capacidad. Práctico y eficiente, con múltiples programas para el lavado diario del hogar.',
    2270000,null,5,null,true,true,true,false,1,0.0640,12,12),
  (2,'horno-electrico-tokyo-listo-plus-56l','Horno Eléctrico Tokyo Listo Plus 56 L',
    (select id from categories where slug='cocinas'),(select id from brands where slug='tokyo'),'Negro',
    'Horno eléctrico Tokyo Listo Plus de 56 litros con control de temperatura, timer y selector de funciones. Ideal para hornear, gratinar y calentar con comodidad.',
    920000,null,8,null,true,true,true,false,2,0.0640,12,12),
  (3,'cocina-jam-estandar-4h-blanca','Cocina JAM Estándar 4 Hornallas Blanca',
    (select id from categories where slug='cocinas'),(select id from brands where slug='jam'),'Blanco',
    'Cocina JAM Estándar de 4 hornallas a gas, color blanco, con horno amplio y tapa de vidrio templado. Práctica y confiable para el uso diario del hogar.',
    813000,null,6,null,true,true,true,false,3,0.0640,12,12),
  (4,'sommier-parana-neo-pillow-negro','Sommier Paraná Neo Convencional c/ Pillow - Negro',
    (select id from categories where slug='muebles'),(select id from brands where slug='parana'),'Negro',
    'Sommier Paraná Neo convencional con pillow top, color negro. Incluye colchón y base (box) para un descanso firme y confortable.',
    1457000,null,5,null,true,true,true,false,4,0.0640,12,12),
  (5,'multiuso-2-puertas-esquinero-valijera','Multiuso 2 Puertas c/ Esquinero + Valijera',
    (select id from categories where slug='muebles'),(select id from brands where slug='nacional'),'Cerezo',
    'Ropero multiuso de 2 puertas con espejo, esquinero con estantes y valijera superior. Mucho espacio de guardado, ideal para el dormitorio.',
    1215000,null,4,null,true,true,true,false,5,0.0640,12,12),
  (6,'ventilador-tokyo-pie-fs50-20','Ventilador de Pie Tokyo FS50 20" 3 Velocidades - Negro',
    (select id from categories where slug='hogar'),(select id from brands where slug='tokyo'),'Negro',
    'Ventilador de pie Tokyo FS50 de 20 pulgadas, 3 velocidades, con base redonda y altura regulable. Color negro. Gran caudal de aire para ambientes amplios.',
    380000,null,10,null,true,true,true,false,6,0.0640,12,12),
  (7,'carpa-camping-automatica-3-4-personas','Carpa Camping Automática 3 a 4 Personas',
    (select id from categories where slug='pesca'),(select id from brands where slug='armafacil'),'Camuflado',
    'Carpa de camping automática (armado fácil) para 3 a 4 personas, diseño camuflado. Medidas 210 x 150 x 120 cm. Ideal para pesca, camping y salidas al aire libre.',
    230000,null,8,null,true,true,true,false,7,0.0640,12,12),
  (8,'secador-babyliss-pro-b6176hk-black-rose-gold','Secador de Pelo Babyliss PRO Nano Titanium B6176HK - Black Rose Gold',
    (select id from categories where slug='belleza-y-salud'),(select id from brands where slug='babyliss'),'Negro',
    'Secador de pelo profesional Babyliss PRO Nano Titanium, edición Black Rose Gold, de 2000 watts con motor AC de alto rendimiento. Secado rápido con cuidado del cabello.',
    495000,null,7,null,true,true,true,false,8,0.0640,12,12),
  (9,'nebulizador-aspen-piston-br-cn176','Nebulizador a Pistón Aspen Compact BR-CN176',
    (select id from categories where slug='belleza-y-salud'),(select id from brands where slug='aspen'),'Blanco',
    'Nebulizador a pistón Aspen Compact (BR-CN176): eficiente, durable y con bajo nivel de ruido. Autorizado por ANMAT. Ideal para tratamientos respiratorios en casa.',
    390000,null,10,null,true,true,true,false,9,0.0640,12,12),
  (10,'bicicleta-milano-torino-24-18v-naranja','Bicicleta Milano Torino 24" 18 Velocidades - Naranja',
    (select id from categories where slug='deportes'),(select id from brands where slug='milano'),'Naranja',
    'Bicicleta Milano Torino rodado 24", 18 velocidades, color naranja. Cuadro resistente con suspensión delantera, cambios y frenos confiables. Ideal para adolescentes y uso recreativo.',
    1034000,null,5,null,true,true,true,false,10,0.0640,12,12),
  (11,'juego-sillon-reposera-ratan-4-mesita','Juego de Sillones Reposera Ratán - 4 Sillones + Mesita',
    (select id from categories where slug='muebles'),(select id from brands where slug='nacional'),'Marrón',
    'Juego de living/jardín en ratán sintético: 4 sillones reposera apilables más mesita. Cómodo y elegante para patio, terraza o galería, apto para interior y exterior.',
    1285000,null,4,null,true,true,true,false,11,0.0640,12,12),
  (12,'radio-ecopower-am-fm-ep-f302','Radio Ecopower AM/FM EP-F302 Bluetooth 4 Bandas',
    (select id from categories where slug='pequenos-electrodomesticos'),(select id from brands where slug='ecopower'),'Rojo',
    'Radio Ecopower EP-F302 "Music Rabicho": 4 bandas (FM/AM/SW1-2), Bluetooth, reproductor USB/TF, linterna incorporada y batería recargable 18650. Con salida para auriculares.',
    120000,null,12,null,true,true,true,false,12,0.0640,8,12),
  (13,'telefono-redmi-15c-8-128','Teléfono Redmi 15C 8GB RAM 128GB',
    (select id from categories where slug='celulares'),(select id from brands where slug='xiaomi'),'Azul',
    'Redmi 15C con 8GB de RAM (4+4 con extensión) y 128GB de almacenamiento. Batería de 6000 mAh con carga rápida de 33W y pantalla de 6.9" a 120Hz.',
    1053000,null,10,'Nuevo',true,true,true,true,13,0.0640,12,12),
  (14,'licuadora-arno-power-mix-lq12-blanca','Licuadora Arno Power Mix LQ12 550W 2L - Blanca',
    (select id from categories where slug='pequenos-electrodomesticos'),(select id from brands where slug='arno'),'Blanco',
    'Licuadora Arno Power Mix LQ12 de 550W con jarra de 2 litros y 2 velocidades. Cuchillas Zelkrom de acero inoxidable ultradurables, con alto poder de corte. Color blanco.',
    227000,null,10,null,true,true,true,false,14,0.0640,10,12),
  (15,'aspiradora-nappo-wet-dry-nlai-156-20l','Aspiradora Nappo Wet & Dry NLAI-156 20 Litros',
    (select id from categories where slug='pequenos-electrodomesticos'),(select id from brands where slug='nappo'),'Acero',
    'Aspiradora Nappo NLAI-156 Wet & Dry: aspira polvo y líquidos, con tanque de acero inoxidable de 20 litros. Potente, con ruedas giratorias y accesorios incluidos.',
    766000,null,6,null,true,true,true,false,15,0.0640,12,12),
  (16,'compresor-vcp-50l-2hp','Compresor VCP 50 Litros 2HP',
    (select id from categories where slug='herramientas'),(select id from brands where slug='vcp'),'Negro',
    'Compresor de aire VCP de 50 litros con motor de 2HP y presión de 115 PSI / 8 bar. Con ruedas para traslado, manómetros y regulador. Ideal para taller, pintura e inflado.',
    930000,null,5,null,true,true,true,false,16,0.0640,12,12),
  (17,'barra-sonido-kolke-kpe-809-subwoofer','Barra de Sonido Kolke KPE-809 con Subwoofer 5.25"',
    (select id from categories where slug='pequenos-electrodomesticos'),(select id from brands where slug='kolke'),'Negro',
    'Barra de sonido Kolke KPE-809 con subwoofer de 5.25". Sonido envolvente para tu TV, con conexión Bluetooth y múltiples entradas. Ideal para películas y música.',
    740000,null,7,null,true,true,true,false,17,0.0640,12,12),
  (18,'heladera-enxuta-215-renx14-215-fhs','Heladera Enxuta 215 L RENX14-215 FHS - Blanca',
    (select id from categories where slug='heladeras'),(select id from brands where slug='enxuta'),'Blanco',
    'Heladera Enxuta RENX14-215 FHS de 215 litros con freezer superior, color blanco. Fabricada en Turquía. Amplia y eficiente para el hogar.',
    1722000,null,5,null,true,true,true,false,18,0.0640,12,12);

-- Reajustar la secuencia de IDs (para que los nuevos productos sean > 18)
select setval(pg_get_serial_sequence('somarelectrodomestico.products','id'),
              (select max(id) from somarelectrodomestico.products));

-- ---------------------------------------------------------------------
--  IMÁGENES (principal por producto)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.product_images (product_id, image_url, storage_path, is_primary, display_order)
select g.id, 'assets/prod-'||g.id||'.jpg', 'products/'||g.id||'/prod-'||g.id||'.jpg', true, 0
from generate_series(1,18) as g(id);

-- ---------------------------------------------------------------------
--  CARACTERÍSTICAS (features)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.product_features (product_id, feature, display_order) values
  (1,'6 kg de capacidad',0),(1,'Carga frontal',1),(1,'Múltiples programas de lavado',2),(1,'Panel con display digital',3),
  (2,'56 litros de capacidad',0),(2,'Control de temperatura',1),(2,'Timer con apagado automático',2),(2,'Incluye parrilla y bandeja',3),
  (3,'4 hornallas a gas',0),(3,'Horno amplio',1),(3,'Tapa de vidrio templado',2),(3,'Terminación blanca',3),
  (4,'Con pillow top',0),(4,'Colchón + base (box)',1),(4,'Tapizado negro',2),(4,'Estructura reforzada',3),
  (5,'2 puertas + espejo',0),(5,'Esquinero con estantes',1),(5,'Valijera superior',2),(5,'Cajones amplios',3),
  (6,'20 pulgadas',0),(6,'3 velocidades',1),(6,'Altura regulable',2),(6,'Base redonda estable',3),
  (7,'Armado automático',0),(7,'Capacidad 3 a 4 personas',1),(7,'Diseño camuflado',2),(7,'Incluye bolso de transporte',3),
  (8,'2000 watts',0),(8,'Motor AC profesional',1),(8,'Tecnología Nano Titanium',2),(8,'Edición Black Rose Gold',3),
  (9,'Compacto y eficiente',0),(9,'Bajo nivel de ruido',1),(9,'Autorizado ANMAT',2),(9,'Garantía 1 año',3),
  (10,'Rodado 24"',0),(10,'18 velocidades',1),(10,'Suspensión delantera',2),(10,'Color naranja',3),
  (11,'4 sillones + mesita',0),(11,'Ratán sintético',1),(11,'Apto interior/exterior',2),(11,'Estructura metálica reforzada',3),
  (12,'4 bandas FM/AM/SW1-2',0),(12,'Bluetooth + USB/TF',1),(12,'Linterna incorporada',2),(12,'Batería recargable 18650',3),
  (13,'8GB RAM (4+4) + 128GB',0),(13,'Batería 6000 mAh · 33W',1),(13,'Pantalla 6.9" 120Hz',2),(13,'Equipo nuevo',3),
  (14,'550 watts de potencia',0),(14,'Jarra de 2 litros',1),(14,'2 velocidades',2),(14,'Cuchillas Zelkrom acero inox',3),
  (15,'Aspira polvo y líquidos',0),(15,'Tanque acero inox 20 L',1),(15,'Ruedas giratorias 360°',2),(15,'Accesorios incluidos',3),
  (16,'Tanque de 50 litros',0),(16,'Motor 2HP',1),(16,'115 PSI / 8 bar',2),(16,'Con ruedas y manija',3),
  (17,'Subwoofer 5.25"',0),(17,'Sonido envolvente',1),(17,'Conexión Bluetooth',2),(17,'Ideal para TV / home theater',3),
  (18,'215 litros de capacidad',0),(18,'Freezer superior',1),(18,'Color blanco',2),(18,'Fabricada en Turquía',3);

-- ---------------------------------------------------------------------
--  ESPECIFICACIONES (label / value)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.product_specifications (product_id, label, value, display_order) values
  (1,'Capacidad','6 kg',0),(1,'Carga','Frontal',1),(1,'Modelo','Grace F-056B',2),(1,'Garantía','12 meses',3),
  (2,'Capacidad','56 litros',0),(2,'Tipo','Eléctrico de mesada',1),(2,'Funciones','Temperatura / timer',2),(2,'Garantía','12 meses',3),
  (3,'Hornallas','4',0),(3,'Tipo','A gas',1),(3,'Color','Blanco',2),(3,'Garantía','12 meses',3),
  (4,'Tipo','Sommier con pillow',0),(4,'Color','Negro',1),(4,'Incluye','Colchón + box',2),(4,'Garantía','12 meses',3),
  (5,'Puertas','2',0),(5,'Incluye','Esquinero + valijera',1),(5,'Espejo','Sí',2),(5,'Material','Madera',3),
  (6,'Aspas','20 pulgadas',0),(6,'Velocidades','3',1),(6,'Modelo','FS50',2),(6,'Color','Negro',3),
  (7,'Capacidad','3 a 4 personas',0),(7,'Medidas','210 x 150 x 120 cm',1),(7,'Armado','Automático',2),(7,'Diseño','Camuflado',3),
  (8,'Potencia','2000 W',0),(8,'Motor','AC profesional',1),(8,'Modelo','B6176HK',2),(8,'Tecnología','Nano Titanium',3),
  (9,'Tipo','A pistón',0),(9,'Modelo','BR-CN176',1),(9,'Nivel de ruido','Bajo',2),(9,'Garantía','12 meses',3),
  (10,'Rodado','24"',0),(10,'Velocidades','18',1),(10,'Suspensión','Delantera',2),(10,'Color','Naranja',3),
  (11,'Incluye','4 sillones + mesita',0),(11,'Material','Ratán sintético',1),(11,'Uso','Interior / exterior',2),(11,'Estructura','Metálica',3),
  (12,'Bandas','FM/AM/SW1-2',0),(12,'Conectividad','Bluetooth / USB / TF',1),(12,'Modelo','EP-F302',2),(12,'Batería','18650 recargable',3),
  (13,'RAM','8 GB (4+4)',0),(13,'Almacenamiento','128 GB',1),(13,'Batería','6000 mAh / 33W',2),(13,'Pantalla','6.9" 120Hz',3),
  (14,'Potencia','550 W',0),(14,'Capacidad','2 L (1,25 L útil)',1),(14,'Velocidades','2',2),(14,'Color','Blanco',3),
  (15,'Capacidad','20 litros',0),(15,'Tipo','Wet & Dry',1),(15,'Modelo','NLAI-156',2),(15,'Tanque','Acero inox',3),
  (16,'Tanque','50 litros',0),(16,'Motor','2 HP',1),(16,'Presión','115 PSI / 8 bar',2),(16,'Color','Negro',3),
  (17,'Subwoofer','5.25"',0),(17,'Modelo','KPE-809',1),(17,'Conexión','Bluetooth',2),(17,'Color','Negro',3),
  (18,'Capacidad','215 litros',0),(18,'Modelo','RENX14-215 FHS',1),(18,'Freezer','Superior',2),(18,'Color','Blanco',3);

-- ---------------------------------------------------------------------
--  CUOTAS (overrides específicos = cuotasFix del sitio actual)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.product_installments (product_id, installments, amount) values
  (1,6,493000),(1,12,277000),
  (2,6,199000),(2,12,112000),
  (3,6,177000),(3,8,138000),(3,10,114000),(3,12,99000),
  (4,6,316000),(4,8,246000),(4,10,204000),(4,12,178000),
  (5,6,264000),(5,8,206000),(5,10,171000),(5,12,148000),
  (6,6,83000),(6,8,65000),(6,10,54000),(6,12,47000),
  (7,6,50000),(7,8,39000),(7,10,33000),(7,12,28000),
  (8,6,108000),(8,8,84000),(8,10,70000),(8,12,61000),
  (9,6,85000),(9,8,66000),(9,10,55000),(9,12,48000),
  (10,6,225000),(10,8,175000),(10,10,145000),(10,12,126000),
  (11,6,278000),(11,8,217000),(11,10,179000),(11,12,157000),
  (12,6,25000),(12,8,20000),
  (13,6,229000),(13,8,178000),(13,10,148000),(13,12,129000),
  (14,6,50000),(14,10,25000),
  (15,6,166000),(15,8,130000),(15,10,108000),(15,12,94000),
  (16,6,202000),(16,8,157000),(16,10,131000),(16,12,114000),
  (17,6,161000),(17,8,125000),(17,10,104000),(17,12,91000),
  (18,6,374000),(18,8,259000),(18,10,242000),(18,12,210000);

-- ---------------------------------------------------------------------
--  BENEFICIOS
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.benefits (title, icon, display_order, is_active) values
  ('Productos de calidad','✓',1,true),
  ('Atención personalizada','✓',2,true),
  ('Compra fácil','✓',3,true),
  ('Asesoramiento','✓',4,true),
  ('Entregas coordinadas','✓',5,true),
  ('Atención por WhatsApp','✓',6,true);

-- ---------------------------------------------------------------------
--  PASOS DE COMPRA
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.purchase_steps (step_number, title, description, accent_color, display_order, is_active) values
  (1,'Elegí tu producto','Explorá el catálogo y guardá lo que te interesa en Mi pedido.','#1D703A',1,true),
  (2,'Consultanos por WhatsApp','Te respondemos con precio, stock y formas de pago.','#2F8FD6',2,true),
  (3,'Coordinamos tu compra','Acordamos entrega o retiro y listo.','#E8722A',3,true);

-- ---------------------------------------------------------------------
--  TESTIMONIOS
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.testimonials (customer_name, review, rating, display_order, is_active) values
  ('María G.','Compré mi heladera y me asesoraron en todo. La entrega fue rápida y en el horario acordado.',5,1,true),
  ('Carlos R.','Consulté por WhatsApp y en minutos tenía el precio y la disponibilidad. Muy práctico.',5,2,true),
  ('Lucía B.','Buenos precios y atención cercana. Volvería a comprar sin dudarlo.',4,3,true);

-- ---------------------------------------------------------------------
--  ESTADÍSTICAS
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.stats (value, label, display_order, is_active) values
  ('+8','Categorías',1,true),
  ('2','Líneas de atención',2,true),
  ('100%','Atención personalizada',3,true);

-- ---------------------------------------------------------------------
--  REDES / GALERÍA (misma selección que la grilla actual)
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.social_posts (platform, image_url, link_url, display_order, is_active) values
  ('instagram','assets/prod-10.jpg','https://instagram.com',1,true),
  ('instagram','assets/prod-11.jpg','https://instagram.com',2,true),
  ('instagram','assets/prod-4.jpg','https://instagram.com',3,true),
  ('instagram','assets/prod-7.jpg','https://instagram.com',4,true),
  ('instagram','assets/prod-3.jpg','https://instagram.com',5,true),
  ('instagram','assets/prod-6.jpg','https://instagram.com',6,true);

-- ---------------------------------------------------------------------
--  BANNERS / CONTENIDO PRINCIPAL
-- ---------------------------------------------------------------------
insert into somarelectrodomestico.banners (type, eyebrow, title, subtitle, image_url, cta_label, cta_url, theme, display_order, is_active) values
  ('hero','Tecnología para tu hogar','Todo lo que necesitás para hacer tu hogar mejor.',
   'Electrodomésticos, tecnología y calidad al mejor alcance.','assets/prod-1.jpg','Ver productos','#productos','light',1,true),
  ('featured_promotion','Promoción destacada','Equipá tu hogar con SOMAR',
   'Encontrá tecnología, comodidad y calidad en un solo lugar.','assets/prod-11.jpg','Descubrir productos','#productos','dark',2,true),
  ('offers','Tiempo limitado','HASTA 20% OFF',
   'Renová tu hogar. Promociones seleccionadas por tiempo limitado.',null,'Aprovechar ahora','#productos','green',3,true),
  ('about','Sobre SOMAR','Tecnología y calidad para tu hogar',
   'En SOMAR Electrodomésticos ofrecemos productos confiables y una atención cercana. Te acompañamos antes, durante y después de la compra para que elijas con seguridad.',
   'assets/prod-11.jpg',null,null,'light',4,true);

commit;

-- =====================================================================
--  FIN DEL SEED
-- =====================================================================
