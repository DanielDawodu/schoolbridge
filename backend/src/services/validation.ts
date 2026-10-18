import Student from '../models/Student';
import ClassGroup from '../models/ClassGroup';
import ClassLevel from '../models/ClassLevel';
import { ColumnMapping, ClassMapping } from './fileParser';

export interface ParsedRow {
  [key: string]: string;
}

export interface ValidatedRow {
  data: ParsedRow;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  originalRowIndex: number;
}

export interface ImportPreview {
  totalRows: number;
  validRows: ValidatedRow[];
  flaggedRows: ValidatedRow[];
  requiredFields: string[];
  mappedFields: string[];
  unmatchedClasses: string[]; // List of class values that don't match existing classes
}

const REQUIRED_FIELDS = ['fullName', 'admissionNo', 'classId'];
const VALID_FIELDS = ['fullName', 'admissionNo', 'classId', 'gender', 'dateOfBirth', 'guardianName', 'guardianPhone', 'address'];

export async function validateRow(
  row: ParsedRow,
  columnMapping: ColumnMapping,
  classMapping: ClassMapping,
  schoolId: string,
  rowIndex: number,
  existingAdmissionNos: Set<string>,
  existingClasses: any[],
  classColumn?: string
): Promise<ValidatedRow> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if required fields are mapped
  const mappedFields = Object.values(columnMapping);
  const missingRequiredFields = REQUIRED_FIELDS.filter(field => !mappedFields.includes(field));
  
  if (missingRequiredFields.length > 0) {
    errors.push(`Missing required field mappings: ${missingRequiredFields.join(', ')}`);
  }

  // Map row data using column mapping
  const mappedData: any = {};
  for (const [csvColumn, field] of Object.entries(columnMapping)) {
    mappedData[field] = row[csvColumn]?.trim();
  }

  // Validate required fields have values
  for (const field of REQUIRED_FIELDS) {
    if (!mappedData[field] || mappedData[field].trim() === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check if class value is unmatched
  if (classColumn && mappedData.classId) {
    const isMapped = classMapping[mappedData.classId];

    // If not mapped, check if it exists in school's classes
    if (!isMapped) {
      const classExists = existingClasses.some(cls => {
        const levelName = (cls as any).classLevelId?.name || 'Unknown';
        const classKey = `${levelName}-${cls.arm}`.toLowerCase();
        const normalizedValue = mappedData.classId.toLowerCase();
        return classKey === normalizedValue ||
               levelName.toLowerCase() === normalizedValue ||
               normalizedValue.includes(levelName.toLowerCase());
      });

      if (!classExists) {
        errors.push(`Unrecognized class: '${mappedData.classId}' — no matching class found`);
      }
    }
  }

  // Validate admissionNo uniqueness within school
  if (mappedData.admissionNo) {
    if (existingAdmissionNos.has(mappedData.admissionNo)) {
      errors.push('Admission number already exists in database');
    }
  }

  // Validate date format
  if (mappedData.dateOfBirth) {
    const date = new Date(mappedData.dateOfBirth);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format for date of birth');
    }
  }

  // Validate phone number (basic validation)
  if (mappedData.guardianPhone) {
    const phoneClean = mappedData.guardianPhone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
      warnings.push('Phone number may be invalid (too short)');
    }
  }

  // Validate gender
  if (mappedData.gender) {
    const validGenders = ['male', 'female', 'm', 'f', 'boy', 'girl', 'man', 'woman'];
    if (!validGenders.includes(mappedData.gender.toLowerCase())) {
      warnings.push('Gender value may be invalid');
    }
  }

  return {
    data: row,
    isValid: errors.length === 0,
    errors,
    warnings,
    originalRowIndex: rowIndex,
  };
}

export async function validateImport(
  data: ParsedRow[],
  columnMapping: ColumnMapping,
  classMapping: ClassMapping,
  schoolId: string
): Promise<ImportPreview> {
  const validRows: ValidatedRow[] = [];
  const flaggedRows: ValidatedRow[] = [];

  // Get existing admission numbers for this school
  const existingStudents = await Student.find({ schoolId }).select('admissionNo');
  const existingAdmissionNos = new Set(existingStudents.map(s => s.admissionNo));

  // Get existing classes for this school
  const existingClasses = await ClassGroup.find({ schoolId }).populate('classLevelId');
  const existingClassKeys = new Set(
    existingClasses.map(cls => {
      const levelName = (cls as any).classLevelId?.name || 'Unknown';
      return `${levelName}-${cls.arm}`.toLowerCase();
    })
  );

  // Extract class values from data
  const classColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'classId');
  const classValuesInFile = classColumn 
    ? [...new Set(data.map(row => row[classColumn]?.trim()).filter(Boolean))]
    : [];

  // Find unmatched classes
  const unmatchedClasses = classValuesInFile.filter(value => {
    // Check if class is mapped
    if (classMapping[value]) return false;

    // Check if class exists by name+arm match
    const normalizedValue = value.toLowerCase();
    for (const cls of existingClasses) {
      const levelName = (cls as any).classLevelId?.name || 'Unknown';
      const classKey = `${levelName}-${cls.arm}`.toLowerCase();
      if (classKey === normalizedValue ||
          levelName.toLowerCase() === normalizedValue ||
          normalizedValue.includes(levelName.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  // Check for duplicates within the file
  const admissionNosInFile = new Map<string, number>();
  data.forEach((row, index) => {
    const admissionNo = row[Object.keys(columnMapping).find(key => columnMapping[key] === 'admissionNo') || ''];
    if (admissionNo) {
      if (admissionNosInFile.has(admissionNo)) {
        flaggedRows.push({
          data: row,
          isValid: false,
          errors: [`Duplicate admission number within file (also in row ${admissionNosInFile.get(admissionNo)})`],
          warnings: [],
          originalRowIndex: index,
        });
      } else {
        admissionNosInFile.set(admissionNo, index);
      }
    }
  });

  // Validate each row
  for (let i = 0; i < data.length; i++) {
    // Skip if already flagged as duplicate
    if (flaggedRows.find(r => r.originalRowIndex === i)) continue;

    const validated = await validateRow(
      data[i],
      columnMapping,
      classMapping,
      schoolId,
      i,
      existingAdmissionNos,
      existingClasses,
      classColumn
    );

    if (validated.isValid) {
      validRows.push(validated);
    } else {
      flaggedRows.push(validated);
    }
  }

  return {
    totalRows: data.length,
    validRows,
    flaggedRows,
    requiredFields: REQUIRED_FIELDS,
    mappedFields: Object.values(columnMapping),
    unmatchedClasses,
  };
}
