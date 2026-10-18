import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface ClassGroup {
  _id: string;
  name: string;
  arm: string;
}

interface ColumnMapping {
  [csvColumn: string]: string;
}

interface ClassMapping {
  [fileValue: string]: string;
}

interface ValidatedRow {
  data: { [key: string]: string };
  isValid: boolean;
  errors: string[];
  warnings: string[];
  originalRowIndex: number;
}

interface ImportPreview {
  totalRows: number;
  validRows: ValidatedRow[];
  flaggedRows: ValidatedRow[];
  requiredFields: string[];
  mappedFields: string[];
  unmatchedClasses: string[];
}

interface MigrationBatch {
  _id: string;
  uploadedFileName: string;
  columnMapping: ColumnMapping;
  rowCount: number;
  errorCount: number;
  importedAt: string;
  status: string;
  studentIds: string[];
}

const Migration: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'classMapping' | 'preview' | 'success' | 'history'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [classMapping, setClassMapping] = useState<ClassMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<MigrationBatch[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassArm, setNewClassArm] = useState('');
  const [unmatchedClasses, setUnmatchedClasses] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  useEffect(() => {
    fetchClasses();
    fetchBatches();
    fetchSessions();
  }, []); // Only fetch on mount

  const fetchClasses = async () => {
    try {
      const response = await api.get('/migration/classes');
      setClasses(response.data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get('/academic-sessions');
      if (response.data.length > 0) {
        // Set the first/current session as default
        const currentSession = response.data.find((s: any) => s.currentTerm) || response.data[0];
        setCurrentSessionId(currentSession._id);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await api.get('/migration/batches');
      setBatches(response.data);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit');
      return;
    }

    setFile(selectedFile);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setLoading(true);
      const response = await api.post('/migration/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setHeaders(response.data.headers);
      setSampleData(response.data.data);
      setColumnMapping(response.data.autoMapping);
      setStep('mapping');
    } catch (error: any) {
      console.error('File upload error:', error);
      setUploadError(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingSubmit = async () => {
    // Validate that all required fields are mapped
    const requiredFields = ['fullName', 'admissionNo', 'classId'];
    const mappedFields = Object.values(columnMapping);
    const missingFields = requiredFields.filter(field => !mappedFields.includes(field));

    if (missingFields.length > 0) {
      alert(`Please map the following required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Auto-detect class values and prompt for mapping
    const classColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'classId');
    
    if (classColumn) {
      const classValues = [...new Set(sampleData.map(row => row[classColumn]))];
      const unmappedClasses = classValues.filter(value => !classMapping[value]);

      if (unmappedClasses.length > 0) {
        // Try to auto-match to existing classes
        const newMapping: ClassMapping = { ...classMapping };
        let autoMatchedCount = 0;
        
        unmappedClasses.forEach(value => {
          const matchedClass = classes.find(cls => 
            cls.name.toLowerCase().includes(value.toLowerCase()) || 
            value.toLowerCase().includes(cls.name.toLowerCase())
          );
          if (matchedClass) {
            newMapping[value] = matchedClass._id;
            autoMatchedCount++;
          }
        });
        
        setClassMapping(newMapping);
        
        // If we couldn't auto-match all classes, show class mapping screen
        const stillUnmapped = classValues.filter(value => !newMapping[value]);
        
        if (stillUnmapped.length > 0) {
          setUnmatchedClasses(stillUnmapped);
          setStep('classMapping');
          return;
        }
      }
    }

    // Validate import
    try {
      setLoading(true);
      const response = await api.post('/migration/validate', {
        headers,
        data: sampleData,
        columnMapping,
        classMapping,
      });
      setPreview(response.data);
      
      // Check if validation found unmatched classes
      if (response.data.unmatchedClasses && response.data.unmatchedClasses.length > 0) {
        setUnmatchedClasses(response.data.unmatchedClasses);
        setStep('classMapping');
      } else {
        setStep('preview');
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      alert(error.response?.data?.error || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName || !newClassArm) {
      alert('Please enter class name and arm');
      return;
    }

    if (!currentSessionId) {
      alert('No academic session found. Please create a session in Settings first.');
      return;
    }

    try {
      const response = await api.post('/migration/classes', {
        name: newClassName,
        arm: newClassArm,
        sessionId: currentSessionId,
      });

      // Add new class to state
      setClasses([...classes, response.data]);
      
      // Auto-map the new class
      const classColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'classId');
      if (classColumn && unmatchedClasses.length > 0) {
        const classValue = unmatchedClasses.find(
          val => val.toLowerCase() === `${newClassName}-${newClassArm}`.toLowerCase() ||
                 val.toLowerCase().includes(newClassName.toLowerCase())
        );
        if (classValue) {
          setClassMapping({ ...classMapping, [classValue]: response.data._id });
        }
      }

      setNewClassName('');
      setNewClassArm('');
      
      // Re-validate after class creation
      await handleRevalidate();
    } catch (error: any) {
      console.error('Create class error:', error);
      alert(error.response?.data?.error || 'Failed to create class');
    }
  };

  const handleRevalidate = async () => {
    try {
      setLoading(true);
      const response = await api.post('/migration/validate', {
        headers,
        data: sampleData,
        columnMapping,
        classMapping,
      });
      console.log('Re-validation response:', response.data);
      setPreview(response.data);
      setUnmatchedClasses(response.data.unmatchedClasses || []);
      
      // If no more unmatched classes, proceed to preview
      if (!response.data.unmatchedClasses || response.data.unmatchedClasses.length === 0) {
        console.log('No unmatched classes, proceeding to preview');
        setStep('preview');
      } else {
        console.log('Still have unmatched classes:', response.data.unmatchedClasses);
      }
    } catch (error: any) {
      console.error('Re-validation error:', error);
      alert(error.response?.data?.error || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClassMappingChange = (classValue: string, classId: string) => {
    setClassMapping({ ...classMapping, [classValue]: classId });
  };

  const handleProceedToPreview = async () => {
    await handleRevalidate();
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    try {
      setLoading(true);
      await api.post('/migration/confirm', {
        validRows: preview.validRows.map(row => row.data),
        columnMapping,
        classMapping,
        fileName: file?.name || 'import.csv',
      });

      setStep('success');
      fetchBatches();
    } catch (error: any) {
      console.error('Import error:', error);
      alert(error.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (batchId: string) => {
    if (!confirm('Are you sure you want to rollback this import? This will delete all students from this batch.')) return;

    try {
      await api.delete(`/migration/batches/${batchId}/rollback`);
      alert('Rollback successful');
      fetchBatches();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Rollback failed');
    }
  };

  const handleDownloadErrorReport = async (batchId: string, fileName: string) => {
    try {
      const response = await api.get(`/migration/batches/${batchId}/error-report`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `error-report-${fileName}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download error report');
    }
  };

  const resetUpload = () => {
    setFile(null);
    setHeaders([]);
    setSampleData([]);
    setColumnMapping({});
    setClassMapping({});
    setPreview(null);
    setUploadError('');
    setStep('upload');
  };

  if (showHistory) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Migration History</h1>
          <button
            onClick={() => setShowHistory(false)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            New Import
          </button>
        </div>

        {batches.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">No migration history found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rows Imported
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batches.map((batch) => (
                  <tr key={batch._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.uploadedFileName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(batch.importedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.studentIds.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.errorCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          batch.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : batch.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : batch.status === 'rolled_back'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {batch.errorCount > 0 && (
                        <button
                          onClick={() => handleDownloadErrorReport(batch._id, batch.uploadedFileName)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          Download Report
                        </button>
                      )}
                      {batch.status !== 'rolled_back' && (
                        <button
                          onClick={() => handleRollback(batch._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Student Migration</h1>
        <button
          onClick={() => setShowHistory(true)}
          className="text-indigo-600 hover:text-indigo-700"
        >
          View History
        </button>
      </div>

      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            <div className="mx-auto h-32 w-32 mb-4 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl">📁</span>
                <p className="text-sm text-gray-500 mt-2">Upload CSV or Excel</p>
              </div>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 cursor-pointer"
            >
              Select File
            </label>
            {uploadError && (
              <p className="text-red-600 text-sm mt-4">{uploadError}</p>
            )}
            <p className="text-gray-500 text-sm mt-4">
              Maximum file size: 5MB
            </p>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Map Columns</h2>
          <p className="text-gray-600 mb-4">
            We found {headers.length} columns in your file. Please verify the automatic mapping:
          </p>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Validating...</span>
            </div>
          )}

          {!loading && (
            <>
              <div className="space-y-4 mb-6">
                {headers.map((header) => (
                  <div key={header} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {header}
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        value={columnMapping[header] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                        placeholder="Select field"
                      />
                    </div>
                    <div className="w-32">
                      <span className="text-sm text-gray-500">→</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-gray-700">
                        {columnMapping[header] || 'Unmapped'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetUpload}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMappingSubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Validating...' : 'Continue to Preview'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'classMapping' && (
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Map Classes</h2>
          <p className="text-gray-600 mb-4">
            The following class values from your file don't match existing classes. Please map them or create new classes:
          </p>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Validating...</span>
            </div>
          )}

          {!loading && unmatchedClasses.length > 0 && (
            <div className="space-y-4 mb-6">
              {unmatchedClasses.map((classValue) => (
                <div key={classValue} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">{classValue}</span>
                    <span className="text-sm text-red-600">Unmatched</span>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                    <div className="flex-1 min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Map to existing class
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        value={classMapping[classValue] || ''}
                        onChange={(e) => handleClassMappingChange(classValue, e.target.value)}
                      >
                        <option value="">Select a class...</option>
                        {classes.map((cls) => (
                          <option key={cls._id} value={cls._id}>
                            {cls.name} - {cls.arm}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center md:flex-shrink-0">
                      <span className="text-gray-500">or</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Create new class
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Name (e.g., JSS 1)"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                        />
                        <input
                          type="text"
                          className="w-20 flex-shrink-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Arm"
                          value={newClassArm}
                          onChange={(e) => setNewClassArm(e.target.value)}
                        />
                        <button
                          onClick={() => {
                            const parts = classValue.split('-');
                            setNewClassName(parts[0]?.trim() || classValue);
                            setNewClassArm(parts[1]?.trim() || 'A');
                          }}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 whitespace-nowrap flex-shrink-0"
                        >
                          Use Value
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && unmatchedClasses.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800">All classes have been mapped successfully!</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
            <button
              onClick={resetUpload}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateClass}
              disabled={!newClassName || !newClassArm || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Class'}
            </button>
            <button
              onClick={handleProceedToPreview}
              disabled={
                loading || 
                unmatchedClasses.some(val => !classMapping[val])
              }
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Continue to Preview'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Import Preview</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800">Valid Rows</h3>
              <p className="text-3xl font-bold text-green-900">{preview.validRows.length}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800">Flagged Rows</h3>
              <p className="text-3xl font-bold text-red-900">{preview.flaggedRows.length}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800">Total Rows</h3>
              <p className="text-3xl font-bold text-blue-900">{preview.totalRows}</p>
            </div>
          </div>

          {preview.flaggedRows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Flagged Rows</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Row
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Errors
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.flaggedRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          #{row.originalRowIndex + 1}
                        </td>
                        <td className="px-4 py-2 text-sm text-red-600">
                          {row.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={resetUpload}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={preview.validRows.length === 0 || loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Importing...' : `Import ${preview.validRows.length} Valid Rows`}
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Successful!</h2>
          <p className="text-gray-600 mb-6">
            Students have been imported successfully.
          </p>
          <button
            onClick={resetUpload}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
};

export default Migration;
