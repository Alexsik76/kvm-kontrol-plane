"""
services/__init__.py

Business-logic service package.  Services are designed with Single
Responsibility Principle (SRP) in mind:

    ws_proxy    -- bidirectional WebSocket proxy between the browser and RPi
    node_health -- background poller that updates KVM node online/offline status
    node_manager -- CRUD helpers for KVM node records
"""
