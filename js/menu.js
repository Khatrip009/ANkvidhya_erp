// public/js/menu.js

// Simple helper to show a collapsible group
function renderGroup({ id, title, icon, items = [] }) {
  const groupId = `grp-${id}`;
  const btn = `
    <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            data-bs-toggle="collapse" data-bs-target="#${groupId}" aria-expanded="false" aria-controls="${groupId}">
      <span><i class="bi ${icon || 'bi-folder2-open'} me-2"></i>${title}</span>
      <i class="bi bi-chevron-down small"></i>
    </button>`;
  const links = items.map(i => `
      <a class="list-group-item list-group-item-action ps-5"
         href="${i.href}"
         data-route
         data-bs-dismiss="offcanvas">
        <i class="bi ${i.icon || 'bi-dot'} me-2"></i>${i.title}
      </a>`).join('');
  return `${btn}<div class="collapse" id="${groupId}">${links}</div>`;
}

// Flat item
function renderItem({ title, href, icon }) {
  return `<a href="${href}"
            class="list-group-item list-group-item-action"
            data-route
            data-bs-dismiss="offcanvas">
            <i class="bi ${icon || 'bi-link-45deg'} me-2"></i>${title}
          </a>`;
}

// ===== Menu definitions by role =====
// public/js/menu.js
// ... keep the helper functions renderGroup/renderItem as-is ...

const MENUS = {
  admin: [
    { type: 'item', title: 'Dashboard', href: '#/dashboard', icon: 'bi-speedometer2' },
    { type: 'item', title: 'Reports',   href: '#/reports',   icon: 'bi-graph-up' },

    // 🔥 Master group routes into generic master page with ?table=
    { type: 'group', id: 'master', title: 'Master', icon: 'bi-collection', items: [
        { title: 'States',        href: '#/master?table=states',        icon: 'bi-globe2' },
        { title: 'Districts',     href: '#/master?table=districts',     icon: 'bi-geo' },
        { title: 'Medium',        href: '#/master?table=medium',        icon: 'bi-badge-ad' },
        { title: 'Standards',     href: '#/master?table=standards',     icon: 'bi-list-ol' },
        { title: 'Divisions',     href: '#/master?table=divisions',     icon: 'bi-diagram-3' },
        { title: 'Roles',         href: '#/master?table=roles',         icon: 'bi-person-lock' },
        { title: 'Designations',  href: '#/master?table=designations',  icon: 'bi-award' },
        { title: 'Departments',   href: '#/master?table=departments',   icon: 'bi-building-gear' },
        { title: 'Activities',    href: '#/master?table=activities',    icon: 'bi-check2-square' },
        { title: 'Topics',        href: '#/master?table=topics',        icon: 'bi-tags' },
        { title: 'Table Catalog', href: '#/master?table=table_list',    icon: 'bi-table' },

        // keep your dedicated content pages separate (non-generic)
        { title: 'Courses',       href: '#/courses',        icon: 'bi-journal' },
        { title: 'Books',         href: '#/books',          icon: 'bi-book' },
        { title: 'Chapters',      href: '#/chapters',       icon: 'bi-journal-text' },
        { title: 'Videos',        href: '#/videos',         icon: 'bi-youtube' },
        { title: 'Lesson Plans',  href: '#/lesson-plans',   icon: 'bi-easel2' },
      ]},

    { type: 'group', id: 'org', title: 'Organization', icon: 'bi-building', items: [
        { title: 'Users',      href: '#/users',     icon: 'bi-people-gear' },
        { title: 'Schools',    href: '#/schools',   icon: 'bi-bank' },
        { title: 'Employees',  href: '#/employees', icon: 'bi-person-badge' },
        {title: 'Faculty-Assign', href: '#/faculty-assign', icon: 'bi-person-workspace'},
        { title: 'Students',   href: '#/students',  icon: 'bi-people' },
        { title: 'Staff Roles', href: '#/staff-roles', icon: 'bi-person-lock' },
      ]},

    { type: 'group', id: 'delivery', title: 'Delivery', icon: 'bi-mortarboard', items: [
        { title: 'Timetables',          href: '#/timetables',        icon: 'bi-calendar3' },
        { title: 'Class Sessions',      href: '#/class-sessions',    icon: 'bi-easel3' },
        { title: 'Faculty Assignments', href: '#/faculty-assign',    icon: 'bi-person-workspace' },
        { title: 'Daily Progress',      href: '#/faculty-dp',        icon: 'bi-clipboard2-check' },
        { title: 'Notebook Checks',     href: '#/notebook-checks',   icon: 'bi-journal-check' },
      ]},

    { type: 'group', id: 'attendance', title: 'Attendance', icon: 'bi-people', items: [
        { title: 'Employee Attendance', href: '#/emp-attendance',     icon: 'bi-person-check' },
        { title: 'Student Attendance',  href: '#/student-attendance', icon: 'bi-people-fill' },
        { title: 'Faculty Punches',     href: '#/faculty-attendance', icon: 'bi-watch' },
      ]},

    { type: 'group', id: 'finance', title: 'Finance', icon: 'bi-cash-coin', items: [
        { title: 'Payments', href: '#/payments', icon: 'bi-cash' },
        { title: 'Payrolls', href: '#/payrolls', icon: 'bi-receipt' },
        { title: 'Expenses', href: '#/expenses', icon: 'bi-wallet2' },
      ]},

    { type: 'item', title: 'Settings', href: '#/settings', icon: 'bi-gear' },
  ],



  faculty: [
    { type: 'item', title: 'My Dashboard', href: '#/dashboard', icon: 'bi-speedometer2' },
    { type: 'group', id: 'teach', title: 'Teaching', icon: 'bi-easel2', items: [
        { title: 'My Sessions',      href: '#/class-sessions',    icon: 'bi-easel3' },
        { title: 'My Lesson Plans',  href: '#/lesson-plans',      icon: 'bi-easel' },
        { title: 'Daily Progress',   href: '#/faculty-dp',        icon: 'bi-clipboard2-check' },
        { title: 'Notebook Checks',  href: '#/notebook-checks',   icon: 'bi-journal-check' },
      ]},
    { type: 'group', id: 'att', title: 'Attendance', icon: 'bi-people', items: [
        { title: 'My Attendance',      href: '#/emp-attendance',     icon: 'bi-person-check' },
        { title: 'Student Attendance', href: '#/student-attendance', icon: 'bi-people-fill' },
      ]},
    { type: 'item', title: 'Videos Progress', href: '#/emp-video-progress', icon: 'bi-play-circle' },
    { type: 'item', title: 'Reports', href: '#/reports', icon: 'bi-graph-up' },
  ],

  school_admin: [
    { type: 'item', title: 'School Dashboard', href: '#/dashboard', icon: 'bi-speedometer2' },
    { type: 'group', id: 'school', title: 'School', icon: 'bi-bank', items: [
        { title: 'Students',           href: '#/students',            icon: 'bi-people' },
        { title: 'Student Attendance', href: '#/student-attendance',  icon: 'bi-people-fill' },
        { title: 'Timetables',         href: '#/timetables',          icon: 'bi-calendar3' },
        { title: 'Class Sessions',     href: '#/class-sessions',      icon: 'bi-easel3' },
        { title: 'Notebook Checks',    href: '#/notebook-checks',     icon: 'bi-journal-check' },
      ]},
    { type: 'item', title: 'Reports', href: '#/reports', icon: 'bi-graph-up' },
  ],

  team_leader: [
    { type: 'item', title: 'Team Dashboard', href: '#/dashboard', icon: 'bi-speedometer2' },
    { type: 'group', id: 'team', title: 'Team', icon: 'bi-people', items: [
        { title: 'Faculty',             href: '#/employees',           icon: 'bi-person-badge' },
        { title: 'Faculty Assignments', href: '#/faculty-assign',      icon: 'bi-person-workspace' },
        { title: 'Attendance',          href: '#/emp-attendance',      icon: 'bi-person-check' },
        { title: 'Daily Progress',      href: '#/faculty-dp',          icon: 'bi-clipboard2-check' },
        { title: 'Video Progress',      href: '#/emp-video-progress',  icon: 'bi-play-circle' },
      ]},
    { type: 'item', title: 'Reports', href: '#/reports', icon: 'bi-graph-up' },
  ],
};

// Optional permissions-based pruning
function filterByPermissions(menu, _permissions = []) { return menu; }

// Render into #sidebarMenu
window.renderSidebar = function renderSidebar({ role = 'faculty', permissions = [] } = {}) {
  const root = document.getElementById('sidebarMenu');
  if (!root) return;
  const r = (role || '').toLowerCase();
  const items = filterByPermissions(MENUS[r] || MENUS['faculty'], permissions);
  root.innerHTML = items.map(m => (m.type === 'group' ? renderGroup(m) : renderItem(m))).join('');
};
