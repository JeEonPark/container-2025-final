# 풀스택 애플리케이션 배포 가이드

## 🚀 빠른 배포 가이드

### 1. 사전 준비사항
- [x] EKS 클러스터 접근 권한
- [x] kubectl 설정 완료
- [x] Cloudflare 계정 및 도메인 등록 완료
- [x] GitHub Actions 설정 완료
- [x] GHCR 이미지 빌드 완료

### 2. Cloudflare 설정

#### DNS 설정
1. Cloudflare 대시보드 접속
2. DNS 탭에서 A 레코드 추가:
   ```
   Type: A
   Name: @ (또는 원하는 서브도메인)
   Content: <EKS-INGRESS-EXTERNAL-IP>
   Proxy status: Proxied (🟠)
   ```

#### SSL/TLS 설정
1. SSL/TLS 탭 → Overview
2. 암호화 모드: **Flexible** 선택 (시작용)
3. Always Use HTTPS: **On**
4. Minimum TLS Version: **1.2**

### 3. Kubernetes 배포

#### 도메인 설정
```bash
# ingress.yaml에서 도메인 변경
sed -i 's/your-domain.com/실제도메인.com/g' k8s/ingress.yaml
```

#### 배포 실행
```bash
# 1. 네임스페이스 확인
kubectl get ns jonny

# 2. 전체 리소스 배포
kubectl apply -k k8s/

# 3. 배포 상태 확인
kubectl get all -n jonny

# 4. Ingress 외부 IP 확인
kubectl get ingress -n jonny
```

### 4. 배포 검증

#### 기본 연결 테스트
```bash
# HTTPS 접속 테스트
curl -I https://실제도메인.com
curl -I https://실제도메인.com/api/health

# 응답 예시:
# HTTP/2 200
# server: cloudflare
# cf-ray: xxxxx-ICN
```

#### 성능 테스트
```bash
# CDN 캐싱 확인
curl -I https://실제도메인.com | grep cf-cache-status

# 로드 테스트
for i in {1..10}; do
  curl -s -o /dev/null -w "%{time_total}\n" https://실제도메인.com
done
```

## 🔧 문제 해결

### 일반적인 문제들

#### 1. 502 Bad Gateway
```bash
# 백엔드 파드 상태 확인
kubectl get pods -n jonny -l app=backend

# 로그 확인
kubectl logs -n jonny -l app=backend --tail=50
```

#### 2. SSL 인증서 오류
- Cloudflare SSL 모드를 **Flexible**로 변경
- DNS 전파 대기 (최대 24시간)

#### 3. 무한 리다이렉트
```yaml
# ingress.yaml 확인
nginx.ingress.kubernetes.io/ssl-redirect: "false"
```

### 고급 설정

#### Cloudflare 성능 최적화
1. **Speed** 탭:
   - Auto Minify: CSS, JavaScript, HTML 모두 활성화
   - Brotli: 활성화
   - Early Hints: 활성화

2. **Caching** 탭:
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours

#### 보안 강화
1. **Security** 탭:
   - Security Level: Medium
   - Bot Fight Mode: 활성화
   - Challenge Passage: 30 minutes

2. **Firewall** 탭:
   - 필요시 국가별 차단 규칙 추가

## 📊 모니터링

### Cloudflare Analytics
- **Analytics** 탭에서 트래픽 모니터링
- **Speed** 탭에서 성능 지표 확인

### Kubernetes 모니터링
```bash
# 리소스 사용량 확인
kubectl top pods -n jonny
kubectl top nodes

# 이벤트 모니터링
kubectl get events -n jonny --sort-by='.lastTimestamp'
```

## 🔄 업데이트 및 롤백

### 애플리케이션 업데이트
```bash
# 새 이미지로 업데이트
kubectl set image deployment/backend backend=ghcr.io/jeeonpark/backend:new-tag -n jonny
kubectl set image deployment/frontend frontend=ghcr.io/jeeonpark/frontend:new-tag -n jonny

# 롤아웃 상태 확인
kubectl rollout status deployment/backend -n jonny
kubectl rollout status deployment/frontend -n jonny
```

### 롤백
```bash
# 이전 버전으로 롤백
kubectl rollout undo deployment/backend -n jonny
kubectl rollout undo deployment/frontend -n jonny
```

## 🎯 성공 지표

### 배포 완료 확인
- [ ] HTTPS 접속 성공 (https://도메인.com)
- [ ] API 엔드포인트 응답 (https://도메인.com/api/health)
- [ ] 모든 파드 Running 상태
- [ ] Cloudflare SSL 인증서 활성화
- [ ] CDN 캐싱 동작 확인

### 성능 지표
- 응답 시간: < 500ms (첫 방문)
- 응답 시간: < 100ms (캐시된 요청)
- 가용성: 99.9%
- SSL 등급: A+ (SSL Labs 테스트)

---

**🎉 배포 완료!**
이제 https://도메인.com 으로 접속하여 애플리케이션을 확인할 수 있습니다. 
