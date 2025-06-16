# EKS + ArgoCD GitOps Deployment Guide

This guide explains how to deploy the fullstack application to Amazon EKS using ArgoCD for GitOps-based continuous deployment.

## 🏗️ Architecture

```
Code Change → GitHub Actions → Docker Build & Push → Update K8s Manifests → ArgoCD → EKS Deployment
```

## 📋 Prerequisites

### 1. EKS Cluster Setup
```bash
# Create EKS cluster
eksctl create cluster --name fullstack-cluster --region us-west-2 --nodes 3

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name fullstack-cluster
```

### 2. Install ArgoCD
```bash
# Create ArgoCD namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward to access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### 3. Install AWS Load Balancer Controller
```bash
# Download IAM policy
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.5.4/docs/install/iam_policy.json

# Create IAM policy
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# Create service account
eksctl create iamserviceaccount \
  --cluster=fullstack-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::ACCOUNT-ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=fullstack-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

## 🔧 GitHub Secrets Configuration

Add the following secrets to your GitHub repository:

- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password or access token

## 🚀 Deployment Process

### 1. Deploy ArgoCD Application
```bash
kubectl apply -f argocd/application.yaml
```

### 2. Access ArgoCD UI
1. Open browser: `https://localhost:8080`
2. Login with `admin` and the password obtained earlier
3. You should see the `fullstack-app` application

### 3. Configure Domain (Optional)
Update `k8s/ingress.yaml` with your actual domain:
```yaml
spec:
  rules:
  - host: your-actual-domain.com  # Replace this
```

## 🔄 GitOps Workflow

### Automatic Deployment Process:

1. **Code Change**: Developer pushes code to `main` branch
2. **CI/CD Pipeline**: GitHub Actions runs tests and builds Docker images
3. **Image Push**: New images are pushed to Docker Hub with Git SHA tags
4. **Manifest Update**: Kubernetes manifests are automatically updated with new image tags
5. **ArgoCD Sync**: ArgoCD detects changes and deploys to EKS cluster

### Manual Operations:

```bash
# Check application status
kubectl get pods -n fullstack-app

# Check services
kubectl get svc -n fullstack-app

# Check ingress
kubectl get ingress -n fullstack-app

# View logs
kubectl logs -f deployment/backend-deployment -n fullstack-app
kubectl logs -f deployment/frontend-deployment -n fullstack-app
```

## 🔍 Monitoring & Troubleshooting

### ArgoCD Application Status
```bash
# Check ArgoCD application
kubectl get application -n argocd

# Describe application for details
kubectl describe application fullstack-app -n argocd
```

### Common Issues:

1. **Image Pull Errors**: Ensure Docker Hub credentials are correct
2. **Ingress Not Working**: Check AWS Load Balancer Controller installation
3. **Pods Not Starting**: Check resource limits and node capacity

## 🏷️ Image Tagging Strategy

- **Production**: Uses Git SHA (first 8 characters) for immutable deployments
- **Format**: `username/backend:a1b2c3d4`, `username/frontend:a1b2c3d4`
- **Rollback**: Change image tag in manifest and commit to trigger redeployment

## 🔐 Security Considerations

- Images are scanned by Trivy in CI pipeline
- Kubernetes resources have resource limits
- Network policies can be added for additional security
- RBAC is configured through ArgoCD

## 📊 Scaling

```bash
# Scale backend
kubectl scale deployment backend-deployment --replicas=5 -n fullstack-app

# Scale frontend  
kubectl scale deployment frontend-deployment --replicas=3 -n fullstack-app
```

For production, consider using HPA (Horizontal Pod Autoscaler):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: fullstack-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
``` 
