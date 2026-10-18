import papaparse from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedRow {
  [key: string]: string;
}

export interface ColumnMapping {
  [csvColumn: string]: string; // Maps CSV column name to our field name
}

export interface ClassMapping {
  [fileValue: string]: string; // Maps file class value to class ID
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Auto-match CSV columns to our Student fields
export function autoMatchColumns(headers: string[]): ColumnMapping {
  const fieldAliases: Record<string, string[]> = {
    fullName: ['Student Name', 'Full Name', 'Name', 'StudentName', 'student_name'],
    admissionNo: [
      'Admission No', 'Admission No.', 'Admission Number', 'AdmissionNo', 'Admission_No', 
      'Adm No', 'Adm No.', 'Admission ID', 'Admission Id', 'Reg No', 'Reg No.', 
      'Reg Number', 'Registration Number', 'Reg No', 'Reg'
    ],
    classId: ['Class', 'ClassName', 'class', 'Class Name'],
    gender: ['Gender', 'Sex', 'gender'],
    dateOfBirth: ['DOB', 'Date of Birth', 'Birth Date', 'BirthDate', 'date_of_birth'],
    guardianName: ['Parent Name', 'Guardian Name', 'ParentName', 'GuardianName', 'parent_name'],
    guardianPhone: ['Parent Phone', 'Guardian Phone', 'Phone', 'Contact', 'Mobile', 'parent_phone'],
    address: ['Address', 'Home Address', 'Residential Address', 'address'],
  };

  const mapping: ColumnMapping = {};

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim().replace(/\./g, ''); // Remove periods for comparison
    
    for (const [field, aliases] of Object.entries(fieldAliases)) {
      if (aliases.some(alias => alias.toLowerCase().trim().replace(/\./g, '') === normalizedHeader)) {
        mapping[header] = field;
        break;
      }
    }
  }

  return mapping;
}

// Parse CSV file
export function parseCSV(file: Buffer): Promise<{ headers: string[]; data: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    papaparse.parse(file.toString(), {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          data: results.data as ParsedRow[],
        });
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
}

// Parse Excel file
export function parseExcel(file: Buffer): Promise<{ headers: string[]; data: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    try {
      const workbook = XLSX.read(file, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as ParsedRow[];
      
      if (jsonData.length > 0) {
        const headers = Object.keys(jsonData[0]);
        resolve({ headers, data: jsonData });
      } else {
        resolve({ headers: [], data: [] });
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Determine file type and parse accordingly
export async function parseFile(file: Buffer, originalName: string): Promise<{ headers: string[]; data: ParsedRow[] }> {
  const extension = originalName.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  } else {
    throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
  }
}
