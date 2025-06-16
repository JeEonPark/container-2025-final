# Frontend-Backend Hello World

This project is a full-stack application consisting of a Flask backend and Angular frontend.

## 🚀 Features

- **Automated CI/CD**: Automated testing and static analysis through GitHub Actions
- **Code Quality Management**: Static analysis with ESLint, Black, Flake8, MyPy
- **Test Coverage**: Automated testing with Pytest and Karma/Jasmine
- **Security Scanning**: Vulnerability scanning with Trivy
- **Docker Support**: Containerized deployment

## 🛠️ Tech Stack

### Backend
- Python 3.10
- Flask
- Flask-CORS
- Pytest (Testing)
- Black, isort, Flake8, MyPy (Static Analysis)

### Frontend
- Angular 20
- Node.js 22
- TypeScript
- Karma/Jasmine (Testing)
- ESLint (Static Analysis)

### DevOps
- Docker & Docker Compose
- GitHub Actions
- Codecov (Code Coverage)
- Trivy (Security Scanning)

## 📋 CI/CD Pipeline

The following automated processes are executed through GitHub Actions:

### Backend Testing & Static Analysis
- **Code Formatting**: Code style checking with Black
- **Import Sorting**: Import statement sorting check with isort
- **Linting**: Code quality checking with Flake8
- **Type Checking**: Static type checking with MyPy
- **Unit Testing**: Test execution and coverage measurement with Pytest

### Frontend Testing & Static Analysis
- **Linting**: TypeScript/Angular code checking with ESLint
- **Type Checking**: Type checking with TypeScript compiler
- **Unit Testing**: Test execution with Karma/Jasmine
- **Build Testing**: Angular application build verification

### Docker & Security
- **Docker Build**: Backend/Frontend Docker image build testing
- **Docker Compose**: Full application configuration verification
- **Security Scanning**: Vulnerability scanning with Trivy

## 🚀 How to Run

### Using Docker Compose
```bash
docker-compose up --build
```

### Individual Execution

#### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## 🧪 Running Tests

### Backend Tests
```bash
cd backend
pytest --cov=. --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🔍 Static Analysis

### Backend
```bash
cd backend
black --check .
isort --check-only .
flake8 .
mypy .
```

### Frontend
```bash
cd frontend
npm run lint
```
# Test GHCR permissions
