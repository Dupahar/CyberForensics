import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Shield, Database, FileText, Phone, MessageSquare, Users, Download, Upload, Hash, Clock } from 'lucide-react';
import './App.css';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// API Functions
const api = {
  async createCase(caseData) {
    const response = await fetch(`${API_BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(caseData)
    });
    return response.json();
  },
  
  async getCases() {
    const response = await fetch(`${API_BASE_URL}/api/cases`);
    return response.json();
  },
  
  async uploadEvidence(caseId, file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/upload`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  },
  
  async getCaseEvidence(caseId) {
    const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/evidence`);
    return response.json();
  },
  
  async exportData(exportRequest) {
    const response = await fetch(`${API_BASE_URL}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportRequest)
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition ? 
        contentDisposition.split('filename=')[1].replace(/"/g, '') : 
        'forensics_export.json';
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true, hash: response.headers.get('X-Export-Hash') };
    }
    
    throw new Error('Export failed');
  }
};

// Components
function Header() {
  return (
    <header className="bg-forensics-blue text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8" />
            <h1 className="text-xl font-bold">CyberForensics Data Extraction</h1>
          </Link>
          <nav className="flex space-x-4">
            <Link to="/" className="hover:text-blue-200 transition-colors">Cases</Link>
            <Link to="/about" className="hover:text-blue-200 transition-colors">About</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Dashboard() {
  const [cases, setCases] = useState([]);
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCase, setNewCase] = useState({ case_name: '', investigator: '', description: '' });
  const navigate = useNavigate();

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const response = await api.getCases();
      setCases(response.cases);
    } catch (error) {
      console.error('Error loading cases:', error);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    try {
      const response = await api.createCase(newCase);
      if (response.success) {
        setShowNewCaseForm(false);
        setNewCase({ case_name: '', investigator: '', description: '' });
        loadCases();
      }
    } catch (error) {
      console.error('Error creating case:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-forensics-gray">Forensics Cases</h2>
        <button
          onClick={() => setShowNewCaseForm(true)}
          className="forensics-button-primary flex items-center space-x-2"
        >
          <Database className="h-4 w-4" />
          <span>New Case</span>
        </button>
      </div>

      {showNewCaseForm && (
        <div className="forensics-card mb-8">
          <h3 className="text-xl font-semibold mb-4">Create New Case</h3>
          <form onSubmit={handleCreateCase} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Name</label>
              <input
                type="text"
                value={newCase.case_name}
                onChange={(e) => setNewCase({...newCase, case_name: e.target.value})}
                className="forensics-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Investigator</label>
              <input
                type="text"
                value={newCase.investigator}
                onChange={(e) => setNewCase({...newCase, investigator: e.target.value})}
                className="forensics-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newCase.description}
                onChange={(e) => setNewCase({...newCase, description: e.target.value})}
                className="forensics-input"
                rows="3"
              />
            </div>
            <div className="flex space-x-2">
              <button type="submit" className="forensics-button-primary">Create Case</button>
              <button 
                type="button" 
                onClick={() => setShowNewCaseForm(false)}
                className="forensics-button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cases.map(case_item => (
          <div key={case_item.case_id} className="forensics-card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-forensics-gray">{case_item.case_name}</h3>
              <span className="evidence-badge-success">{case_item.status}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">Investigator: {case_item.investigator}</p>
            <p className="text-sm text-gray-600 mb-4">{case_item.description}</p>
            <div className="flex items-center text-xs text-gray-500 mb-4">
              <Clock className="h-3 w-3 mr-1" />
              Created: {new Date(case_item.created_at).toLocaleDateString()}
            </div>
            <button
              onClick={() => navigate(`/case/${case_item.case_id}`)}
              className="forensics-button-primary w-full"
            >
              Open Case
            </button>
          </div>
        ))}
      </div>

      {cases.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No cases found. Create your first forensics case to get started.</p>
        </div>
      )}
    </div>
  );
}

function CaseDetail({ caseId }) {
  const [caseData, setCaseData] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState([]);
  const [exportFormat, setExportFormat] = useState('json');

  useEffect(() => {
    loadCaseData();
    loadEvidence();
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      const response = await api.getCases();
      const case_item = response.cases.find(c => c.case_id === caseId);
      setCaseData(case_item);
    } catch (error) {
      console.error('Error loading case data:', error);
    }
  };

  const loadEvidence = async () => {
    try {
      const response = await api.getCaseEvidence(caseId);
      setEvidence(response.evidence);
    } catch (error) {
      console.error('Error loading evidence:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const response = await api.uploadEvidence(caseId, file);
      if (response.success) {
        loadEvidence();
        event.target.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDataTypeToggle = (dataType) => {
    setSelectedDataTypes(prev => 
      prev.includes(dataType) 
        ? prev.filter(t => t !== dataType)
        : [...prev, dataType]
    );
  };

  const handleExport = async () => {
    if (selectedDataTypes.length === 0) {
      alert('Please select at least one data type to export');
      return;
    }

    try {
      const response = await api.exportData({
        case_id: caseId,
        data_types: selectedDataTypes,
        export_format: exportFormat
      });
      
      if (response.success) {
        alert(`Export completed successfully. File hash: ${response.hash}`);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Export failed. Please try again.');
    }
  };

  if (!caseData) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  const totalCounts = evidence.reduce((acc, ev) => {
    acc.messages += ev.summary?.messages_count || 0;
    acc.contacts += ev.summary?.contacts_count || 0;
    acc.call_logs += ev.summary?.call_logs_count || 0;
    return acc;
  }, { messages: 0, contacts: 0, call_logs: 0 });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/" className="text-forensics-blue hover:underline mb-2 inline-block">
          ← Back to Cases
        </Link>
        <h2 className="text-3xl font-bold text-forensics-gray">{caseData.case_name}</h2>
        <p className="text-gray-600">Investigator: {caseData.investigator}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Evidence Upload */}
        <div className="lg:col-span-2 space-y-6">
          <div className="forensics-card">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Upload Evidence
            </h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".db,.sqlite,.sqlite3,.zip"
                className="hidden"
                id="evidence-upload"
                disabled={uploadingFile}
              />
              <label
                htmlFor="evidence-upload"
                className={`${uploadingFile ? 'cursor-not-allowed' : 'cursor-pointer'} flex flex-col items-center`}
              >
                <Database className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">
                  {uploadingFile ? 'Processing...' : 'Click to upload evidence files'}
                </p>
                <p className="text-sm text-gray-500">
                  Supported: .db, .sqlite, .sqlite3, .zip (Android/iOS backups)
                </p>
              </label>
            </div>
          </div>

          {/* Evidence List */}
          <div className="forensics-card">
            <h3 className="text-xl font-semibold mb-4">Evidence Files</h3>
            {evidence.length > 0 ? (
              <div className="space-y-4">
                {evidence.map(ev => (
                  <div key={ev.evidence_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{ev.filename}</h4>
                      <span className="evidence-badge-success">Processed</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {ev.summary?.messages_count || 0} Messages
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {ev.summary?.contacts_count || 0} Contacts
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {ev.summary?.call_logs_count || 0} Call Logs
                      </div>
                    </div>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <Hash className="h-3 w-3 mr-1" />
                      SHA-256: {ev.file_hash?.substring(0, 16)}...
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No evidence files uploaded yet.</p>
            )}
          </div>
        </div>

        {/* Export Panel */}
        <div className="forensics-card">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Export Data
          </h3>

          {/* Data Summary */}
          <div className="mb-6 space-y-2">
            <div className="flex justify-between">
              <span>Messages:</span>
              <span className="font-medium">{totalCounts.messages}</span>
            </div>
            <div className="flex justify-between">
              <span>Contacts:</span>
              <span className="font-medium">{totalCounts.contacts}</span>
            </div>
            <div className="flex justify-between">
              <span>Call Logs:</span>
              <span className="font-medium">{totalCounts.call_logs}</span>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Data Types:</label>
              <div className="space-y-2">
                {['messages', 'contacts', 'call_logs'].map(dataType => (
                  <label key={dataType} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedDataTypes.includes(dataType)}
                      onChange={() => handleDataTypeToggle(dataType)}
                      className="mr-2"
                    />
                    <span className="capitalize">{dataType.replace('_', ' ')}</span>
                    <span className="ml-auto text-sm text-gray-500">
                      ({totalCounts[dataType]})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format:</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="forensics-input"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              disabled={selectedDataTypes.length === 0}
              className={`w-full ${selectedDataTypes.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'forensics-button-primary'}`}
            >
              Export Selected Data
            </button>
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Security Note:</strong> All exports include SHA-256 hashes for integrity verification and forensics-grade timestamps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="forensics-card max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-forensics-gray mb-6">About CyberForensics Data Extraction Tool</h2>
        
        <div className="space-y-6">
          <section>
            <h3 className="text-xl font-semibold mb-3">Purpose</h3>
            <p className="text-gray-700">
              This tool is designed specifically for cybersecurity professionals and digital forensics investigators 
              to extract and export digital evidence from mobile devices in a forensically sound manner.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Key Features</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-evidence-green mr-2">•</span>
                <strong>Message Extraction:</strong> Extract SMS, MMS, WhatsApp, Telegram and other messaging data
              </li>
              <li className="flex items-start">
                <span className="text-evidence-green mr-2">•</span>
                <strong>Contact Export:</strong> Extract address books and contact information
              </li>
              <li className="flex items-start">
                <span className="text-evidence-green mr-2">•</span>
                <strong>Call Log Analysis:</strong> Extract call history with timestamps and metadata
              </li>
              <li className="flex items-start">
                <span className="text-evidence-green mr-2">•</span>
                <strong>Data Integrity:</strong> SHA-256 hashing for evidence verification
              </li>
              <li className="flex items-start">
                <span className="text-evidence-green mr-2">•</span>
                <strong>Forensics Timestamps:</strong> UTC timestamps for court admissibility
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Supported Sources</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• Android device backups and SQLite databases</li>
              <li>• iOS device backups and plist files</li>
              <li>• Local database files (.db, .sqlite, .sqlite3)</li>
              <li>• Compressed backup archives (.zip)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Export Formats</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>JSON:</strong> Structured data format for programmatic analysis</li>
              <li>• <strong>CSV:</strong> Spreadsheet format for human review and reporting</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Security & Compliance</h3>
            <p className="text-gray-700">
              All extracted data includes cryptographic hashes for integrity verification and 
              forensics-grade timestamps to ensure evidence admissibility in legal proceedings. 
              The tool follows digital forensics best practices for evidence handling.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/case/:caseId" element={<CaseDetailWrapper />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function CaseDetailWrapper() {
  const { caseId } = useParams();
  return <CaseDetail caseId={caseId} />;
}



export default App;