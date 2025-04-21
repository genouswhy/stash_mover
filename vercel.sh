#!/bin/bash
# Troubleshooting script for Vercel deployment

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check Flask installation
echo "Checking Flask installation..."
python -c "import flask; print(f'Flask version: {flask.__version__}')"

# Check Werkzeug installation
echo "Checking Werkzeug installation..."
python -c "import werkzeug; print(f'Werkzeug version: {werkzeug.__version__}')"

# Check application entry point
echo "Checking application entry point..."
python -c "import app; print('App imported successfully')"

echo "Done." 