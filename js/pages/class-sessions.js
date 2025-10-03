// public/js/pages/class-sessions.js
(() => {
  async function fetchSessions(q = {}) {
    try {
      const { data } = await api.get('/api/class-sessions', { query: q });
      return data || [];
    } catch (err) {
      console.error('fetchSessions err', err);
      window.ui.toast('Failed to fetch sessions', 'warning');
      return [];
    }
  }

  async function createFromTimetable(payload) {
    return api.post('/api/class-sessions/from-timetable', payload);
  }

  function sessionToEvent(s) {
    const defaultPeriodTimes = {
      1: ['08:00:00','08:45:00'],
      2: ['09:00:00','09:45:00'],
      3: ['10:00:00','10:45:00'],
      4: ['11:00:00','11:45:00'],
      5: ['12:00:00','12:45:00'],
      6: ['13:30:00','14:15:00'],
      7: ['14:30:00','15:15:00'],
      8: ['15:30:00','16:15:00']
    };

    let startTime = s.start_time || (s.period_no ? (defaultPeriodTimes[s.period_no] ? defaultPeriodTimes[s.period_no][0] : '09:00:00') : '09:00:00');
    let endTime   = s.end_time   || (s.period_no ? (defaultPeriodTimes[s.period_no] ? defaultPeriodTimes[s.period_no][1] : '10:00:00') : '10:00:00');

    const date = (s.session_date && s.session_date.slice ? s.session_date.slice(0,10) : String(s.session_date || '').slice(0,10));
    const start = `${date}T${startTime}`;
    const end   = `${date}T${endTime}`;

    const titleParts = [];
    if (s.std_name) titleParts.push(`Std ${s.std_name}`);
    else if (s.std_id) titleParts.push(`Std ${s.std_id}`);
    if (s.division_name) titleParts.push(`Div ${s.division_name}`);
    if (s.employee_name) titleParts.push(`- ${s.employee_name}`);
    if (!titleParts.length && s.school_name) titleParts.push(s.school_name);

    return { id: s.cs_id, title: titleParts.join(' '), start, end, extendedProps: s };
  }

  function buildCalendar(el, sessions) {
    if (el._fc) { try { el._fc.destroy(); } catch(e){} }
    const events = sessions.map(sessionToEvent);

    const calendar = new FullCalendar.Calendar(el, {
      initialView: 'timeGridWeek',
      nowIndicator: true,
      firstDay: 1,
      slotMinTime: '07:30:00',
      slotMaxTime: '18:30:00',
      allDaySlot: false,
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,listWeek' },
      navLinks: true,
      businessHours: [{ daysOfWeek: [1,2,3,4,5,6], startTime: '08:00', endTime: '16:30' }],
      events,
      eventClick(info) {
        const s = info.event.extendedProps;
        const label = `${info.event.title}\nDate: ${s.session_date}\nPeriod: ${s.period_no || 'N/A'}\nSchool: ${s.school_name || s.school_id || ''}\nFaculty: ${s.employee_name || ''}`;
        if (confirm(`${label}\n\nOpen Student Attendance for this session?`)) {
          const pref = {
            school_class_id: `${s.school_id || ''}:${s.medium_id || ''}:${s.std_id || ''}:${s.div_id || ''}`,
            date: s.session_date ? String(s.session_date).slice(0,10) : ''
          };
          sessionStorage.setItem('sa_prefill', JSON.stringify(pref));
          location.hash = '#/student-attendance';
        }
      },
      eventDidMount(info) {
        const s = info.event.extendedProps;
        if (s && s.school_name) {
          const el = info.el.querySelector('.fc-event-title');
          if (el) {
            const small = document.createElement('div');
            small.className = 'small text-muted';
            small.style.fontSize = '0.75em';
            small.innerText = s.school_name;
            el.appendChild(small);
          }
        }
      }
    });

    calendar.render();
    el._fc = calendar;
    return calendar;
  }

  window.pageClassSessions = {
    render() { return `<div id="csWrap">${window.ui.spinner()}</div>`; },
    async mount() {
      const root = document.getElementById('csWrap');
      const today = new Date().toISOString().slice(0,10);

      root.innerHTML = `
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="mb-3"><i class="bi bi-easel3 me-2"></i>Class Sessions (Calendar)</h5>

            <div class="row g-2 align-items-end mb-3">
              <div class="col-md-3">
                <label class="form-label">Date (load sessions)</label>
                <input id="csDate" type="date" class="form-control" value="${today}">
              </div>

              <div class="col-md-3">
                <label class="form-label">Timetable ID (optional)</label>
                <input id="csTimetableId" class="form-control" placeholder="timetable_id">
              </div>

              <div class="col-md-2">
                <label class="form-label">Period No (optional)</label>
                <input id="csPeriodNo" type="number" min="1" max="20" class="form-control" placeholder="period_no">
              </div>

              <div class="col-md-2">
                <label class="form-label">School</label>
                <select id="csSchoolId" class="form-select"><option value="">— any —</option></select>
              </div>

              <div class="col-md-2">
                <label class="form-label">&nbsp;</label>
                <div class="d-grid gap-2">
                  <button id="csLoad" class="btn btn-primary">Load</button>
                </div>
              </div>
            </div>

            <div class="row g-2 mb-3">
              <div class="col-md-3">
                <label class="form-label">Std</label>
                <select id="csStdId" class="form-select"><option value="">— any —</option></select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Division</label>
                <select id="csDivId" class="form-select"><option value="">— any —</option></select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Employee</label>
                <select id="csEmployeeId" class="form-select"><option value="">— any —</option></select>
              </div>
              <div class="col-md-3">
                <label class="form-label">&nbsp;</label>
                <div class="d-grid gap-2">
                  <button id="csCreate" class="btn btn-success">Create sessions from timetable</button>
                </div>
              </div>
            </div>

            <div id="calendar" style="min-height:540px"></div>
            <hr />
            <div class="small text-muted">Click an event to open Student Attendance (prefills class/date).</div>
          </div>
        </div>
      `;

      const populateSelect = (sel, rows, idKey, labelKey) => {
        const el = root.querySelector(sel);
        if (!el) return;
        el.innerHTML = ['<option value="">— any —</option>']
          .concat((rows || []).map(r => `<option value="${r[idKey]}">${r[labelKey]}</option>`)).join('');
      };

      // load lookups: standards/divisions from generic master, schools/employees from endpoints
      const [schools, standards, divisions, employees] = await Promise.all([
        (async() => { try { const r = await api.get('/api/schools', { query: { pageSize: 500 } }); return r.data || []; } catch(e){ return []; } })(),
        (async() => { try { const r = await api.get('/api/master', { query: { table: 'standards', pageSize: 500 } }); return r.data || []; } catch(e){ return []; } })(),
        (async() => { try { const r = await api.get('/api/master', { query: { table: 'divisions', pageSize: 500 } }); return r.data || []; } catch(e){ return []; } })(),
        (async() => { try { const r = await api.get('/api/employees', { query: { pageSize: 500 } }); return r.data || []; } catch(e){ return []; } })()
      ]);

      populateSelect('#csSchoolId', schools, 'school_id', 'school_name');
      populateSelect('#csStdId', standards, 'std_id', 'std_name');
      populateSelect('#csDivId', divisions, 'div_id', 'division_name');
      populateSelect('#csEmployeeId', employees, 'employee_id', 'full_name');

      const elDate = root.querySelector('#csDate');
      const btnLoad = root.querySelector('#csLoad');
      const btnCreate = root.querySelector('#csCreate');

      async function loadAndRender() {
        const date = elDate.value;
        root.querySelector('#calendar').innerHTML = window.ui.spinner();

        const q = { session_date: date, pageSize: 1000 };
        const schoolVal = root.querySelector('#csSchoolId').value;
        const stdVal = root.querySelector('#csStdId').value;
        const divVal = root.querySelector('#csDivId').value;
        const empVal = root.querySelector('#csEmployeeId').value;
        if (schoolVal) q.school_id = Number(schoolVal);
        if (stdVal) q.std_id = Number(stdVal);
        if (divVal) q.div_id = Number(divVal);
        if (empVal) q.employee_id = Number(empVal);

        const sessions = await fetchSessions(q);
        const normalized = (sessions || []).map(s => {
          if (s.session_date && s.session_date.toISOString) s.session_date = s.session_date.toISOString().slice(0,10);
          return s;
        });

        root.querySelector('#calendar').innerHTML = '<div id="fcHost"></div>';
        const host = root.querySelector('#fcHost');
        buildCalendar(host, normalized);
      }

      btnLoad.addEventListener('click', loadAndRender);

      btnCreate.addEventListener('click', async () => {
        const payload = {
          timetable_id: root.querySelector('#csTimetableId').value || null,
          school_id:    root.querySelector('#csSchoolId').value ? Number(root.querySelector('#csSchoolId').value) : null,
          std_id:       root.querySelector('#csStdId').value ? Number(root.querySelector('#csStdId').value) : null,
          div_id:       root.querySelector('#csDivId').value ? Number(root.querySelector('#csDivId').value) : null,
          employee_id:  root.querySelector('#csEmployeeId').value ? Number(root.querySelector('#csEmployeeId').value) : null,
          session_date: elDate.value,
          period_no:    root.querySelector('#csPeriodNo').value ? Number(root.querySelector('#csPeriodNo').value) : null
        };

        if (!payload.session_date) { window.ui.toast('Pick a date', 'warning'); return; }

        if (!payload.timetable_id && !payload.school_id && !payload.std_id && !payload.employee_id) {
          if (!confirm('No timetable_id, school, std or employee selected — this will attempt to create sessions for all accessible timetables. Continue?')) return;
        }

        try {
          const r = await createFromTimetable(payload);
          const created = r?.data?.created_count ?? r?.created_count ?? 0;
          window.ui.toast(`${created} sessions created`, 'success');
          loadAndRender();
        } catch (err) {
          console.error('createFromTimetable err', err);
          window.ui.toast(err?.data?.message || err?.message || 'Create failed', 'danger');
        }
      });

      await loadAndRender();
    }
  };
})();
