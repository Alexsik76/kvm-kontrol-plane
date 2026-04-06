# Документація API — IP-KVM Control Plane

Цей документ містить детальний опис усіх кінцевих точок (endpoints) API бекенду.

## Базова інформація

- **Базовий URL:** `https://kvm-api.lab.vn.ua/api/v1`
- **Формат даних:** `application/json`
- **Автентифікація:** JSON Web Token (JWT) через заголовок `Authorization: Bearer <token>` (крім WebSocket, де токен передається в query-параметрі).

---

## 1. Трансляція відео та сигналізація WebRTC

Ці ендпоінти використовуються для встановлення WebRTC-з'єднання між браузером та MediaMTX на вузлі KVM.

### 1.1. Передача SDP Offer
**URL:** `POST /nodes/{node_id}/signal/offer`

Використовується для ініціалізації WebRTC з'єднання (протокол WHEP).

- **Заголовки:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `Content-Type: application/json`

- **Тіло запиту (JSON):**
```json
{
  "sdp": "v=0\r\no=- 473289... (повний текст SDP offer)",
  "type": "offer"
}
```

- **Успішна відповідь (200 OK):**
```json
{
  "sdp": "v=0\r\no=- 893247... (текст SDP answer від MediaMTX)",
  "type": "answer",
  "session_url": "https://pi4.lab.vn.ua/kvm/whep/uuid-session-id"
}
```
*Важливо:* `session_url` необхідно зберегти для подальшої передачі ICE-кандидатів.

---

### 1.2. Передача ICE Candidate (Trickle ICE)
**URL:** `POST /nodes/{node_id}/signal/ice`

- **Заголовки:**
  - `Authorization: Bearer <JWT_ACCESS_TOKEN>`
  - `Content-Type: application/json`

- **Тіло запиту (JSON):**
```json
{
  "candidate": "candidate:423492834 1 udp 2122260223 192.168.1.100 54321 typ host...",
  "sdpMid": "0",
  "sdpMLineIndex": 0,
  "session_url": "https://pi4.lab.vn.ua/kvm/whep/uuid-session-id"
}
```
*Примітка:* `session_url` — це URL сесії, отриманий у відповіді на Offer.

- **Успішна відповідь:** `204 No Content`.

---

## 2. Управління (HID) через WebSocket Proxy

### 2.1. WebSocket з'єднання
**URL:** `GET /nodes/{node_id}/ws`

Використовується для передачі подій клавіатури та миші в реальному часі.

- **Автентифікація:** Токен передається як параметр рядка запиту.
- **Формат:** `wss://kvm-api.lab.vn.ua/api/v1/nodes/{node_id}/ws?token=<JWT_ACCESS_TOKEN>`

---

## 3. Автентифікація (`/auth`)

### 3.1. Вхід (Login)
**URL:** `POST /auth/login`

- **Тіло запиту (Form Data):** `username`, `password`
- **Відповідь:** `{"access_token": "...", "refresh_token": "...", "token_type": "bearer"}`

### 3.2. Оновлення токена (Refresh)
**URL:** `POST /auth/refresh`
- **Тіло запиту:** `{"refresh_token": "..."}`

---

## 4. Управління вузлами KVM (`/nodes`)

### 4.1. Список вузлів
**URL:** `GET https://kvm-api.lab.vn.ua/api/v1/nodes`

### 4.2. Статус вузла (Health)
**URL:** `GET https://kvm-api.lab.vn.ua/api/v1/nodes/{node_id}/status`

### 4.3. Пробудження (Wake-on-USB)
**URL:** `POST https://kvm-api.lab.vn.ua/api/v1/nodes/{node_id}/ws/wake`

---

## Специфічні заголовки для MediaMTX (Internal)

Бекенд автоматично додає заголовок `Authorization: Basic <base64(user:pass)>` при зверненні до вузла. Клієнту ці дані знати не потрібно.
