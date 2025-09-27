import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Departments
 *     description: Department management
 *
 * /api/departments:
 *   get:
 *     summary: Retrieve a list of all departments
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: A list of departments.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM departments ORDER BY dept_name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong while fetching departments' });
  }
});

export default router;