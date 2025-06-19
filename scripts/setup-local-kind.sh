#!/bin/bash

set -e

echo "🚀 Setting up local Kubernetes cluster with kind and ArgoCD..."

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "❌ kind is not installed. Please install kind first:"
    echo "   brew install kind"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first:"
    echo "   brew install kubectl"
    exit 1
fi

# Create kind cluster
echo "📦 Creating kind cluster..."
kind create cluster --config k8s/local/kind-config.yaml

# Wait for cluster to be ready
echo "⏳ Waiting for cluster to be ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=300s

# Install ArgoCD
echo "🔧 Installing ArgoCD..."
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
echo "⏳ Waiting for ArgoCD to be ready..."
kubectl wait --for=condition=Available deployment/argocd-server -n argocd --timeout=300s

# Get ArgoCD admin password
echo "🔑 Getting ArgoCD admin password..."
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD admin password: $ARGOCD_PASSWORD"

# Port forward ArgoCD server
echo "🌐 Setting up port forward for ArgoCD UI..."
echo "ArgoCD UI will be available at: http://localhost:8080"
echo "Username: admin"
echo "Password: $ARGOCD_PASSWORD"
echo ""
echo "To access ArgoCD UI, run: kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo ""

# Apply ArgoCD application
echo "📋 Applying ArgoCD application..."
kubectl apply -f k8s/local/argocd-app.yaml

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "2. Open http://localhost:8080 in your browser"
echo "3. Login with admin/$ARGOCD_PASSWORD"
echo "4. Your application will be deployed automatically" 
