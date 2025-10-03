// Build compact forms from a JSON schema; emits submit(data)
window.FormKit = class {
  constructor({ schema, title='Edit', onSubmit }) {
    this.schema=schema; this.onSubmit=onSubmit;
    this.id = 'fk-'+Math.random().toString(36).slice(2);
    this.el = document.createElement('div');
    this.el.innerHTML = `
      <div class="offcanvas offcanvas-end" tabindex="-1" id="${this.id}">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">${title}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body">
          <form id="${this.id}-form" class="vstack gap-3"></form>
          <div class="d-grid mt-3">
            <button class="btn btn-primary" id="${this.id}-save"><i class="bi bi-check2"></i> Save</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(this.el);
    this.canvas = new bootstrap.Offcanvas('#'+this.id);
    this.form = this.el.querySelector('form');
    this.render();
    this.el.querySelector('#'+this.id+'-save').addEventListener('click', (e)=>{ e.preventDefault(); this.submit(); });
  }

  render(values={}) {
    this.form.innerHTML = this.schema.map(f=>{
      const v = values[f.name] ?? '';
      const req = f.required ? 'required' : '';
      if (f.type==='select') {
        const opts = (f.options||[]).map(o=>`<option value="${o.value}">${o.label}</option>`).join('');
        return `<div><label class="form-label">${f.label}</label><select class="form-select" name="${f.name}" ${req}>${opts}</select></div>`;
      } else if (f.type==='textarea') {
        return `<div><label class="form-label">${f.label}</label><textarea class="form-control" rows="${f.rows||3}" name="${f.name}" ${req}>${v}</textarea></div>`;
      } else {
        return `<div><label class="form-label">${f.label}</label><input class="form-control" name="${f.name}" type="${f.type||'text'}" value="${v}" placeholder="${f.placeholder||''}" ${req}/></div>`;
      }
    }).join('');
  }

  open(values={}) { this.render(values); this.canvas.show(); }
  close() { this.canvas.hide(); }

  submit() {
    const data = Object.fromEntries(new FormData(this.form).entries());
    if (this.onSubmit) this.onSubmit(data, this);
  }
};
