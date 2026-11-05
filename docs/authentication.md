# Authentication Documentation

## 1. Security Architecture
- **Stateless JWT Tokens:** Authentication uses HMAC SHA-256 JWT tokens.
- **Short-Lived Access Tokens:** `JWT_EXPIRES_IN=1d` (or configurable down to 15m).
- **Refresh Token Strategy:** `JWT_REFRESH_EXPIRES_IN=7d` for rotating sessions securely.
- **Password Hashing:** Passwords are never stored in plaintext. They are hashed using bcrypt with salt rounds of 10.
- **Account State Verification:** Inactive users (`isActive: false`) are rejected at the authentication middleware level even if their token has not yet expired.

## 2. API Endpoints
- `POST /api/v1/auth/login`: Validates credentials, returns JWT tokens and user payload with role and permissions.
- `GET /api/v1/auth/me`: Validates `Authorization: Bearer <token>` header and returns fresh user information.
- `POST /api/v1/auth/refresh`: Exchanges a valid refresh token for a new access token.
