# PDF Splitter - Local Offline Tool

## Setup Instructions

1.  **Prerequisites**:
    *   Python 3.8+
    *   Node.js & npm

2.  **Install Backend Dependencies**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

3.  **Install Frontend Dependencies**:
    ```bash
    cd frontend
    npm install
    ```

4.  **Run Application**:
    *   Double-click `start_app.bat` 
    *   OR run manually:
        *   Backend: `uvicorn backend.main:app --reload`
        *   Frontend: `npm run dev --prefix frontend` (Access at http://localhost:5173)

## Features
*   Splits large PDFs (up to 1GB) without crashing memory.
*   Supports multiple ranges (e.g., `1-5, 10-15`).
*   Zips outputs.
*   Auto-deletes temp files.
