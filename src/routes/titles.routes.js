import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Titles
 *     description: Title
 *
 * /api/titles:
 *   get:
 *     summary: Retrieve a list of all titles
 *     tags: [Titles]
 *     responses:
 *       200:
 *         description: A list of Titles.
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM v_title_catalog ORDER BY title');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong while fetching titles' });
  }
});

export default router;