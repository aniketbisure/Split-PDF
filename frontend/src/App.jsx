import { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // State
  const [file, setFile] = useState(null);
  const [ranges, setRanges] = useState([{ id: 1, start: '1', end: '' }]);
  const [merge, setMerge] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, done, error
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // -- Handlers --

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    validateAndSetFile(selected);
  };

  const validateAndSetFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }
    setFile(f);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    validateAndSetFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e) => e.preventDefault();

  // Range Management
  const addRange = () => {
    const newId = ranges.length > 0 ? Math.max(...ranges.map(r => r.id)) + 1 : 1;

    // Auto-calculate start page based on previous range's end
    let nextStart = '';
    if (ranges.length > 0) {
      const lastRange = ranges[ranges.length - 1];
      if (lastRange.end && /^\d+$/.test(lastRange.end)) {
        nextStart = (parseInt(lastRange.end) + 1).toString();
      }
    }

    setRanges([...ranges, { id: newId, start: nextStart, end: '' }]);
  };

  const updateRange = (id, field, value) => {
    // allow only numbers
    if (value && !/^\d*$/.test(value)) return;

    setRanges(ranges.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const removeRange = (id) => {
    if (ranges.length === 1) return; // keep at least one
    setRanges(ranges.filter(r => r.id !== id));
  };

  const handleSplit = async () => {
    if (!file) return;

    // Filter out incomplete ranges
    const validRanges = ranges.filter(r => r.start && r.end);
    if (validRanges.length === 0) {
      setError("Please define at least one valid range (Start and End).");
      return;
    }

    // Check for logical errors (Start > End)
    for (const r of validRanges) {
      if (parseInt(r.start) > parseInt(r.end)) {
        setError(`Range ${r.start}-${r.end} is invalid. Start page must be less than or equal to end page.`);
        return;
      }
    }

    const rangeStr = validRanges.map(r => `${r.start}-${r.end}`).join(',');

    setStatus('uploading');
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('ranges', rangeStr);

    // Environment-aware API URL
    const API_URL = import.meta.env.PROD
      ? '/api/split'
      : 'http://localhost:8000/api/split';

    try {
      const response = await axios.post(API_URL, formData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `split_${file.name.replace('.pdf', '')}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setStatus('done');
      // Reset after a delay
      setTimeout(() => setStatus('idle'), 3000);

    } catch (err) {
      console.error(err);
      setStatus('error');
      setError('An error occurred during processing.');
    }
  };

  // -- Component Render --

  if (!file) {
    // Initial Upload Screen
    return (
      <div className="main-wrapper" style={{ background: 'white', display: 'block' }}>
        <header className="app-header">
          <a href="/" className="brand">I<span>❤️</span>PDF CLONE</a>
        </header>
        <div className="upload-container" onDrop={handleDrop} onDragOver={handleDragOver}>
          <div className="drop-zone" onClick={() => fileInputRef.current.click()}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', color: '#e5322d' }}>📄</div>
            <h2 style={{ fontSize: '1.8rem', color: '#333', margin: '0 0 1rem 0' }}>Select PDF file</h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>or drop PDF here</p>
            <button className="split-btn" style={{ marginTop: '1rem', width: 'auto', padding: '1rem 3rem', fontSize: '1.2rem' }}>Select PDF file</button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="main-wrapper">
      {/* Block interaction during upload */}
      {(status === 'uploading') && (
        <div className="progress-overlay">
          <div className="spinner"></div>
          <h2>Splitting PDF...</h2>
          <p>Please wait while we upload and process your file.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <header className="app-header">
          <a href="/" className="brand" onClick={(e) => { e.preventDefault(); setFile(null); }}>
            I<span>❤️</span>PDF CLONE
          </a>
          <div style={{ marginLeft: 'auto', fontWeight: '500', color: '#666' }}>{file.name}</div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* Left Visual Area */}
          <div className="preview-area">
            <div className="pdf-visual-container">
              {ranges.map((r, index) => (
                <div key={r.id} className="range-visual-card">
                  <div className="range-title">Range {index + 1}</div>
                  <div className="range-pages-row">
                    <div className="page-thumbnail">
                      <span className="page-number">{r.start || '?'}</span>
                    </div>
                    <div className="dots">...</div>
                    <div className="page-thumbnail">
                      <span className="page-number">{r.end || '?'}</span>
                    </div>
                  </div>
                  <div className="range-caption">
                    {r.start && r.end ? `Pages ${r.start} - ${r.end}` : 'Enter page range'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="sidebar">

            <div className="sidebar-header">
              <h2>Split PDF</h2>
            </div>

            <div className="sidebar-content">

              {/* Tool Tabs */}
              <div className="tool-tabs">
                <div className="tool-tab active">
                  <div className="tool-icon">⚱️</div>
                  <span>Range</span>
                </div>
                <div className="tool-tab">
                  <div className="tool-icon">📄</div>
                  <span>Extract</span>
                </div>
                <div className="tool-tab" style={{ opacity: 0.3, cursor: 'not-allowed' }}>
                  <div className="tool-icon">📦</div>
                  <span>Size</span>
                </div>
              </div>

              {/* Mode Select */}
              <div className="mode-selector">
                <button className="mode-btn active">Custom ranges</button>
                <button className="mode-btn">Fixed ranges</button>
              </div>

              {/* Range List */}
              <div className="range-list">
                {ranges.map((r, index) => (
                  <div className="range-item" key={r.id}>
                    <div className="range-header">
                      <span>Range {index + 1}</span>
                      {ranges.length > 1 && (
                        <button className="remove-btn" onClick={() => removeRange(r.id)}>×</button>
                      )}
                    </div>
                    <div className="range-inputs">
                      <div className="input-box">
                        <label>from page</label>
                        <input
                          type="text"
                          value={r.start}
                          placeholder="1"
                          onChange={(e) => updateRange(r.id, 'start', e.target.value)}
                        />
                      </div>
                      <div className="input-box">
                        <label>to</label>
                        <input
                          type="text"
                          value={r.end}
                          placeholder="Max"
                          onChange={(e) => updateRange(r.id, 'end', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="add-range-btn" onClick={addRange}>
                + Add Range
              </button>

              {error && <div style={{ color: '#e5322d', marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', background: '#ffeeee', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}

            </div>

            {/* Footer */}
            <div className="sidebar-footer">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={merge}
                  onChange={(e) => setMerge(e.target.checked)}
                />
                <span>Merge all ranges in one PDF file</span>
              </label>
              <button
                className="split-btn"
                onClick={handleSplit}
                disabled={status !== 'idle' && status !== 'done' && status !== 'error'}
              >
                Split PDF ➔
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
