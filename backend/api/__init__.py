"""
api/__init__.py

FastAPI router package.  Each module corresponds to one API domain:
    auth       — authentication (login, refresh, logout)
    kvm_nodes  — KVM node CRUD and status
    signaling  — WebRTC SDP relay (offer/answer forwarding to MediaMTX)
    ws_proxy   — WebSocket proxy endpoint (browser ↔ RPi control server)
"""
