# Local Development Setup with Kind and ArgoCD

This guide will help you set up a local Kubernetes cluster using kind and deploy the application using ArgoCD.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Git](https://git-scm.com/)

## Installation

### 1. Install kind
```bash
# macOS
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

### 2. Install kubectl
```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

## Quick Start

### 1. Setup Local Cluster
```bash
# Run the setup script
./scripts/setup-local-kind.sh
```

This script will:
- Create a kind cluster with 3 nodes (1 control-plane, 2 workers)
- Install ArgoCD
- Apply the ArgoCD application configuration
- Display the ArgoCD admin password

### 2. Access ArgoCD UI
```bash
# Port forward ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Then open http://localhost:8080 in your browser and login with:
- Username: `admin`
- Password: (displayed by the setup script)

### 3. Monitor Application Deployment
The application will be automatically deployed to the `jonny-local` namespace. You can monitor the deployment status in the ArgoCD UI.

## Application Structure

The local setup uses the following configuration:

- **Namespace**: `jonny-local`
- **Git Branch**: `local`
- **Path**: `k8s/local`
- **Replicas**: 1 (for both frontend and backend)
- **Resources**: Reduced for local development

### Services
- **Frontend**: Available on port 80 (ClusterIP)
- **Backend**: Available on port 5000 (ClusterIP)

## Cleanup

To clean up the local cluster:
```bash
./scripts/cleanup-local-kind.sh
```

## Troubleshooting

### Check Cluster Status
```bash
kubectl cluster-info
kubectl get nodes
```

### Check ArgoCD Status
```bash
kubectl get pods -n argocd
kubectl get applications -n argocd
```

### Check Application Status
```bash
kubectl get pods -n jonny-local
kubectl get services -n jonny-local
```

### View Logs
```bash
# Frontend logs
kubectl logs -f deployment/frontend-deployment -n jonny-local

# Backend logs
kubectl logs -f deployment/backend-deployment -n jonny-local
```

## Development Workflow

1. Make changes to your application
2. Build and push new Docker images
3. Update the image tags in `k8s/local/` deployment files
4. Commit and push to the `local` branch
5. ArgoCD will automatically sync the changes

## Notes

- The local setup uses the `local` branch instead of `main`
- Resource limits are reduced for local development
- Only 1 replica is used for each service
- No ingress is configured (use port-forward for access) 
