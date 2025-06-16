# Cloudflare HTTPS 설정 가이드

## 개요
이 프로젝트는 Cloudflare를 통해 HTTPS를 처리하도록 설정되어 있습니다. AWS ALB나 Let's Encrypt 대신 Cloudflare의 SSL/TLS 기능을 사용합니다.

## Cloudflare 설정 단계

### 1. 도메인 등록 및 DNS 설정
1. Cloudflare에 도메인 등록 완료 ✅
2. DNS 레코드 설정:
   ```
   Type: A
   Name: @ (또는 원하는 서브도메인)
   Content: <EKS-INGRESS-EXTERNAL-IP>
   Proxy status: Proxied (주황색 구름 아이콘)
   ```

### 2. SSL/TLS 설정
1. Cloudflare 대시보드 → SSL/TLS 탭
2. 암호화 모드: **Flexible** 또는 **Full** 선택
   - **Flexible**: Cloudflare ↔ 사용자 (HTTPS), Cloudflare ↔ 서버 (HTTP)
   - **Full**: 양쪽 모두 암호화 (권장)

### 3. Kubernetes Ingress 설정
현재 설정된 ingress.yaml:
- NGINX Ingress Controller 사용
- SSL 리다이렉트 비활성화 (Cloudflare에서 처리)
- HTTP 백엔드 프로토콜 사용

### 4. 배포 후 확인사항
```bash
# Ingress 외부 IP 확인
kubectl get ingress -n jonny

# 서비스 상태 확인
kubectl get svc -n jonny

# HTTPS 접속 테스트
curl -I https://your-domain.com
curl -I https://your-domain.com/api/health
```

## 보안 설정 (권장)

### Cloudflare 보안 기능
1. **Always Use HTTPS**: 모든 HTTP 요청을 HTTPS로 리다이렉트
2. **HSTS**: HTTP Strict Transport Security 활성화
3. **Minimum TLS Version**: TLS 1.2 이상 설정
4. **Bot Fight Mode**: 봇 공격 방어

### 추가 보안 설정
```yaml
# ingress.yaml에 추가 가능한 보안 어노테이션
annotations:
  nginx.ingress.kubernetes.io/force-ssl-redirect: "false"  # Cloudflare에서 처리
  nginx.ingress.kubernetes.io/proxy-body-size: "1m"
  nginx.ingress.kubernetes.io/rate-limit: "100"
```

## 문제 해결

### 일반적인 문제
1. **502 Bad Gateway**: 백엔드 서비스 상태 확인
2. **SSL 인증서 오류**: Cloudflare SSL 설정 확인
3. **무한 리다이렉트**: SSL 모드를 Flexible로 변경

### 디버깅 명령어
```bash
# Ingress 로그 확인
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# 백엔드 서비스 로그 확인
kubectl logs -n jonny -l app=backend
kubectl logs -n jonny -l app=frontend
```

## 성능 최적화

### Cloudflare 최적화 설정
1. **Caching**: 정적 자원 캐싱 활성화
2. **Minification**: CSS, JS, HTML 압축
3. **Brotli Compression**: 압축 알고리즘 최적화
4. **HTTP/2**: HTTP/2 프로토콜 활성화 
