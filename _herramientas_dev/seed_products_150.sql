-- ============================================================
-- SCRIPT DE POBLADO DE DATOS COMPLETO - FERRETERIA (POSTGRESQL)
-- ============================================================
-- Instrucciones:
-- 1. Ejecute este script en su base de datos PostgreSQL.
-- 2. Este script crea Categorias, Proveedores y Productos detallados.
-- 3. No deja campos nulos en la información principal.
-- ============================================================

-- 1. INSERTAR / ACTUALIZAR CATEGORIAS
INSERT INTO categories (id, name, description, parent_id) VALUES
(1, 'Ferretería General', 'Herramientas, tornillos y materiales de construcción civil', NULL),
(2, 'Pinturas y Acabados', 'Pinturas de caucho, esmalte, solventes y herramientas de pintura', NULL),
(3, 'Licores y Bebidas', 'Venta de licores nacionales e importados y refrescos', NULL),
(4, 'Minimarket', 'Víveres, alimentos no perecederos y artículos de primera necesidad', NULL),
(5, 'Hogar y Limpieza', 'Productos para el cuidado y mantenimiento del hogar', NULL),
(6, 'Automotriz', 'Lubricantes, aditivos y cosméticos para vehículos', NULL)
ON CONFLICT (id) DO UPDATE 
SET description = EXCLUDED.description,
    name = EXCLUDED.name;

-- 2. INSERTAR PROVEEDOR POR DEFECTO (Para evitar NULL en supplier_id)
INSERT INTO suppliers (id, name, contact_person, phone, email, address, notes, is_active, payment_terms, current_balance) VALUES
(1, 'Distribuidora General CA', 'Juan Perez', '0414-1234567', 'contacto@distribuidora.com', 'Zona Industrial Galpon 5', 'Proveedor por defecto para carga inicial', true, 30, 0.00)
ON CONFLICT (id) DO UPDATE 
SET name = 'Distribuidora General CA';

-- 3. INSERTAR PRODUCTOS (150 Items con todos los campos llenos)
-- Campos explicados:
-- profit_margin: 30% (típico)
-- price_mayor_1: Precio - 5%
-- price_mayor_2: Precio - 10%
-- location: Ubicación genérica 'Pasillo A'
-- supplier_id: 1 (El creado arriba)

INSERT INTO products (
    name, sku, description, price, cost_price, stock, min_stock, category_id, is_active, unit_type,
    price_mayor_1, price_mayor_2, profit_margin, location, supplier_id, is_box, conversion_factor
) VALUES

-- === FERRETERIA (50 Items) ===
('Martillo de Uña 16oz', 'FER-001', 'Martillo profesional con mango de madera tratado', 12.50, 8.00, 50, 5, 1, true, 'Unidad', 11.88, 11.25, 30.00, 'Pasillo 1', 1, false, 1),
('Destornillador Plano 6"', 'FER-002', 'Destornillador punta pala magnetica mango goma', 4.50, 2.50, 100, 10, 1, true, 'Unidad', 4.28, 4.05, 30.00, 'Pasillo 1', 1, false, 1),
('Destornillador Estrella 6"', 'FER-003', 'Destornillador punta estria magnetica mango goma', 4.50, 2.50, 100, 10, 1, true, 'Unidad', 4.28, 4.05, 30.00, 'Pasillo 1', 1, false, 1),
('Pinza de Electricista 8"', 'FER-004', 'Alicate universal con mango aislado 1000V', 15.00, 9.50, 30, 5, 1, true, 'Unidad', 14.25, 13.50, 30.00, 'Pasillo 1', 1, false, 1),
('Llave Ajustable 10"', 'FER-005', 'Llave inglesa cromada con escala de medida', 18.00, 11.00, 25, 3, 1, true, 'Unidad', 17.10, 16.20, 30.00, 'Pasillo 1', 1, false, 1),
('Juego Llaves Allen mm', 'FER-006', 'Juego comp_acto 9 piezas milimetricas', 8.50, 5.00, 40, 5, 1, true, 'Juego', 8.08, 7.65, 30.00, 'Pasillo 1', 1, false, 1),
('Cinta Metrica 5m', 'FER-007', 'Flexometro con freno y carcasa anti-impacto', 6.00, 3.50, 60, 10, 1, true, 'Unidad', 5.70, 5.40, 30.00, 'Pasillo 1', 1, false, 1),
('Taladro Percutor 500W', 'FER-008', 'Taladro 1/2 pulgada velocidad variable', 65.00, 45.00, 10, 2, 1, true, 'Unidad', 61.75, 58.50, 30.00, 'Vitrina 1', 1, false, 1),
('Disco de Corte 4.5" Metal', 'FER-009', 'Disco abrasivo para corte de metal fino', 1.50, 0.80, 200, 20, 1, true, 'Unidad', 1.43, 1.35, 30.00, 'Pasillo 1', 1, false, 1),
('Broca Concreto 1/4"', 'FER-010', 'Broca widia para pared standard', 1.20, 0.50, 150, 20, 1, true, 'Unidad', 1.14, 1.08, 30.00, 'Pasillo 1', 1, false, 1),
('Broca Concreto 3/8"', 'FER-011', 'Broca widia para pared reforzada', 1.80, 0.90, 150, 20, 1, true, 'Unidad', 1.71, 1.62, 30.00, 'Pasillo 1', 1, false, 1),
('Tornillo Drywall 6x1"', 'FER-012', 'Tornillo negro rosca fina caja 100u', 3.50, 1.80, 80, 10, 1, true, 'Caja', 3.33, 3.15, 30.00, 'Pasillo 2', 1, true, 100),
('Clavo Acero 2"', 'FER-013', 'Clavo de acero liso para concreto 1kg', 4.00, 2.50, 100, 15, 1, true, 'Bolsa', 3.80, 3.60, 30.00, 'Pasillo 2', 1, false, 1),
('Pegamento PVC 1/32', 'FER-014', 'Soldadura liquida para tuberia de agua', 3.50, 2.00, 40, 5, 1, true, 'Lata', 3.33, 3.15, 30.00, 'Pasillo 2', 1, false, 1),
('Tubo PVC 1/2" Presión', 'FER-015', 'Tuberia agua blanca 3 metros', 5.00, 3.20, 100, 20, 1, true, 'Tira', 4.75, 4.50, 30.00, 'Patio', 1, false, 1),
('Codo PVC 1/2"', 'FER-016', 'Conexion codo 90 grados agua blanca', 0.50, 0.20, 300, 50, 1, true, 'Unidad', 0.48, 0.45, 30.00, 'Pasillo 2', 1, false, 1),
('Tee PVC 1/2"', 'FER-017', 'Conexion Tee agua blanca', 0.60, 0.25, 300, 50, 1, true, 'Unidad', 0.57, 0.54, 30.00, 'Pasillo 2', 1, false, 1),
('Llave de Chorro 1/2"', 'FER-018', 'Llave de jardin bronce pesado', 6.50, 4.00, 50, 10, 1, true, 'Unidad', 6.18, 5.85, 30.00, 'Pasillo 2', 1, false, 1),
('Teflón Industrial 3/4"', 'FER-019', 'Cinta selladora de roscas 10mts', 0.80, 0.40, 200, 30, 1, true, 'Unidad', 0.76, 0.72, 30.00, 'Pasillo 2', 1, false, 1),
('Bombillo LED 9W', 'FER-020', 'Bombillo ahorrador luz fria rosca E27', 2.00, 1.10, 300, 50, 1, true, 'Unidad', 1.90, 1.80, 30.00, 'Mostrador', 1, false, 1),
('Bombillo LED 12W', 'FER-021', 'Bombillo ahorrador potente luz fria E27', 2.50, 1.40, 200, 40, 1, true, 'Unidad', 2.38, 2.25, 30.00, 'Mostrador', 1, false, 1),
('Socat Porcelana E27', 'FER-022', 'Base para bombillo techo ceramica', 1.50, 0.90, 100, 20, 1, true, 'Unidad', 1.43, 1.35, 30.00, 'Pasillo 3', 1, false, 1),
('Cable THW #12 Rojo', 'FER-023', 'Cable electricidad multifilar 100% cobre', 45.00, 35.00, 10, 2, 1, true, 'Rollo', 42.75, 40.50, 30.00, 'Almacen', 1, false, 1),
('Cable THW #12 Negro', 'FER-024', 'Cable electricidad multifilar 100% cobre', 45.00, 35.00, 10, 2, 1, true, 'Rollo', 42.75, 40.50, 30.00, 'Almacen', 1, false, 1),
('Tomacorriente Doble', 'FER-025', 'Toma 110v doble con tierra blanco', 3.50, 2.10, 80, 15, 1, true, 'Unidad', 3.33, 3.15, 30.00, 'Pasillo 3', 1, false, 1),
('Interruptor Sencillo', 'FER-026', 'Apagador sencillo superficial blanco', 2.50, 1.50, 80, 15, 1, true, 'Unidad', 2.38, 2.25, 30.00, 'Pasillo 3', 1, false, 1),
('Caja Metalica 4x4', 'FER-027', 'Cajetin cuadrado para empotrar electricidad', 0.90, 0.50, 150, 30, 1, true, 'Unidad', 0.86, 0.81, 30.00, 'Pasillo 3', 1, false, 1),
('Tipe (Cinta Electrica)', 'FER-028', 'Cinta aislante negra 3M 18mts', 1.50, 0.70, 200, 40, 1, true, 'Unidad', 1.43, 1.35, 30.00, 'Pasillo 3', 1, false, 1),
('Candado Hierro 40mm', 'FER-029', 'Candado seguridad arco normal', 5.00, 3.00, 60, 10, 1, true, 'Unidad', 4.75, 4.50, 30.00, 'Pasillo 1', 1, false, 1),
('Candado Hierro 50mm', 'FER-030', 'Candado seguridad pesado', 7.50, 4.50, 40, 10, 1, true, 'Unidad', 7.13, 6.75, 30.00, 'Pasillo 1', 1, false, 1),
('Cadena 1/4"', 'FER-031', 'Cadena galvanizada eslabon corto', 3.00, 1.80, 100, 20, 1, true, 'Metro', 2.85, 2.70, 30.00, 'Pasillo 4', 1, false, 1),
('Pala Punta Cuadrada', 'FER-032', 'Pala construccion con cabo madera', 14.00, 9.00, 20, 5, 1, true, 'Unidad', 13.30, 12.60, 30.00, 'Patio', 1, false, 1),
('Pico con Mango', 'FER-033', 'Pico 5lbs con cabo madera reforzado', 18.00, 12.00, 15, 3, 1, true, 'Unidad', 17.10, 16.20, 30.00, 'Patio', 1, false, 1),
('Carretilla 60L', 'FER-034', 'Carretilla concretera rueda neumatica', 65.00, 48.00, 5, 2, 1, true, 'Unidad', 61.75, 58.50, 30.00, 'Patio', 1, false, 1),
('Guantes de Carnaza', 'FER-035', 'Guantes trabajo pesado soldador', 2.50, 1.50, 100, 20, 1, true, 'Par', 2.38, 2.25, 30.00, 'Pasillo 1', 1, false, 1),
('Lentes de Seguridad', 'FER-036', 'Lentes policarbonato proteccion UV', 3.00, 1.20, 50, 10, 1, true, 'Unidad', 2.85, 2.70, 30.00, 'Pasillo 1', 1, false, 1),
('Casco Seguridad Amarillo', 'FER-037', 'Casco obra con ratchet ajustable', 6.00, 3.50, 20, 5, 1, true, 'Unidad', 5.70, 5.40, 30.00, 'Pasillo 1', 1, false, 1),
('Silicon Transparente', 'FER-038', 'Cartucho silicona anti-hongos 280ml', 4.50, 2.80, 40, 10, 1, true, 'Unidad', 4.28, 4.05, 30.00, 'Pasillo 2', 1, false, 1),
('Espuma Expansiva', 'FER-039', 'Espuma poliuretano relleno grietas', 7.00, 4.50, 20, 5, 1, true, 'Unidad', 6.65, 6.30, 30.00, 'Pasillo 2', 1, false, 1),
('WD-40 8oz', 'FER-040', 'Aceite penetrante multiuso spray', 6.50, 4.20, 50, 10, 1, true, 'Unidad', 6.18, 5.85, 30.00, 'Pasillo 2', 1, false, 1),
('Manguera Jardin 1/2"', 'FER-041', 'Manguera riego reforzada verde 15mts', 12.00, 8.00, 15, 5, 1, true, 'Rollo', 11.40, 10.80, 30.00, 'Patio', 1, false, 1),
('Pistola Manguera', 'FER-042', 'Boquilla bano chorro ajustable', 3.50, 2.00, 30, 5, 1, true, 'Unidad', 3.33, 3.15, 30.00, 'Patio', 1, false, 1),
('Rastrillo Plastico', 'FER-043', 'Escoba para grama 22 dientes', 4.00, 2.50, 20, 5, 1, true, 'Unidad', 3.80, 3.60, 30.00, 'Patio', 1, false, 1),
('Machete 18"', 'FER-044', 'Machete rula marca bellota', 5.50, 3.50, 25, 5, 1, true, 'Unidad', 5.23, 4.95, 30.00, 'Pasillo 4', 1, false, 1),
('Lima Plana 8"', 'FER-045', 'Lima metalica grano bastardo', 4.50, 2.80, 20, 5, 1, true, 'Unidad', 4.28, 4.05, 30.00, 'Pasillo 1', 1, false, 1),
('Nivel Torpedo 9"', 'FER-046', 'Nivel magnetico 3 burbujas', 3.50, 2.00, 30, 5, 1, true, 'Unidad', 3.33, 3.15, 30.00, 'Pasillo 1', 1, false, 1),
('Escuadra Metalica 12"', 'FER-047', 'Escuadra carpinteria acero', 4.00, 2.50, 20, 5, 1, true, 'Unidad', 3.80, 3.60, 30.00, 'Pasillo 1', 1, false, 1),
('Formon 1/2"', 'FER-048', 'Herramienta tallado madera', 3.50, 2.00, 20, 5, 1, true, 'Unidad', 3.33, 3.15, 30.00, 'Pasillo 1', 1, false, 1),
('Serrucho 18"', 'FER-049', 'Serrucho carpintero diente templado', 8.00, 5.00, 15, 5, 1, true, 'Unidad', 7.60, 7.20, 30.00, 'Pasillo 4', 1, false, 1),
('Arco de Segueta', 'FER-050', 'Arco tubular ajustable con hoja', 7.50, 4.50, 20, 5, 1, true, 'Unidad', 7.13, 6.75, 30.00, 'Pasillo 1', 1, false, 1),

-- === PINTURAS (20 Items) ===
('Pintura Caucho Bco Cñte', 'PIN-001', 'Pintura clase A mate interior/exterior 4gal', 15.00, 11.00, 40, 10, 2, true, 'Galon', 14.25, 13.50, 30.00, 'Pasillo 5', 1, false, 1),
('Pintura Caucho Bco Cñte', 'PIN-002', 'Pintura clase C mate cuñete 4gal', 60.00, 48.00, 15, 5, 2, true, 'Cuñete', 57.00, 54.00, 30.00, 'Almacen', 1, false, 1),
('Pintura Esmalte Blanco', 'PIN-003', 'Esmalte sintetico brillante secado rapido', 28.00, 20.00, 20, 5, 2, true, 'Galon', 26.60, 25.20, 30.00, 'Pasillo 5', 1, false, 1),
('Pintura Esmalte Negro', 'PIN-004', 'Esmalte sintetico brillante metal', 28.00, 20.00, 20, 5, 2, true, 'Galon', 26.60, 25.20, 30.00, 'Pasillo 5', 1, false, 1),
('Fondo Herreria Gris', 'PIN-005', 'Fondo anticorrosivo industrial', 22.00, 16.00, 15, 5, 2, true, 'Galon', 20.90, 19.80, 30.00, 'Pasillo 5', 1, false, 1),
('Brocha 1"', 'PIN-006', 'Brocha cerdas naturales mango madera', 1.00, 0.60, 100, 20, 2, true, 'Unidad', 0.95, 0.90, 30.00, 'Pasillo 5', 1, false, 1),
('Brocha 2"', 'PIN-007', 'Brocha cerdas naturales mango madera', 1.80, 1.10, 100, 20, 2, true, 'Unidad', 1.71, 1.62, 30.00, 'Pasillo 5', 1, false, 1),
('Brocha 4"', 'PIN-008', 'Brocha cerdas naturales mango madera', 3.50, 2.20, 50, 10, 2, true, 'Unidad', 3.33, 3.15, 30.00, 'Pasillo 5', 1, false, 1),
('Rodillo Felpa 9"', 'PIN-009', 'Rodillo antigota con manillar y bandeja', 4.50, 2.80, 60, 10, 2, true, 'Unidad', 4.28, 4.05, 30.00, 'Pasillo 5', 1, false, 1),
('Repuesto Rodillo 9"', 'PIN-010', 'Felpa repuesto rodillo antigota', 2.50, 1.50, 80, 20, 2, true, 'Unidad', 2.38, 2.25, 30.00, 'Pasillo 5', 1, false, 1),
('Bandeja Pintura', 'PIN-011', 'Bandeja plastica negra para rodillo', 2.00, 1.10, 50, 10, 2, true, 'Unidad', 1.90, 1.80, 30.00, 'Pasillo 5', 1, false, 1),
('Thinner Acrilico', 'PIN-012', 'Disolvente para pinturas esmalte', 12.00, 8.50, 30, 5, 2, true, 'Galon', 11.40, 10.80, 30.00, 'Pasillo 5', 1, false, 1),
('Solvente Mineral', 'PIN-013', 'Aguarras para limpieza de brochas', 3.50, 2.00, 40, 10, 2, true, 'Litro', 3.33, 3.15, 30.00, 'Pasillo 5', 1, false, 1),
('Lija Agua #80', 'PIN-014', 'Papel de lija grano grueso', 0.50, 0.25, 200, 50, 2, true, 'Hoja', 0.48, 0.45, 30.00, 'Mostrador', 1, false, 1),
('Lija Agua #120', 'PIN-015', 'Papel de lija grano medio', 0.50, 0.25, 200, 50, 2, true, 'Hoja', 0.48, 0.45, 30.00, 'Mostrador', 1, false, 1),
('Lija Agua #180', 'PIN-016', 'Papel de lija grano fino', 0.50, 0.25, 200, 50, 2, true, 'Hoja', 0.48, 0.45, 30.00, 'Mostrador', 1, false, 1),
('Espatula 2"', 'PIN-017', 'Espatula metalica flexible', 1.50, 0.90, 40, 10, 2, true, 'Unidad', 1.43, 1.35, 30.00, 'Pasillo 5', 1, false, 1),
('Espatula 4"', 'PIN-018', 'Espatula metalica flexible ancha', 2.50, 1.40, 40, 10, 2, true, 'Unidad', 2.38, 2.25, 30.00, 'Pasillo 5', 1, false, 1),
('Cinta Tirro 3/4"', 'PIN-019', 'Cinta enmascarar uso general', 1.80, 1.00, 100, 20, 2, true, 'Unidad', 1.71, 1.62, 30.00, 'Pasillo 5', 1, false, 1),
('Pasta Profesional', 'PIN-020', 'Masilla para encamisar paredes', 12.00, 8.00, 25, 5, 2, true, 'Galon', 11.40, 10.80, 30.00, 'Pasillo 5', 1, false, 1),

-- === LICORES (30 Items) ===
('Cerveza Polar Pilsen 0.70', 'LIC-001', 'Caja retornable 12 botellas 0.70L', 22.00, 18.00, 50, 10, 3, true, 'Caja', 20.90, 19.80, 30.00, 'Deposito', 1, false, 12),
('Cerveza Polar Light 0.70', 'LIC-002', 'Caja retornable 12 botellas 0.70L', 22.00, 18.00, 50, 10, 3, true, 'Caja', 20.90, 19.80, 30.00, 'Deposito', 1, false, 12),
('Cerveza Solera Verde 0.70', 'LIC-003', 'Caja retornable 12 botellas 0.70L', 24.00, 19.50, 40, 10, 3, true, 'Caja', 22.80, 21.60, 30.00, 'Deposito', 1, false, 12),
('Cerveza Solera Azul 0.70', 'LIC-004', 'Caja retornable 12 botellas 0.70L', 24.00, 19.50, 40, 10, 3, true, 'Caja', 22.80, 21.60, 30.00, 'Deposito', 1, false, 12),
('Santa Teresa Gran Rva', 'LIC-005', 'Ron Añejo botella vidrio 0.70L', 16.00, 12.50, 30, 5, 3, true, 'Botella', 15.20, 14.40, 30.00, 'Estante Licores', 1, false, 1),
('Ron Cacique Añejo', 'LIC-006', 'Ron Añejo botella vidrio 0.70L', 14.50, 11.00, 30, 5, 3, true, 'Botella', 13.78, 13.05, 30.00, 'Estante Licores', 1, false, 1),
('Ron Pampero Aniversario', 'LIC-007', 'Ron Premium reserva exclusiva', 35.00, 28.00, 15, 3, 3, true, 'Botella', 33.25, 31.50, 30.00, 'Estante Licores', 1, false, 1),
('Whisky Buchanans 12', 'LIC-008', 'Scotch Whisky 12 years 0.75L', 38.00, 32.00, 20, 5, 3, true, 'Botella', 36.10, 34.20, 30.00, 'Estante Licores', 1, false, 1),
('Whisky Old Parr 12', 'LIC-009', 'Scotch Whisky 12 years 0.75L', 40.00, 34.00, 20, 5, 3, true, 'Botella', 38.00, 36.00, 30.00, 'Estante Licores', 1, false, 1),
('Whisky Something Special', 'LIC-010', 'Scotch Whisky Standard 0.75L', 18.00, 14.00, 25, 5, 3, true, 'Botella', 17.10, 16.20, 30.00, 'Estante Licores', 1, false, 1),
('Vodka Gordons', 'LIC-011', 'Vodka nacional botella 0.70L', 10.00, 7.50, 30, 5, 3, true, 'Botella', 9.50, 9.00, 30.00, 'Estante Licores', 1, false, 1),
('Ginebra Gordons', 'LIC-012', 'Ginebra seca nacional botella 0.70L', 12.00, 9.00, 20, 5, 3, true, 'Botella', 11.40, 10.80, 30.00, 'Estante Licores', 1, false, 1),
('Vino Tinto Gato Negro', 'LIC-013', 'Vino chileno Cabernet Sauvignon', 9.00, 6.50, 30, 5, 3, true, 'Botella', 8.55, 8.10, 30.00, 'Estante Licores', 1, false, 1),
('Vino Blanco Gato Negro', 'LIC-014', 'Vino chileno Sauvignon Blanc', 9.00, 6.50, 25, 5, 3, true, 'Botella', 8.55, 8.10, 30.00, 'Estante Licores', 1, false, 1),
('Sangria Caroreña Tinta', 'LIC-015', 'Sangria nacional botella vidrio 1.75L', 9.50, 7.00, 40, 10, 3, true, 'Botella', 9.03, 8.55, 30.00, 'Estante Licores', 1, false, 1),
('Sangria Caroreña Blanca', 'LIC-016', 'Sangria nacional botella vidrio 1.75L', 9.50, 7.00, 30, 5, 3, true, 'Botella', 9.03, 8.55, 30.00, 'Estante Licores', 1, false, 1),
('Coca Cola 2L', 'LIC-017', 'Refresco cola negra 2 litros', 2.50, 1.80, 100, 20, 3, true, 'Botella', 2.38, 2.25, 30.00, 'Nevera 1', 1, false, 1),
('Pepsi 2L', 'LIC-018', 'Refresco cola negra 2 litros', 2.30, 1.70, 80, 20, 3, true, 'Botella', 2.19, 2.07, 30.00, 'Nevera 1', 1, false, 1),
('Chinotto 2L', 'LIC-019', 'Refresco limon 2 litros', 2.30, 1.70, 60, 15, 3, true, 'Botella', 2.19, 2.07, 30.00, 'Nevera 1', 1, false, 1),
('Agua Mineral 5L', 'LIC-020', 'Agua potable botellon 5 litros', 2.00, 1.20, 50, 10, 3, true, 'Botella', 1.90, 1.80, 30.00, 'Pasillo Bebidas', 1, false, 1),
('Agua Mineral 1.5L', 'LIC-021', 'Pack agua mineral 12 unidades', 8.00, 5.50, 30, 5, 3, true, 'Pack', 7.60, 7.20, 30.00, 'Pasillo Bebidas', 1, true, 12),
('Jugo Naranja 1L', 'LIC-022', 'Jugo pasteurizado larga duracion', 2.50, 1.80, 40, 10, 3, true, 'Carton', 2.38, 2.25, 30.00, 'Nevera 2', 1, false, 1),
('Jugo Manzana 1L', 'LIC-023', 'Jugo pasteurizado larga duracion', 2.50, 1.80, 30, 10, 3, true, 'Carton', 2.38, 2.25, 30.00, 'Nevera 2', 1, false, 1),
('Energizante Monster', 'LIC-024', 'Bebida energetica lata grande', 2.50, 1.60, 60, 15, 3, true, 'Lata', 2.38, 2.25, 30.00, 'Nevera 2', 1, false, 1),
('Energizante RedBull', 'LIC-025', 'Bebida energetica lata pequeña', 2.00, 1.30, 60, 15, 3, true, 'Lata', 1.90, 1.80, 30.00, 'Nevera 2', 1, false, 1),
('Hielo Bolsa 5kg', 'LIC-026', 'Bolsa de hielo cubito grande', 3.00, 1.50, 20, 5, 3, true, 'Bolsa', 2.85, 2.70, 30.00, 'Congelador', 1, false, 1),
('Vasos Plasticos 12oz', 'LIC-027', 'Paquete vasos desechables 50u', 2.50, 1.50, 40, 10, 3, true, 'Paquete', 2.38, 2.25, 30.00, 'Estante Plastico', 1, false, 50),
('Servilletas Coctel', 'LIC-028', 'Caja servilletas blancas pequeña', 1.00, 0.60, 50, 10, 3, true, 'Caja', 0.95, 0.90, 30.00, 'Estante Plastico', 1, false, 1),
('Pitillos/Pajillas', 'LIC-029', 'Caja pitillos negros 100u', 1.50, 0.80, 30, 5, 3, true, 'Caja', 1.43, 1.35, 30.00, 'Estante Plastico', 1, false, 100),
('Agua Tonica Lata', 'LIC-030', 'Six pack agua quina lata', 5.00, 3.50, 20, 5, 3, true, 'Pack', 4.75, 4.50, 30.00, 'Pasillo Bebidas', 1, true, 6),

-- === MINIMARKET (30 Items) ===
('Harina Pan 1kg', 'MKT-001', 'Harina de maiz blanco precocida', 1.20, 0.95, 200, 50, 4, true, 'Paquete', 1.14, 1.08, 30.00, 'Estante Viveres', 1, false, 1),
('Arroz Blanco 1kg', 'MKT-002', 'Arroz de mesa grano entero tipo I', 1.10, 0.85, 200, 50, 4, true, 'Paquete', 1.05, 0.99, 30.00, 'Estante Viveres', 1, false, 1),
('Pasta Espagueti 1kg', 'MKT-003', 'Pasta larga semola de trigo durum', 1.50, 1.10, 150, 40, 4, true, 'Paquete', 1.43, 1.35, 30.00, 'Estante Viveres', 1, false, 1),
('Pasta Corta 1kg', 'MKT-004', 'Pasta corta tornillo o pluma', 1.50, 1.10, 150, 40, 4, true, 'Paquete', 1.43, 1.35, 30.00, 'Estante Viveres', 1, false, 1),
('Aceite Vegetal 1L', 'MKT-005', 'Aceite comestible mezcla vegetal', 2.50, 1.90, 100, 25, 4, true, 'Botella', 2.38, 2.25, 30.00, 'Estante Viveres', 1, false, 1),
('Margarina 500g', 'MKT-006', 'Margarina con sal envase plastico', 2.20, 1.70, 60, 15, 4, true, 'Tina', 2.09, 1.98, 30.00, 'Nevera Charcuteria', 1, false, 1),
('Mayonesa 445g', 'MKT-007', 'Salsa mayonesa envase flexible', 2.80, 2.10, 50, 15, 4, true, 'Unidad', 2.66, 2.52, 30.00, 'Estante Salsas', 1, false, 1),
('Salsa Tomate 397g', 'MKT-008', 'Ketchup tradicional botella vidrio', 2.00, 1.50, 50, 15, 4, true, 'Unidad', 1.90, 1.80, 30.00, 'Estante Salsas', 1, false, 1),
('Atun en Lata 170g', 'MKT-009', 'Lomo de atun en aceite vegetal', 1.50, 1.10, 80, 20, 4, true, 'Lata', 1.43, 1.35, 30.00, 'Estante Enlatados', 1, false, 1),
('Sardinas Lata 170g', 'MKT-010', 'Sardinas en salsa de tomate', 0.90, 0.60, 80, 20, 4, true, 'Lata', 0.86, 0.81, 30.00, 'Estante Enlatados', 1, false, 1),
('Azucar Montalban 1kg', 'MKT-011', 'Azucar blanca refinada', 1.40, 1.10, 150, 40, 4, true, 'Paquete', 1.33, 1.26, 30.00, 'Estante Viveres', 1, false, 1),
('Sal Molida 1kg', 'MKT-012', 'Sal de mesa con fluor', 0.80, 0.40, 100, 20, 4, true, 'Paquete', 0.76, 0.72, 30.00, 'Estante Viveres', 1, false, 1),
('Cafe Molido 200g', 'MKT-013', 'Cafe tostado molido gourmet', 3.50, 2.70, 60, 15, 4, true, 'Paquete', 3.33, 3.15, 30.00, 'Estante Cafe', 1, false, 1),
('Cafe Molido 500g', 'MKT-014', 'Cafe tostado familia paquete grande', 7.50, 5.80, 40, 10, 4, true, 'Paquete', 7.13, 6.75, 30.00, 'Estante Cafe', 1, false, 1),
('Leche en Polvo 1kg', 'MKT-015', 'Leche completa enriquecida', 9.00, 7.20, 50, 10, 4, true, 'Bolsa', 8.55, 8.10, 30.00, 'Estante Viveres', 1, false, 1),
('Galletas Maria Tubo', 'MKT-016', 'Galletas dulces tradicionales', 1.20, 0.80, 80, 20, 4, true, 'Paquete', 1.14, 1.08, 30.00, 'Estante Galletas', 1, false, 1),
('Galletas Soda Tubo', 'MKT-017', 'Galletas tipo cracker saladas', 1.20, 0.80, 80, 20, 4, true, 'Paquete', 1.14, 1.08, 30.00, 'Estante Galletas', 1, false, 1),
('Oreo Tubo', 'MKT-018', 'Galleta sandwich chocolate y crema', 1.50, 1.00, 60, 15, 4, true, 'Paquete', 1.43, 1.35, 30.00, 'Estante Galletas', 1, false, 1),
('Pepito Pequeño', 'MKT-019', 'Snack de maiz horneado queso', 0.50, 0.30, 100, 30, 4, true, 'Bolsa', 0.48, 0.45, 30.00, 'Exhibidor Snacks', 1, false, 1),
('Doritos Pequeño', 'MKT-020', 'Tortilla chip sabor mega queso', 0.60, 0.35, 100, 30, 4, true, 'Bolsa', 0.57, 0.54, 30.00, 'Exhibidor Snacks', 1, false, 1),
('Chocolate Savoy Leche', 'MKT-021', 'Barra de chocolate con leche 130g', 2.50, 1.80, 50, 15, 4, true, 'Unidad', 2.38, 2.25, 30.00, 'Caja Registradora', 1, false, 1),
('Chupetas BonBonBum', 'MKT-022', 'Bolsa de chupetas surtidas 24u', 3.50, 2.20, 40, 10, 4, true, 'Bolsa', 3.33, 3.15, 30.00, 'Caja Registradora', 1, false, 24),
('Refresco en Polvo', 'MKT-023', 'Bebida instantanea sobre rinde 1.5L', 0.40, 0.20, 200, 50, 4, true, 'Sobre', 0.38, 0.36, 30.00, 'Estante Bebidas', 1, false, 1),
('Jabon Tocador', 'MKT-024', 'Jabon de baño humectante', 0.90, 0.60, 100, 25, 4, true, 'Unidad', 0.86, 0.81, 30.00, 'Estante Higiene', 1, false, 1),
('Papel Higienico 4r', 'MKT-025', 'Papel higienico blanco doble hoja 4 rollos', 2.50, 1.80, 80, 20, 4, true, 'Paquete', 2.38, 2.25, 30.00, 'Estante Higiene', 1, false, 4),
('Crema Dental 100ml', 'MKT-026', 'Pasta dental proteccion anticaries', 2.00, 1.40, 60, 15, 4, true, 'Tubo', 1.90, 1.80, 30.00, 'Estante Higiene', 1, false, 1),
('Afeitar Desechable', 'MKT-027', 'Maquina afeitar 2 hojillas pack 2', 1.50, 0.90, 50, 15, 4, true, 'Paquete', 1.43, 1.35, 30.00, 'Estante Higiene', 1, false, 2),
('Toallas Sanitarias', 'MKT-028', 'Toallas femeninas dia paquete 8u', 1.80, 1.20, 60, 15, 4, true, 'Paquete', 1.71, 1.62, 30.00, 'Estante Higiene', 1, false, 8),
('Pañales Talla M', 'MKT-029', 'Pañales bebe talla media 20u', 6.00, 4.50, 20, 5, 4, true, 'Paquete', 5.70, 5.40, 30.00, 'Estante Bebes', 1, false, 20),
('Pañales Talla G', 'MKT-030', 'Pañales bebe talla grande 20u', 6.50, 4.80, 20, 5, 4, true, 'Paquete', 6.18, 5.85, 30.00, 'Estante Bebes', 1, false, 20),

-- === HOGAR (10 Items) ===
('Cloro 1L', 'HOG-001', 'Blanqueador desinfectante concentrado', 1.20, 0.70, 60, 15, 5, true, 'Botella', 1.14, 1.08, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Detergente Polvo 1kg', 'HOG-002', 'Jabon en polvo aroma floral', 2.50, 1.80, 80, 20, 5, true, 'Bolsa', 2.38, 2.25, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Desinfectante 1L', 'HOG-003', 'Limpiador de pisos aroma lavanda', 1.50, 0.90, 60, 15, 5, true, 'Botella', 1.43, 1.35, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Lavaplatos Crema', 'HOG-004', 'Crema lavaplatos arrancagrasa limon', 1.20, 0.80, 60, 15, 5, true, 'Tarrina', 1.14, 1.08, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Esponja Brillo', 'HOG-005', 'Esponja metalica jabonosa pack 3u', 0.80, 0.40, 100, 20, 5, true, 'Paquete', 0.76, 0.72, 30.00, 'Pasillo Limpieza', 1, false, 3),
('Escoba Plastica', 'HOG-006', 'Cepillo barrer cerdas duras sin palo', 3.50, 2.00, 40, 10, 5, true, 'Unidad', 3.33, 3.15, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Coleto Gris 60x50', 'HOG-007', 'Paño de suelos algodon gris', 1.50, 0.90, 50, 15, 5, true, 'Unidad', 1.43, 1.35, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Haragan Plastico', 'HOG-008', 'Haragan secador de pisos 40cm', 2.50, 1.50, 30, 10, 5, true, 'Unidad', 2.38, 2.25, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Palo de Madera', 'HOG-009', 'Cabo de madera rosca universal', 1.20, 0.70, 80, 20, 5, true, 'Unidad', 1.14, 1.08, 30.00, 'Pasillo Limpieza', 1, false, 1),
('Bolsas Basura 30kg', 'HOG-010', 'Bolsas negras resistentes 30kg paq 10', 2.00, 1.20, 50, 15, 5, true, 'Paquete', 1.90, 1.80, 30.00, 'Pasillo Limpieza', 1, false, 10),

-- === AUTOMOTRIZ (10 Items) ===
('Aceite 20W50 Mineral', 'AUT-001', 'Aceite motor mineral alta viscosidad', 5.50, 3.80, 40, 10, 6, true, 'Litro', 5.23, 4.95, 30.00, 'Estante Autos', 1, false, 1),
('Aceite 15W40 Semi', 'AUT-002', 'Aceite motor semi-sintetico tecnologia', 6.50, 4.50, 40, 10, 6, true, 'Litro', 6.18, 5.85, 30.00, 'Estante Autos', 1, false, 1),
('Liga de Frenos DOT4', 'AUT-003', 'Liquido de frenos alto desempeño 350ml', 3.50, 2.20, 30, 8, 6, true, 'Botella', 3.33, 3.15, 30.00, 'Estante Autos', 1, false, 1),
('Refrigerante Verde', 'AUT-004', 'Refrigerante radiador anticorrosivo galon', 6.00, 3.80, 25, 5, 6, true, 'Galon', 5.70, 5.40, 30.00, 'Estante Autos', 1, false, 1),
('Agua Destilada', 'AUT-005', 'Agua para baterias libre de minerales', 1.00, 0.50, 30, 10, 6, true, 'Botella', 0.95, 0.90, 30.00, 'Estante Autos', 1, false, 1),
('Formula Mecanica', 'AUT-006', 'Lubricante penetrante aflojatodo spray', 4.50, 3.00, 25, 5, 6, true, 'Lata', 4.28, 4.05, 30.00, 'Estante Autos', 1, false, 1),
('Shampoo Carros', 'AUT-007', 'Shampoo concentrado con cera carnauba', 4.00, 2.50, 20, 5, 6, true, 'Botella', 3.80, 3.60, 30.00, 'Estante Autos', 1, false, 1),
('Ambiental Pino', 'AUT-008', 'Pino aromatico colgante para espejo', 1.50, 0.80, 50, 15, 6, true, 'Unidad', 1.43, 1.35, 30.00, 'Caja Registradora', 1, false, 1),
('Paño Microfibra', 'AUT-009', 'Paño limpieza suave 40x40cm', 2.00, 1.10, 40, 10, 6, true, 'Unidad', 1.90, 1.80, 30.00, 'Estante Autos', 1, false, 1),
('Silicon Tableros', 'AUT-010', 'Protector UV brillo para tableros spray', 3.50, 2.20, 20, 5, 6, true, 'Lata', 3.33, 3.15, 30.00, 'Estante Autos', 1, false, 1)

ON CONFLICT (sku) DO UPDATE 
SET price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    cost_price = EXCLUDED.cost_price,
    description = EXCLUDED.description,
    price_mayor_1 = EXCLUDED.price_mayor_1,
    price_mayor_2 = EXCLUDED.price_mayor_2;

-- Fin del script
