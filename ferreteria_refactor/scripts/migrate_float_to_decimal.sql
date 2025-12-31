-- Migration Script: Float to Decimal (Numeric)
-- Run this in your PostgreSQL database tool (pgAdmin, DBeaver) if preserving data.
-- New databases will be created correctly automatically.

BEGIN;

-- 1. Exchange Rates (High Precision)
ALTER TABLE exchange_rates ALTER COLUMN rate TYPE NUMERIC(14, 4) USING rate::numeric;

-- 2. Products (Prices & Stock)
ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12, 2) USING price::numeric;
ALTER TABLE products ALTER COLUMN price_mayor_1 TYPE NUMERIC(12, 2) USING price_mayor_1::numeric;
ALTER TABLE products ALTER COLUMN price_mayor_2 TYPE NUMERIC(12, 2) USING price_mayor_2::numeric;
ALTER TABLE products ALTER COLUMN cost_price TYPE NUMERIC(14, 4) USING cost_price::numeric;
ALTER TABLE products ALTER COLUMN stock TYPE NUMERIC(12, 3) USING stock::numeric;
ALTER TABLE products ALTER COLUMN min_stock TYPE NUMERIC(12, 3) USING min_stock::numeric;

-- 3. Product Units
ALTER TABLE product_units ALTER COLUMN conversion_factor TYPE NUMERIC(14, 4) USING conversion_factor::numeric;
ALTER TABLE product_units ALTER COLUMN price_usd TYPE NUMERIC(12, 2) USING price_usd::numeric;

-- 4. Suppliers & Customers
ALTER TABLE suppliers ALTER COLUMN current_balance TYPE NUMERIC(12, 2) USING current_balance::numeric;
ALTER TABLE suppliers ALTER COLUMN credit_limit TYPE NUMERIC(12, 2) USING credit_limit::numeric;

ALTER TABLE customers ALTER COLUMN credit_limit TYPE NUMERIC(12, 2) USING credit_limit::numeric;

-- 5. Sales & Details
ALTER TABLE sales ALTER COLUMN total_amount TYPE NUMERIC(12, 2) USING total_amount::numeric;
ALTER TABLE sales ALTER COLUMN exchange_rate_used TYPE NUMERIC(14, 4) USING exchange_rate_used::numeric;
ALTER TABLE sales ALTER COLUMN total_amount_bs TYPE NUMERIC(12, 2) USING total_amount_bs::numeric;
ALTER TABLE sales ALTER COLUMN balance_pending TYPE NUMERIC(12, 2) USING balance_pending::numeric;

ALTER TABLE sale_details ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::numeric;
ALTER TABLE sale_details ALTER COLUMN unit_price TYPE NUMERIC(12, 2) USING unit_price::numeric;
ALTER TABLE sale_details ALTER COLUMN discount TYPE NUMERIC(12, 2) USING discount::numeric;
ALTER TABLE sale_details ALTER COLUMN subtotal TYPE NUMERIC(12, 2) USING subtotal::numeric;

ALTER TABLE sale_payments ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::numeric;
ALTER TABLE sale_payments ALTER COLUMN exchange_rate TYPE NUMERIC(14, 4) USING exchange_rate::numeric;

-- 6. Payments (AR)
ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::numeric;
ALTER TABLE payments ALTER COLUMN amount_bs TYPE NUMERIC(12, 2) USING amount_bs::numeric;
ALTER TABLE payments ALTER COLUMN exchange_rate_used TYPE NUMERIC(14, 4) USING exchange_rate_used::numeric;

-- 7. Kardex
ALTER TABLE kardex ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::numeric;
ALTER TABLE kardex ALTER COLUMN balance_after TYPE NUMERIC(12, 3) USING balance_after::numeric;

-- 8. Cash Sessions
ALTER TABLE cash_sessions ALTER COLUMN initial_cash TYPE NUMERIC(12, 2) USING initial_cash::numeric;
ALTER TABLE cash_sessions ALTER COLUMN initial_cash_bs TYPE NUMERIC(12, 2) USING initial_cash_bs::numeric;
ALTER TABLE cash_sessions ALTER COLUMN final_cash_reported TYPE NUMERIC(12, 2) USING final_cash_reported::numeric;
ALTER TABLE cash_sessions ALTER COLUMN final_cash_reported_bs TYPE NUMERIC(12, 2) USING final_cash_reported_bs::numeric;
ALTER TABLE cash_sessions ALTER COLUMN final_cash_expected TYPE NUMERIC(12, 2) USING final_cash_expected::numeric;
ALTER TABLE cash_sessions ALTER COLUMN final_cash_expected_bs TYPE NUMERIC(12, 2) USING final_cash_expected_bs::numeric;
ALTER TABLE cash_sessions ALTER COLUMN difference TYPE NUMERIC(12, 2) USING difference::numeric;
ALTER TABLE cash_sessions ALTER COLUMN difference_bs TYPE NUMERIC(12, 2) USING difference_bs::numeric;

ALTER TABLE cash_session_currencies ALTER COLUMN initial_amount TYPE NUMERIC(12, 2) USING initial_amount::numeric;
ALTER TABLE cash_session_currencies ALTER COLUMN final_reported TYPE NUMERIC(12, 2) USING final_reported::numeric;
ALTER TABLE cash_session_currencies ALTER COLUMN final_expected TYPE NUMERIC(12, 2) USING final_expected::numeric;
ALTER TABLE cash_session_currencies ALTER COLUMN difference TYPE NUMERIC(12, 2) USING difference::numeric;

ALTER TABLE cash_movements ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::numeric;
ALTER TABLE cash_movements ALTER COLUMN exchange_rate TYPE NUMERIC(14, 4) USING exchange_rate::numeric;

-- 9. Returns
ALTER TABLE returns ALTER COLUMN total_refunded TYPE NUMERIC(12, 2) USING total_refunded::numeric;
ALTER TABLE return_details ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::numeric;
ALTER TABLE return_details ALTER COLUMN unit_price TYPE NUMERIC(12, 2) USING unit_price::numeric;

-- 10. Purchase Orders (AP)
ALTER TABLE purchase_orders ALTER COLUMN total_amount TYPE NUMERIC(12, 2) USING total_amount::numeric;
ALTER TABLE purchase_orders ALTER COLUMN paid_amount TYPE NUMERIC(12, 2) USING paid_amount::numeric;

ALTER TABLE purchase_payments ALTER COLUMN amount TYPE NUMERIC(12, 2) USING amount::numeric;

-- 11. Price Rules
ALTER TABLE price_rules ALTER COLUMN min_quantity TYPE NUMERIC(12, 3) USING min_quantity::numeric;
ALTER TABLE price_rules ALTER COLUMN price TYPE NUMERIC(12, 2) USING price::numeric;

-- 12. Quotes
ALTER TABLE quotes ALTER COLUMN total_amount TYPE NUMERIC(12, 2) USING total_amount::numeric;
ALTER TABLE quote_details ALTER COLUMN quantity TYPE NUMERIC(12, 3) USING quantity::numeric;
ALTER TABLE quote_details ALTER COLUMN unit_price TYPE NUMERIC(12, 2) USING unit_price::numeric;
ALTER TABLE quote_details ALTER COLUMN subtotal TYPE NUMERIC(12, 2) USING subtotal::numeric;

COMMIT;
