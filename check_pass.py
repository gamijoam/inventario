#!/usr/bin/env python3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
hash_str = "$2b$12$bYd0BGo7UMfsI6HagdL6ruAoWTth.Qt1u18Y1vvnfdyj996RDq9Za"

passwords = ['Restaurante123!', 'Restaurante123', 'restaurante123', 'Password123!', 'Admin123!', 'Test1234', 'admin', 'password']
for p in passwords:
    try:
        result = pwd_context.verify(p, hash_str)
        print(f'{p}: {result}')
    except Exception as e:
        print(f'{p}: ERROR - {e}')