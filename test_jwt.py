from jose import jwt, JWTError
from datetime import datetime, timedelta
import time

secret = "testsecret"
alg = "HS256"

# Create token expired 1 hour ago
payload = {
    "sub": "test",
    "exp": int((datetime.utcnow() - timedelta(hours=1)).timestamp())
}
token = jwt.encode(payload, secret, algorithm=alg)

try:
    decoded = jwt.decode(token, secret, algorithms=[alg], options={"verify_exp": False})
    print("Success:", decoded)
except Exception as e:
    print("Error:", type(e), str(e))
