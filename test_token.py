from jose import jwt, JWTError
import traceback

print("TEST 1: Valid JWT with 3 segments")
valid_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
try:
    jwt.decode(valid_jwt, "secret", algorithms=["HS256"], options={"verify_signature": False})
    print("Test 1 Passed")
except Exception as e:
    print(f"Test 1 Failed: {e}")

print("\nTEST 2: Invalid JWT with 2 segments (Not enough segments)")
invalid_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
try:
    jwt.decode(invalid_jwt, "secret", algorithms=["HS256"], options={"verify_signature": False})
    print("Test 2 Passed")
except Exception as e:
    print(f"Test 2 Caught Exception: {type(e).__name__} - {e}")

print("\nTEST 3: Completely random string instead of token")
random_string = "1234567890abcdef"
try:
    jwt.decode(random_string, "secret", algorithms=["HS256"], options={"verify_signature": False})
    print("Test 3 Passed")
except Exception as e:
    print(f"Test 3 Caught Exception: {type(e).__name__} - {e}")
