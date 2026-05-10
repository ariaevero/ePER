export class SignatureCanvas {
  constructor(container, state, onChange) {
    this.container = container;
    this.canvas = container.querySelector('canvas');
    this.status = container.querySelector('[data-signature-status]');
    this.clearButton = container.querySelector('[data-action="clear-signature"]');
    this.resetButton = container.querySelector('[data-action="reset-signature"]');
    this.exportButton = container.querySelector('[data-action="export-signature"]');
    this.output = container.querySelector('[data-signature-output]');
    this.colorButtons = Array.from(container.querySelectorAll('[data-signature-color]'));
    this.field = container.dataset.field || `signature${Math.random().toString(16).slice(2)}`;
    this.state = state;
    this.onChange = onChange;
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.isDirty = false;
    this.hasStroke = false;
    this.lastPoint = null;
    this.strokeColor = '#111';
    this.configureContext();
    this.bind();
    const activeButton = this.colorButtons.find((button) => button.classList.contains('is-active'))
      || this.colorButtons[0];
    if (activeButton && activeButton.dataset.signatureColor) {
      this.setStrokeColor(activeButton.dataset.signatureColor, activeButton);
    }
    this.resize();
    this.restoreFromValue();
    window.addEventListener('resize', () => this.resize());
    this.updateStatus('Awaiting signature');
  }

  configureContext() {
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 2.4;
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
  }

  bind() {
    const start = (event) => {
      event.preventDefault();
      if (typeof event.pointerId === 'number' && this.canvas.setPointerCapture) {
        this.canvas.setPointerCapture(event.pointerId);
      }
      this.isDrawing = true;
      this.hasStroke = false;
      this.lastPoint = this.getPoint(event);
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    };

    const move = (event) => {
      if (!this.isDrawing) return;
      event.preventDefault();
      const point = this.getPoint(event);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
      this.lastPoint = point;
      this.hasStroke = true;
      this.isDirty = true;
      this.updateState();
    };

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

    if ('PointerEvent' in window) {
      this.canvas.addEventListener('pointerdown', (event) => start(event));
      this.canvas.addEventListener('pointermove', (event) => move(event));
      this.canvas.addEventListener('pointerup', (event) => finish(event));
      this.canvas.addEventListener('pointercancel', (event) => finish(event, true));
      this.canvas.addEventListener('pointerleave', (event) => finish(event, true));
    } else {
      this.canvas.addEventListener('mousedown', (event) => start(event));
      this.canvas.addEventListener('mousemove', (event) => move(event));
      this.canvas.addEventListener('mouseup', (event) => finish(event));
      this.canvas.addEventListener('mouseleave', (event) => finish(event, true));

      this.canvas.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        start(touch);
      }, { passive: false });
      this.canvas.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        move(touch);
      }, { passive: false });
      this.canvas.addEventListener('touchend', (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        finish(touch);
      }, { passive: false });
      this.canvas.addEventListener('touchcancel', (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        finish(touch, true);
      }, { passive: false });
    }

    if (this.clearButton) {
      this.clearButton.addEventListener('click', () => this.clear());
    }

    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => this.reset());
    }

    if (this.exportButton) {
      this.exportButton.addEventListener('click', () => this.exportDataUrl());
    }

    this.colorButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const color = button.dataset.signatureColor;
        if (color) {
          this.setStrokeColor(color, button);
        }
      });
    });
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
    if (this.state) {
      this.state.setValue(this.field, null);
    }
    this.updateOutput('');
    this.updateState();
    this.updateStatus('Signature cleared');
  }

  reset() {
    this.clear();
    const defaultButton = this.colorButtons.find((button) => button.dataset.signatureColor === '#111111')
      || this.colorButtons[0]
      || null;
    this.setStrokeColor(defaultButton ? defaultButton.dataset.signatureColor : '#111', defaultButton);
    this.updateStatus('Signature reset');
  }

  setStrokeColor(color, activeButton = null) {
    this.strokeColor = color;
    this.configureContext();
    this.colorButtons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  exportDataUrl() {
    if (!this.isDirty) {
      this.updateStatus('Add a signature before exporting');
      return '';
    }
    const imageData = this.canvas.toDataURL('image/png');
    this.updateOutput(imageData);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(imageData).then(() => {
        this.updateStatus('Signature data URL copied');
      }).catch(() => {
        this.updateStatus('Signature data URL ready to copy');
      });
    } else {
      this.updateStatus('Signature data URL ready to copy');
    }
    return imageData;
  }

  restoreFromValue() {
    const initialValue = (this.state && this.state.getValue(this.field))
      || (this.output ? this.output.value.trim() : '');
    if (!initialValue) return;

    const img = new Image();
    img.onload = () => {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const height = Math.max(rect.height, 120);
      this.ctx.drawImage(img, 0, 0, width, height);
      this.isDirty = true;
      this.updateState();
    };
    img.src = initialValue;
  }

  updateOutput(value) {
    if (this.output) {
      this.output.value = value;
    }
  }

  updateState() {
    if (!this.state) return;
    if (this.isDirty) {
      const imageData = this.canvas.toDataURL('image/png');
      this.state.setValue(this.field, imageData);
      this.updateOutput(imageData);
      this.updateStatus('Signature captured');
    } else {
      this.state.setValue(this.field, null);
      this.updateOutput('');
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
