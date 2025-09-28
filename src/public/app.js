// Base de la API
const apiBase = `${window.location.origin}/api/employees`;

const state = {
  page: 1,
  pageSize: 10,
  q: ""
};

// Helpers DOM
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---- Renderizado de tabla y paginación ----
async function list() {
  const url = new URL(apiBase);
  url.searchParams.set("page", state.page);
  url.searchParams.set("pageSize", state.pageSize);
  if (state.q) url.searchParams.set("q", state.q);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo listar");
    const json = await res.json();
    renderTable(json.data || []);
    renderPager(json.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 });
  } catch (err) {
    alert(err.message || "Error de red");
  }
}

function renderTable(rows) {
  const tbody = $("#tbl tbody");
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.emp_no}</td>
      <td>${escapeHtml(r.first_name)}</td>
      <td>${escapeHtml(r.last_name)}</td>
      <td>${r.gender}</td>
      <td>${r.birth_date}</td>
      <td>${escapeHtml(r.title || '')}</td>
      <td>${r.salary ? Number(r.salary).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : ''}</td>
      <td>${escapeHtml(r.dept_name || '')}</td>
      <td>${r.hire_date}</td>
      <td class="actions">
        <button class="edit" data-id="${r.emp_no}">Editar</button>
        <button class="danger delete" data-id="${r.emp_no}">Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Wire events
  $$("#tbl .edit").forEach((b) => b.addEventListener("click", onEdit));
  $$("#tbl .delete").forEach((b) => b.addEventListener("click", onDelete));
}

function renderPager(p) {
  $("#page-info").textContent = `Página ${p.page} de ${p.totalPages} · ${p.total} registros`;
  $("#prev").disabled = p.page <= 1;
  $("#next").disabled = p.page >= p.totalPages || p.totalPages === 0;
}

// ---- Crear ----
const createDlg = $("#create-dialog");

$("#btn-show-create").addEventListener("click", () => {
  // Limpiar el formulario antes de mostrarlo
  const form = $("#create-form");
  if (form) form.reset();
  createDlg.showModal();
});

$("#create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = Object.fromEntries(new FormData(form));

  // Validación mínima
  if (!payload.first_name || !payload.last_name || !payload.gender || !payload.birth_date || !payload.title || !payload.salary || !payload.dept_no) {
    alert("Completa todos los campos");
    return;
  }

  // La fecha de contratación ahora es automática
  payload.hire_date = new Date().toISOString().slice(0, 10);

  try {
    toggleForm(form, true);
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const j = await safeJson(res);
      throw new Error(j?.error || "Error creando empleado");
    }

    createDlg.close();
    form.reset();
    state.page = 1; // vuelve al inicio para ver el nuevo en la lista
    await list();
    alert("Empleado creado");
  } catch (err) {
    alert(err.message || "Error de red");
  } finally {
    toggleForm(form, false);
  }
});

createDlg.addEventListener("click", (e) => {
  const rect = createDlg.getBoundingClientRect();
  const inDialog =
    rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
    rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
  if (!inDialog) createDlg.close();
});

$("#btn-create-cancel").addEventListener("click", () => {
  createDlg.close();
});

// ---- Búsqueda ----
$("#btn-search").addEventListener("click", () => {
  state.q = $("#q").value.trim();
  state.page = 1;
  list();
});
$("#q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#btn-search").click();
  }
});

// ---- Paginación ----
$("#prev").addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  list();
});
$("#next").addEventListener("click", () => {
  state.page += 1;
  list();
});

// ---- Editar ----
const dlg = $("#edit-dialog");
$("#edit-form").addEventListener("submit", onEditSave);

$("#btn-edit-cancel").addEventListener("click", () => {
  dlg.close();
});

async function onEdit(e) {
  const id = e.currentTarget.dataset.id;
  try {
    const res = await fetch(`${apiBase}/${id}`);
    if (!res.ok) throw new Error("No se pudo obtener el empleado");
    const emp = await res.json();

    const form = $("#edit-form");
    form.emp_no.value = emp.emp_no;
    form.first_name.value = emp.first_name || "";
    form.last_name.value = emp.last_name || "";
    form.gender.value = emp.gender || "M";
    form.birth_date.value = emp.birth_date || "";
    form.hire_date.value = emp.hire_date || "";
    // Nuevos campos
    if (form.title) form.title.value = emp.title || "";
    if (form.salary) form.salary.value = emp.salary || "";
    if (form.dept_no) form.dept_no.value = emp.dept_no || ""; 

    dlg.showModal();
  } catch (err) {
    alert(err.message || "Error de red");
  }
}

async function onEditSave(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const id = form.emp_no.value;
  const payload = Object.fromEntries(new FormData(form));
  delete payload.emp_no;

  try {
    toggleForm(form, true);
    const res = await fetch(`${apiBase}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const j = await safeJson(res);
      throw new Error(j?.error || "Error actualizando empleado");
    }
    dlg.close();
    await list();
    alert("Empleado actualizado");
  } catch (err) {
    alert(err.message || "Error de red");
  } finally {
    toggleForm(form, false);
  }
}

// Cerrar con click fuera del <dialog>
dlg.addEventListener("click", (e) => {
  const rect = dlg.getBoundingClientRect();
  const inDialog =
    rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
    rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
  if (!inDialog) dlg.close();
});

// ---- Borrar ----
async function onDelete(e) {
  const id = e.currentTarget.dataset.id;
  if (!confirm(`¿Borrar empleado ${id}?`)) return;

  try {
    const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      await list();
      alert("Empleado borrado");
      return;
    }
    const j = await safeJson(res);
    throw new Error(j?.error || "Error borrando empleado");
  } catch (err) {
    alert(err.message || "Error de red");
  }
}

// ---- Utilidades ----
function toggleForm(form, disabled) {
  $$("input, select, button", form).forEach((el) => (el.disabled = disabled));
}
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

async function populateDepartments() {
  try {
    const res = await fetch('/api/departments');
    if (!res.ok) throw new Error('No se pudieron cargar los departamentos');
    const departments = await res.json();
    const createSelect = document.querySelector('#create-dialog select[name="dept_no"]');
    const editSelect = document.querySelector('#edit-dialog select[name="dept_no"]');

    const options = departments.map(dept =>
      `<option value="${escapeHtml(dept.dept_no)}">${escapeHtml(dept.dept_name)}</option>`
    ).join('');

    if (createSelect) {
      createSelect.innerHTML = '<option value="">—</option>' + options;
    }
    if (editSelect) {
      
      editSelect.innerHTML = '<option value="">—</option>' + options;
    }
  } catch (err) {
    console.error(err);
  }
}

async function populateTitles() {
  try {
    const res = await fetch('/api/titles');
    if (!res.ok) throw new Error('No se pudieron cargar los puestos');
    const titles = await res.json();
    const createSelect = document.querySelector('#create-dialog select[name="title"]');
    const editSelect = document.querySelector('#edit-dialog select[name="title"]');

    const options = titles.map(t =>
      `<option value="${escapeHtml(t.title)}">${escapeHtml(t.title)}</option>`
    ).join('');

    [createSelect, editSelect].forEach(select => {
      if (!select) return;
      select.innerHTML = '<option value="">—</option>' + options;
    });
  } catch (err) {
    console.error(err);
  }
}

// ---- Init CRUD ----
(function init() {
  populateDepartments();
  populateTitles();
  list();
})();

/* =========================
   Widget TZ + Temperatura
   ========================= */

(async function initEnvWidget() {
  const el = document.getElementById('env-widget');
  if (!el) return;

  try {
    el.textContent = 'Detectando…';

    // 1) Zona horaria del navegador
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—';

    // 2) Conseguir lat/lon: geolocalización → fallback por IP
    let coords;
    try {
      coords = await getPosition(); // puede pedir permiso
    } catch {
      coords = await getLocationByIP(); // respaldo por IP
    }

    // 3) Pedir clima al backend (usa tu OPENWEATHER_API_KEY en .env)
    const w = await getWeather(coords.lat, coords.lon);
    const temp = (w?.weather?.temp != null) ? Math.round(w.weather.temp) : '—';
    const city = w?.place?.name || '';
    const pieces = [tz, `${temp}°C` + (city ? ` (${city})` : '')];

    el.textContent = pieces.join(' · ');
  } catch (err) {
    console.error(err);
    el.textContent = 'TZ/Clima no disponible';
  }
})();

// --- helpers de ubicacion/clima (ligeros) ---
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject(new Error('Geolocalización no disponible'));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  });
}

async function getLocationByIP() {
  const r = await fetch('https://ipapi.co/json/');
  if (!r.ok) throw new Error('No se pudo geolocalizar por IP');
  const j = await r.json();
  return { lat: j.latitude, lon: j.longitude };
}

async function getWeather(lat, lon) {
  const u = new URL(`${window.location.origin}/api/weather`);
  u.searchParams.set('lat', lat);
  u.searchParams.set('lon', lon);
  const r = await fetch(u);
  if (!r.ok) throw new Error('Clima no disponible');
  return r.json();
}
