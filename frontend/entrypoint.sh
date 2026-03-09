#!/bin/sh
set -e

# We replace the placeholder __VITE_API_BASE_URL_PLACEHOLDER__ in all JS files
# with the actual value of the VITE_API_BASE_URL environment variable provided at runtime.

echo "Substituting VITE_API_BASE_URL in statically built files..."

if [ -n "$VITE_API_BASE_URL" ]; then
    find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|__VITE_API_BASE_URL_PLACEHOLDER__|${VITE_API_BASE_URL}|g" {} +
    echo "Done! VITE_API_BASE_URL set to: ${VITE_API_BASE_URL}"
else
    echo "Warning: VITE_API_BASE_URL is not set. The frontend might not be able to reach the API."
fi

# Hand off to the regular Nginx entrypoint
exec "$@"
