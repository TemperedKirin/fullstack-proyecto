import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Employees
 *     description: CRUD de empleados (tabla `employees`)
 *
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       properties:
 *         emp_no:     { type: integer, example: 500001 }
 *         birth_date: { type: string, format: date, example: "1990-05-21" }
 *         first_name: { type: string, example: "Maria" }
 *         last_name:  { type: string, example: "Lopez" }
 *         gender:     { type: string, enum: [M, F], example: "F" }
 *         hire_date:  { type: string, format: date, example: "2024-01-15" }
 *     EmployeeCreate:
 *       type: object
 *       required: [birth_date, first_name, last_name, gender, hire_date]
 *       properties:
 *         birth_date: { type: string, format: date }
 *         first_name: { type: string }
 *         last_name:  { type: string }
 *         gender:     { type: string, enum: [M, F] }
 *         hire_date:  { type: string, format: date }
 *     EmployeeUpdate:
 *       type: object
 *       properties:
 *         birth_date: { type: string, format: date }
 *         first_name: { type: string }
 *         last_name:  { type: string }
 *         gender:     { type: string, enum: [M, F] }
 *         hire_date:  { type: string, format: date }
 */

// Helper: obtener siguiente emp_no (la tabla no es AUTO_INCREMENT)
async function nextEmpNo() {
  const [[{ mx }]] = await pool.query('SELECT MAX(emp_no) AS mx FROM employees');
  return (mx || 0) + 1;
}

/**
 * @openapi
 * /api/employees:
 *   get:
 *     tags: [Employees]
 *     summary: Listar empleados (paginado + búsqueda)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Búsqueda por nombre o apellido
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '10', 10), 1), 100);
    const q = (req.query.q || '').trim();

    const where = q ? 'WHERE first_name LIKE ? OR last_name LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`] : [];

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM v_employees_full_info ${where}`,
      params
    );

    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query(
      `SELECT emp_no, birth_date, first_name, last_name, gender, hire_date, title, salary, dept_name
         FROM v_employees_full_info ${where}
        ORDER BY emp_no DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando empleados' });
  }
});

/**
 * @openapi
 * /api/employees/{emp_no}:
 *   get:
 *     tags: [Employees]
 *     summary: Obtener empleado por emp_no
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       404: { description: No encontrado }
 */
router.get('/:emp_no', async (req, res) => {
  try {
    const emp_no = parseInt(req.params.emp_no, 10);
    const [rows] = await pool.query(
      'SELECT emp_no, birth_date, first_name, last_name, gender, hire_date, title, salary, dept_name FROM v_employees_full_info WHERE emp_no = ?',
      [emp_no]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo empleado' });
  }
});

/**
 * @openapi
 * /api/employees:
 *   post:
 *     tags: [Employees]
 *     summary: Crear empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmployeeCreate' }
 *     responses:
 *       201: { description: Creado }
 */
router.post('/', async (req, res) => {
  const { birth_date, first_name, last_name, gender, hire_date, title, salary, dept_no } = req.body || {};
  if (!birth_date || !first_name || !last_name || !gender || !hire_date || !title || !salary || !dept_no) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const emp_no = await nextEmpNo();
    const today = new Date().toISOString().slice(0, 10);

    await conn.query(
      `INSERT INTO employees (emp_no, birth_date, first_name, last_name, gender, hire_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [emp_no, birth_date, first_name, last_name, gender, hire_date]
    );

    await conn.query(
      'INSERT INTO titles (emp_no, title, from_date, to_date) VALUES (?, ?, ?, ?)',
      [emp_no, title, today, '9999-01-01']
    );

    await conn.query(
      'INSERT INTO salaries (emp_no, salary, from_date, to_date) VALUES (?, ?, ?, ?)',
      [emp_no, salary, today, '9999-01-01']
    );

    await conn.query(
      'INSERT INTO dept_emp (emp_no, dept_no, from_date, to_date) VALUES (?, ?, ?, ?)',
      [emp_no, dept_no, today, '9999-01-01']
    );

    await conn.commit();

    res.status(201).json({ emp_no, birth_date, first_name, last_name, gender, hire_date });
  } catch (err) {
    console.error(err);
    await conn.rollback();
    res.status(500).json({ error: 'Error creando empleado' });
  } finally {
    conn.release();
  }
});

/**
 * @openapi
 * /api/employees/{emp_no}:
 *   put:
 *     tags: [Employees]
 *     summary: Actualizar empleado
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmployeeUpdate' }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Nada que actualizar }
 *       404: { description: No encontrado }
 */
router.put('/:emp_no', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const emp_no = parseInt(req.params.emp_no, 10);
    const { birth_date, first_name, last_name, gender, hire_date, title, salary, dept_no } = req.body || {};

    await conn.beginTransaction();

    // 1. Verificar que el empleado existe
    const [exists] = await conn.query('SELECT 1 FROM employees WHERE emp_no = ?', [emp_no]);
    if (exists.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    // 2. Actualizar `employees`
    const employeeFields = { birth_date, first_name, last_name, gender, hire_date };
    const employeeUpdates = Object.keys(employeeFields)
      .filter(key => employeeFields[key] !== undefined)
      .map(key => `${key} = ?`);

    if (employeeUpdates.length > 0) {
      const employeeValues = Object.values(employeeFields).filter(val => val !== undefined);
      await conn.query(
        `UPDATE employees SET ${employeeUpdates.join(', ')} WHERE emp_no = ?`,
        [...employeeValues, emp_no]
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    // 3. Actualizar `titles` (si se proveyó)
    if (title) {
      // Terminar todos los puestos anteriores para este empleado
      await conn.query('UPDATE titles SET to_date = ? WHERE emp_no = ? AND to_date > ?', [today, emp_no, today]);
      await conn.query('INSERT INTO titles (emp_no, title, from_date, to_date) VALUES (?, ?, ?, ?)', [emp_no, title, today, '9999-01-01']);
    }

    // 4. Actualizar `salaries` (si se proveyó)
    if (salary) {
      const [[currentSalary]] = await conn.query('SELECT salary FROM salaries WHERE emp_no = ? AND from_date = ?', [emp_no, today]);
      if (currentSalary) {
        await conn.query('UPDATE salaries SET salary = ? WHERE emp_no = ? AND from_date = ?', [salary, emp_no, today]);
      } else {
        await conn.query('UPDATE salaries SET to_date = ? WHERE emp_no = ? AND to_date > ?', [today, emp_no, today]);
        await conn.query('INSERT INTO salaries (emp_no, salary, from_date, to_date) VALUES (?, ?, ?, ?)', [emp_no, salary, today, '9999-01-01']);
      }
    }

    // 5. Actualizar `dept_emp` (si se proveyó)
    if (dept_no) {
      // Terminar todas las asignaciones de departamento anteriores para este empleado
      await conn.query('UPDATE dept_emp SET to_date = ? WHERE emp_no = ?', [today, emp_no]);
      await conn.query('INSERT INTO dept_emp (emp_no, dept_no, from_date, to_date) VALUES (?, ?, ?, ?)', [emp_no, dept_no, today, '9999-01-01']);
    }

    if (employeeUpdates.length === 0 && !title && !salary && !dept_no) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    await conn.commit();

    const [rows] = await conn.query(
      'SELECT emp_no, birth_date, first_name, last_name, gender, hire_date, title, salary, dept_name FROM v_employees_full_info WHERE emp_no = ?',
      [emp_no]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    if (conn) {
      try { await conn.rollback(); } catch (e) { console.error('Error on rollback', e); }
    }
    res.status(500).json({ error: 'Error actualizando empleado' });
  } finally {
    if (conn) {
      try { conn.release(); } catch (e) { console.error('Error releasing connection', e); }
      }
  }
});

/**
 * @openapi
 * /api/employees/{emp_no}:
 *   delete:
 *     tags: [Employees]
 *     summary: Borrar empleado (limpia registros relacionados)
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Borrado }
 *       404: { description: No encontrado }
 */
router.delete('/:emp_no', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const emp_no = parseInt(req.params.emp_no, 10);

    await conn.beginTransaction();

    const [exists] = await conn.query('SELECT 1 FROM employees WHERE emp_no = ?', [emp_no]);
    if (exists.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    // Limpiar dependencias comunes de la BD de ejemplo
    await conn.query('DELETE FROM dept_manager WHERE emp_no = ?', [emp_no]);
    await conn.query('DELETE FROM dept_emp     WHERE emp_no = ?', [emp_no]);
    await conn.query('DELETE FROM titles       WHERE emp_no = ?', [emp_no]);
    await conn.query('DELETE FROM salaries     WHERE emp_no = ?', [emp_no]);

    const [result] = await conn.query('DELETE FROM employees WHERE emp_no = ?', [emp_no]);

    await conn.commit();
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    try { await conn.rollback(); } catch {}
    try { conn.release(); } catch {}
    res.status(500).json({ error: 'Error borrando empleado' });
  }
});

export default router;
