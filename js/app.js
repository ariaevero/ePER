const ChartGlobal = typeof window !== 'undefined' ? window.Chart : null;

class FormState {
  constructor(inputs) {
    this.data = {};
    this.inputs = inputs;
    this.names = Array.from(
      new Set(inputs.map((input) => input.name).filter(Boolean))
    );
  }

  setValue(name, value) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete this.data[name];
    } else {
      this.data[name] = value;
    }
  }

  getValue(name) {
    return this.data[name];
  }

  getCompletion() {
    if (!this.names.length) {
      return 0;
    }
    let complete = 0;
    for (const name of this.names) {
      if (this.isFilled(name)) {
        complete += 1;
      }
    }
    return Math.round((complete / this.names.length) * 100);
  }

  isFilled(name) {
    const value = this.data[name];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return !Number.isNaN(value);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value;
    return false;
  }

  toJSON() {
    return JSON.stringify(this.data, null, 2);
  }
}

class SignaturePad {
  constructor(container, state, onChange) {
    this.container = container;
    this.canvas = container.querySelector('canvas');
    this.status = container.querySelector('[data-signature-status]');
    this.clearButton = container.querySelector('[data-action="clear-signature"]');
    this.field = container.dataset.field || `signature${Math.random().toString(16).slice(2)}`;
    this.state = state;
    this.onChange = onChange;
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.isDirty = false;
    this.hasStroke = false;
    this.lastPoint = null;
    this.configureContext();
    this.bind();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.updateStatus('Awaiting signature');
  }

  configureContext() {
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 2.4;
    this.ctx.strokeStyle = '#111';
    this.ctx.fillStyle = '#111';
  }

  bind() {
    this.canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.isDrawing = true;
      this.hasStroke = false;
      this.lastPoint = this.getPoint(event);
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.isDrawing) return;
      event.preventDefault();
      const point = this.getPoint(event);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
      this.lastPoint = point;
      this.hasStroke = true;
      this.isDirty = true;
      this.updateState();
    });

    const finish = (event, skipDot = false) => {
      if (!this.isDrawing) return;
      event.preventDefault();
      this.isDrawing = false;
      if (!this.hasStroke && !skipDot && this.lastPoint) {
        this.ctx.beginPath();
        this.ctx.arc(this.lastPoint.x, this.lastPoint.y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.closePath();
        this.isDirty = true;
      } else {
        this.ctx.closePath();
      }
      if (typeof event.pointerId === 'number' && this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      this.hasStroke = false;
      this.updateState();
    };

    this.canvas.addEventListener('pointerup', (event) => finish(event));
    this.canvas.addEventListener('pointercancel', (event) => finish(event, true));
    this.canvas.addEventListener('pointerleave', (event) => finish(event, true));

    if (this.clearButton) {
      this.clearButton.addEventListener('click', () => this.clear());
    }
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const targetWidth = Math.max(rect.width, 320);
    const targetHeight = Math.max(rect.height, 120);
    const image = this.isDirty ? this.canvas.toDataURL('image/png') : null;
    this.canvas.width = targetWidth * ratio;
    this.canvas.height = targetHeight * ratio;
    this.canvas.style.width = `${targetWidth}px`;
    this.canvas.style.height = `${targetHeight}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);
    this.configureContext();
    if (image) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      img.src = image;
    }
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.configureContext();
    this.isDirty = false;
    this.isDrawing = false;
    this.hasStroke = false;
    this.state.setValue(this.field, null);
    this.updateState();
    this.updateStatus('Signature cleared');
  }

  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  updateState() {
    if (!this.state) return;
    if (this.isDirty) {
      const imageData = this.canvas.toDataURL('image/png');
      this.state.setValue(this.field, imageData);
      this.updateStatus('Signature captured');
    } else {
      this.state.setValue(this.field, null);
      this.updateStatus('Awaiting signature');
    }
    if (typeof this.onChange === 'function') {
      this.onChange();
    }
  }

  updateStatus(message) {
    if (this.status) {
      this.status.textContent = message;
    }
  }
}


function initForm() {
  const forms = Array.from(document.querySelectorAll('.form-page'));
  const inputs = Array.from(document.querySelectorAll('input[name], select[name], textarea[name]'));
  const state = new FormState(inputs);
  state.names = Array.from(
    new Set([...state.names, 'reportingSignature', 'officerSignature', 'nhqSignature'])
  );
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const nextButton = document.querySelector('[data-action="next"]');
  const prevButton = document.querySelector('[data-action="prev"]');
  const downloadButton = document.querySelector('[data-action="download"]');
  const statusLabel = document.querySelector('[data-progress="status"]');
  const percentLabel = document.querySelector('[data-progress="percent"]');
  const pageLabel = document.querySelector('[data-progress="page"]');
  const summaryContainer = document.querySelector('[data-summary]');
  const chartCanvas = document.getElementById('ratingsChart');
  const chartEmptyMessage = document.querySelector('[data-chart-empty]');

  let currentPage = 0;
  const signaturePads = [];
  let ratingChart = null;

  const ratingFields = [
    'ratingLoyalty',
    'ratingIntegrity',
    'ratingDiscipline',
    'ratingInitiative',
    'ratingLeadership',
    'ratingResponsibility',
    'ratingJudgement',
    'ratingAbility',
    'ratingZeal',
    'ratingConduct',
  ];

  function showPage(index) {
    currentPage = Math.max(0, Math.min(forms.length - 1, index));
    forms.forEach((form, idx) => {
      form.classList.toggle('active', idx === currentPage);
    });
    navLinks.forEach((button, idx) => {
      button.classList.toggle('active', idx === currentPage);
    });
    prevButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === forms.length - 1;
    pageLabel.textContent = `Page ${currentPage + 1} of ${forms.length}`;
    updateProgress();
    signaturePads.forEach((pad) => pad.resize());
    if (currentPage === forms.length - 1) {
      renderSummary();
      renderRatingChart();
    }
  }

  function updateProgress() {
    const percent = state.getCompletion();
    percentLabel.textContent = `${percent}%`;
    if (percent === 0) {
      statusLabel.textContent = 'Draft';
    } else if (percent < 100) {
      statusLabel.textContent = 'In progress';
    } else {
      statusLabel.textContent = 'Ready for submission';
    }
  }

  function handleInput(element) {
    const { name, type } = element;
    if (!name) return;
    if (type === 'checkbox') {
      state.setValue(name, element.checked);
    } else if (type === 'radio') {
      if (element.checked) {
        state.setValue(name, element.value);
      }
    } else if (type === 'number') {
      const parsed = element.value === '' ? '' : Number(element.value);
      if (element.value === '') {
        state.setValue(name, '');
      } else if (!Number.isNaN(parsed)) {
        state.setValue(name, parsed);
      }
    } else if (type === 'range') {
      state.setValue(name, Number(element.value));
      element.setAttribute('data-value', element.value);
    } else {
      state.setValue(name, element.value.trim());
    }
    updateProgress();
    if (currentPage === forms.length - 1) {
      renderSummary();
      renderRatingChart();
    }
  }

  function renderSummary() {
    if (!summaryContainer) return;
    const parts = [];
    const officerName = [state.getValue('rank'), state.getValue('surname'), state.getValue('otherNames')]
      .filter(Boolean)
      .join(' ');
    if (officerName) {
      parts.push({
        title: 'Officer',
        body: officerName,
      });
    }

    const serviceNumber = state.getValue('serviceNumber');
    const command = state.getValue('command');
    const unit = state.getValue('unit');
    const appointment = state.getValue('appointment');
    const periodFrom = state.getValue('reportingPeriodFrom');
    const periodTo = state.getValue('reportingPeriodTo');
    const contactLines = [];
    if (serviceNumber) contactLines.push(`Service No: ${serviceNumber}`);
    if (command) contactLines.push(`Command: ${command}`);
    if (unit) contactLines.push(`Unit: ${unit}`);
    if (appointment) contactLines.push(`Appointment: ${appointment}`);
    if (periodFrom || periodTo) {
      contactLines.push(`Report Period: ${formatDate(periodFrom)} – ${formatDate(periodTo)}`);
    }
    if (contactLines.length) {
      parts.push({
        title: 'Posting Overview',
        body: contactLines.join('\n'),
      });
    }

    const recommendation = state.getValue('promotionRecommendation');
    const promotionRemarks = state.getValue('promotionRemarks');
    const reportingOfficer = state.getValue('reportingOfficerName');
    const reportingRank = state.getValue('reportingOfficerRank');
    if (recommendation || promotionRemarks || reportingOfficer) {
      const lines = [];
      if (recommendation) lines.push(`Recommendation: ${recommendation}`);
      if (promotionRemarks) lines.push(promotionRemarks);
      if (reportingOfficer || reportingRank) {
        lines.push(`By: ${[reportingOfficer, reportingRank].filter(Boolean).join(', ')}`);
      }
      parts.push({
        title: 'Promotion Assessment',
        body: lines.join('\n'),
      });
    }

    const avgRating = average(ratingFields.map((field) => state.getValue(field)));
    if (!Number.isNaN(avgRating)) {
      parts.push({
        title: 'Average Rating',
        body: `Overall score: ${avgRating.toFixed(1)} / 9`,
      });
    }

    const acknowledgement = state.getValue('officerAcknowledged');
    if (acknowledgement) {
      parts.push({
        title: 'Officer Acknowledgement',
        body: 'Officer has acknowledged discussion of the report.',
      });
    }

    const nhqOutcome = state.getValue('nhqOutcome');
    const nhqRemarks = state.getValue('nhqRemarks');
    const nhqApprover = state.getValue('nhqApproverName');
    if (nhqOutcome || nhqRemarks || nhqApprover) {
      const lines = [];
      if (nhqOutcome) lines.push(`NHQ Outcome: ${nhqOutcome}`);
      if (nhqRemarks) lines.push(nhqRemarks);
      if (nhqApprover) {
        const approverRank = state.getValue('nhqApproverRank');
        lines.push(`Signed: ${[nhqApprover, approverRank].filter(Boolean).join(', ')}`);
      }
      parts.push({
        title: 'Naval Headquarters Review',
        body: lines.join('\n'),
      });
    }

    summaryContainer.innerHTML = parts
      .map(
        (section) => `
        <div class="summary-card">
          <h4>${section.title}</h4>
          <p>${section.body.replace(/\n/g, '<br>')}</p>
        </div>
      `
      )
      .join('');
    renderRatingChart();
  }

  function average(values) {
    const valid = values.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
    if (!valid.length) {
      return NaN;
    }
    const total = valid.reduce((acc, value) => acc + value, 0);
    return total / valid.length;
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return value;
    }
  }

  inputs.forEach((input) => {
    const handler = () => handleInput(input);
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.addEventListener('change', handler);
    } else if (input.type === 'range') {
      input.addEventListener('input', handler);
      handler();
    } else {
      input.addEventListener('input', handler);
    }
  });

  navLinks.forEach((button, index) => {
    button.addEventListener('click', () => showPage(index));
  });

  nextButton.addEventListener('click', () => showPage(currentPage + 1));
  prevButton.addEventListener('click', () => showPage(currentPage - 1));

  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      const blob = new Blob([state.toJSON()], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'nn-form-206.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
  }

  const signatureChange = () => {
    updateProgress();
    if (currentPage === forms.length - 1) {
      renderSummary();
      renderRatingChart();
    }
  };

  document.querySelectorAll('[data-signature]').forEach((element) => {
    const pad = new SignaturePad(element, state, signatureChange);
    signaturePads.push(pad);
  });

  updateProgress();
  renderSummary();
  renderRatingChart();

  function renderRatingChart() {
    if (!chartCanvas) return;
    if (!ChartGlobal) {
      if (chartEmptyMessage) {
        chartEmptyMessage.hidden = false;
        chartEmptyMessage.textContent = 'Chart preview unavailable. Ensure Chart.js is loaded to view analytics.';
      }
      return;
    }
    const values = ratingFields.map((field) => {
      const value = Number(state.getValue(field));
      return Number.isFinite(value) ? value : null;
    });
    const hasData = values.some((value) => value !== null);

    if (!hasData) {
      if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
      }
      chartCanvas.classList.add('is-empty');
      if (chartEmptyMessage) {
        chartEmptyMessage.hidden = false;
      }
      return;
    }

    const resolvedValues = values.map((value) => (value === null ? 0 : value));
    chartCanvas.classList.remove('is-empty');
    if (chartEmptyMessage) {
      chartEmptyMessage.hidden = true;
    }

    if (!ratingChart) {
      ratingChart = new ChartGlobal(chartCanvas, {
        type: 'radar',
        data: {
          labels: [
            'Loyalty',
            'Integrity',
            'Discipline',
            'Initiative',
            'Leadership',
            'Responsibility',
            'Judgement',
            'Professional Ability',
            'Zeal',
            'Conduct',
          ],
          datasets: [
            {
              label: 'Core Values',
              data: resolvedValues,
              borderColor: '#0b3d91',
              backgroundColor: 'rgba(11, 61, 145, 0.16)',
              pointBackgroundColor: '#0b3d91',
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          scales: {
            r: {
              beginAtZero: true,
              min: 0,
              max: 9,
              ticks: {
                stepSize: 1,
                showLabelBackdrop: false,
                color: '#333',
                font: {
                  size: 11,
                  family: '"Libre Franklin", "Helvetica Neue", Arial, sans-serif',
                },
              },
              grid: {
                color: '#c8d3e1',
              },
              angleLines: {
                color: '#c8d3e1',
              },
              pointLabels: {
                font: {
                  size: 12,
                  family: '"Libre Franklin", "Helvetica Neue", Arial, sans-serif',
                  weight: '600',
                },
                color: '#0b3d91',
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.parsed.r} / 9`;
                },
              },
            },
          },
        },
      });
      return;
    }

    ratingChart.data.datasets[0].data = resolvedValues;
    ratingChart.update();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initForm);
} else {
  initForm();
}
