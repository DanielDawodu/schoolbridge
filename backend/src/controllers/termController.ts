import { Response } from 'express';
import Term from '../models/Term';
import { AuthRequest } from '../middleware/auth';
import { addSchoolFilter } from '../middleware/multiTenant';

export const createTerm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, order } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Term name is required' });
      return;
    }

    const term = new Term({
      schoolId: req.user?.schoolId,
      name,
      order: order || 0,
    });
    await term.save();

    res.status(201).json(term);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Term with this name already exists' });
      return;
    }
    console.error('Create term error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTerms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = addSchoolFilter(req);
    const terms = await Term.find(filter).sort({ order: 1, name: 1 });
    res.json(terms);
  } catch (error) {
    console.error('Get terms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTerm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, order } = req.body;

    const filter = addSchoolFilter(req, { _id: id });
    const term = await Term.findOneAndUpdate(
      filter,
      { name, order },
      { new: true }
    );

    if (!term) {
      res.status(404).json({ error: 'Term not found' });
      return;
    }

    res.json(term);
  } catch (error) {
    console.error('Update term error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTerm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const filter = addSchoolFilter(req, { _id: id });
    const term = await Term.findOneAndDelete(filter);

    if (!term) {
      res.status(404).json({ error: 'Term not found' });
      return;
    }

    res.json({ message: 'Term deleted successfully' });
  } catch (error) {
    console.error('Delete term error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
