# Shared TLS settings. Included by every HTTPS server block.
ssl_protocols             TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_timeout       1d;
ssl_session_cache         shared:SSL:20m;
ssl_session_tickets       off;
ssl_stapling              on;
ssl_stapling_verify       on;
resolver                  127.0.0.11 valid=30s;
resolver_timeout          5s;

# The app also sets these; nginx repeats them so an error page served by nginx
# itself is protected too.
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Content-Type-Options    "nosniff" always;
add_header X-Frame-Options           "SAMEORIGIN" always;
add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
