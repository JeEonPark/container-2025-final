#!/bin/bash

set -e

echo "🧹 Cleaning up local kind cluster..."

# Delete kind cluster
echo "🗑️  Deleting kind cluster..."
kind delete cluster --name jonny-local-cluster

echo "✅ Cleanup complete!" 
