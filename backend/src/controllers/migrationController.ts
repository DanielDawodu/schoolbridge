import { Response } from 'express';
import { parseFile, autoMatchColumns } from '../services/fileParser';
import { validateImport } from '../services/validation';
import Student from '../models/Student';
import MigrationBatch from '../models/MigrationBatch';
import ClassGroup from '../models/ClassGroup';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { headers, data } = await parseFile(req.file.buffer, req.file.originalname);
    const autoMapping = autoMatchColumns(headers);

    res.json({
      headers,
      data, // Return full data
      autoMapping,
      totalRows: data.length,
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse file' });
  }
};

export const validateAndPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { headers, data, columnMapping, classMapping } = req.body;

    if (!data || !Array.isArray(data)) {
      res.status(400).json({ error: 'Invalid data format' });
      return;
    }

    const preview = await validateImport(data, columnMapping, classMapping, req.user?.schoolId || '');

    res.json(preview);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmImport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { validRows, columnMapping, classMapping, fileName } = req.body;

    if (!validRows || !Array.isArray(validRows)) {
      res.status(400).json({ error: 'Invalid data format' });
      return;
    }

    // Create migration batch record
    const batch = new MigrationBatch({
      schoolId: req.user?.schoolId,
      uploadedFileName: fileName,
      columnMapping,
      rowCount: validRows.length,
      errorCount: 0,
      status: 'completed',
      studentIds: [],
    });

    const studentIds: any[] = [];
    const errorData: any[] = [];

    // Import valid rows
    for (const row of validRows) {
      const rowData = row.data || row; // Handle both old and new format
      const mappedData: any = {};
      const mapping = columnMapping as Record<string, string>;
      for (const csvColumn in mapping) {
        const field = mapping[csvColumn];
        mappedData[field] = rowData[csvColumn]?.trim();
      }

      try {
        // Map class value to class ID
        const classMap = classMapping as Record<string, string>;
        const classKey = mappedData.classId as string;
        const classId = classMap[classKey];
        if (!classId) {
          errorData.push({
            admissionNo: mappedData.admissionNo,
            error: 'Class mapping not found',
            rowData: rowData,
          });
          continue;
        }

        const student = new Student({
          schoolId: req.user?.schoolId,
          fullName: mappedData.fullName,
          admissionNo: mappedData.admissionNo,
          classId,
          gender: mappedData.gender || '',
          dateOfBirth: mappedData.dateOfBirth ? new Date(mappedData.dateOfBirth) : undefined,
          guardianName: mappedData.guardianName || '',
          guardianPhone: mappedData.guardianPhone || '',
          address: mappedData.address || '',
          status: 'active',
          migrationBatchId: batch._id,
        });

        const savedStudent = await student.save();
        studentIds.push(savedStudent._id);
      } catch (error) {
        errorData.push({
          admissionNo: mappedData.admissionNo || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          rowData: rowData,
        });
      }
    }

    batch.studentIds = studentIds;
    batch.errorCount = errorData.length;
    batch.errorData = errorData;
    batch.status = errorData.length > 0 ? 'partial' : 'completed';
    await batch.save();

    res.json({
      batchId: batch._id,
      importedCount: studentIds.length,
      errorCount: errorData.length,
      status: batch.status,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500). json({ error: 'Internal server error' });
  }
};

export const getMigrationBatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const batches = await MigrationBatch.find(filter).sort({ importedAt: -1 });
    res.json(batches);
  } catch (error) {
    console.error('Get migration batches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMigrationBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const batch = await MigrationBatch.findOne(filter).populate('studentIds');

    if (!batch) {
      res.status(404).json({ error: 'Migration batch not found' });
      return;
    }

    res.json(batch);
  } catch (error) {
    console.error('Get migration batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadErrorReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const batch = await MigrationBatch.findOne(filter);

    if (!batch) {
      res.status(404).json({ error: 'Migration batch not found' });
      return;
    }

    if (!batch.errorData || batch.errorData.length === 0) {
      res.status(404).json({ error: 'No errors in this batch' });
      return;
    }

    // Generate CSV error report
    const csv = 'Admission No,Error,Raw Data\n' + batch.errorData.map((err: any) => {
      const rawData = Object.values(err.rowData).join(',');
      return `${err.admissionNo},"${err.error}","${rawData}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="error-report-${batch.uploadedFileName}"`);
    res.send(csv);
  } catch (error) {
    console.error('Download error report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rollbackBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const batch = await MigrationBatch.findOne(filter);

    if (!batch) {
      res.status(404).json({ error: 'Migration batch not found' });
      return;
    }

    // Delete all students with this migrationBatchId
    const deleteResult = await Student.deleteMany({
      migrationBatchId: batch._id,
    });

    // Update batch status
    batch.status = 'rolled_back';
    batch.studentIds = [];
    await batch.save();

    res.json({
      message: `Rolled back ${deleteResult.deletedCount} students`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const classes = await ClassGroup.find(filter).sort({ name: 1, arm: 1 });
    res.json(classes);
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, arm, sessionId } = req.body;

    if (!name || !arm) {
      res.status(400).json({ error: 'Name and arm are required' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ error: 'Academic session is required. Please select a session from Settings first.' });
      return;
    }

    const newClass = new ClassGroup({
      schoolId: req.user?.schoolId,
      name,
      arm,
      sessionId,
    });

    const savedClass = await newClass.save();
    res.status(201).json(savedClass);
  } catch (error: any) {
    console.error('Create class error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      res.status(400).json({ error: 'A class with this name and arm already exists for this session' });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
