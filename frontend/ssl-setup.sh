#!/bin/bash

# 자체 서명 SSL 인증서 생성
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=DevJonny/CN=container.devjonny.me"

echo "SSL certificate generated successfully!" 
