import os
import shutil
import zipfile
import uuid
import time
import tempfile
from typing import List
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pypdf

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use system temp directory for Vercel compatibility (Read-only FS elsewhere)
BASE_DIR = Path(tempfile.gettempdir()) / "pdf-splitter"
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def parse_page_ranges(range_str: str, max_pages: int) -> List[tuple]:
    ranges = []
    range_str = range_str.replace(" ", "")
    parts = range_str.split(',')
    
    for part in parts:
        if '-' in part:
            try:
                start_s, end_s = part.split('-')
                start = int(start_s)
                end = int(end_s)
            except ValueError:
                raise ValueError(f"Invalid range format: {part}")
            
            if start < 1: start = 1
            if end > max_pages: end = max_pages
            if start > end:
                raise ValueError(f"Invalid range: {start}-{end}")
            
            ranges.append((start - 1, end - 1))
        else:
            try:
                p = int(part)
            except ValueError:
                raise ValueError(f"Invalid number: {part}")
            if 1 <= p <= max_pages:
                ranges.append((p - 1, p - 1))
            else:
                if p > max_pages: 
                    raise ValueError(f"Page {p} out of bounds (max {max_pages})")
    return ranges

def cleanup_files(file_paths: List[Path], dirs_to_remove: List[Path] = None):
    # Small delay for handle release
    time.sleep(1.0)
    for p in file_paths:
        for attempt in range(3):
            try:
                if p.exists():
                    p.unlink()
                break
            except Exception:
                time.sleep(1.0)
    
    if dirs_to_remove:
        for d in dirs_to_remove:
            for attempt in range(3):
                try:
                    if d.exists():
                        shutil.rmtree(d)
                    break
                except Exception:
                    time.sleep(1.0)

@app.post("/api/split") # Updated route for Vercel rewrite standards
async def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    ranges: str = Form(...)
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    session_id = str(uuid.uuid4())
    session_upload_path = UPLOAD_DIR / f"{session_id}.pdf"
    session_output_dir = OUTPUT_DIR / session_id
    session_output_dir.mkdir(exist_ok=True)

    input_stream = None

    try:
        with session_upload_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        input_stream = open(session_upload_path, "rb")
        try:
            reader = pypdf.PdfReader(input_stream)
            total_pages = len(reader.pages)
        except Exception as e:
            input_stream.close()
            raise HTTPException(status_code=400, detail=f"Invalid PDF: {str(e)}")

        try:
            parsed_ranges = parse_page_ranges(ranges, total_pages)
        except ValueError as ve:
            input_stream.close()
            raise HTTPException(status_code=400, detail=str(ve))

        output_files = []

        for idx, (start, end) in enumerate(parsed_ranges):
            writer = pypdf.PdfWriter()
            for p_num in range(start, end + 1):
                writer.add_page(reader.pages[p_num])
            
            out_filename = f"split_{idx+1}_{start+1}-{end+1}.pdf"
            out_path = session_output_dir / out_filename
            with out_path.open("wb") as out_f:
                writer.write(out_f)
            output_files.append(out_path)

        input_stream.close()
        input_stream = None

        zip_filename = f"split_results_{session_id}.zip"
        zip_path = OUTPUT_DIR / zip_filename
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for f in output_files:
                zf.write(f, arcname=f.name)

        background_tasks.add_task(
            cleanup_files, 
            [session_upload_path, zip_path], 
            [session_output_dir]
        )

        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type='application/zip'
        )

    except Exception as e:
        if input_stream:
            input_stream.close()
        cleanup_files([session_upload_path], [session_output_dir])
        raise HTTPException(status_code=500, detail=str(e))

# For Vercel, we might need a catch-all if not using standard rewrites for docs
@app.get("/api/health")
def health():
    return {"status": "ok"}
