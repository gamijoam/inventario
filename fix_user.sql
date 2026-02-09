-- Reset password for Admin User
-- Password will be 'admin123' (bcrypt hash)
-- Ensures user is active and superuser

UPDATE public.users 
SET 
    password_hash = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 
    is_active = true, 
    is_superuser = true ,
    username = 'admin' -- Reset username to 'admin' to avoid compatibility issues if needed
WHERE email = 'rodriguezisaac876@gmail.com';

-- Verify
SELECT id, username, email, is_active FROM public.users WHERE email = 'rodriguezisaac876@gmail.com';
