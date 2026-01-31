/**
 * renderer.ts
 * Handles UI state transitions for the VisionFlow app.
 * No actual recording logic - just UI state changes.
 */

type AppState = 'ready' | 'recording' | 'processing' | 'done';

class VisionFlowUI {
  private recordBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private statusText: HTMLSpanElement;
  private sourceSelect: HTMLSelectElement;
  private processCheckbox: HTMLInputElement;
  private currentState: AppState = 'ready';

  constructor() {
    this.recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
    this.stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    this.statusText = document.getElementById('statusText') as HTMLSpanElement;
    this.sourceSelect = document.getElementById('sourceSelect') as HTMLSelectElement;
    this.processCheckbox = document.getElementById('processCheckbox') as HTMLInputElement;

    this.init();
  }

  private init(): void {
    this.recordBtn.addEventListener('click', () => this.handleRecord());
    this.stopBtn.addEventListener('click', () => this.handleStop());
    this.sourceSelect.addEventListener('change', () => this.handleSourceChange());
  }

  private setState(state: AppState): void {
    this.currentState = state;
    this.updateUI();
  }

  private updateUI(): void {
    // Reset classes
    this.recordBtn.classList.remove('recording');
    this.statusText.classList.remove('recording', 'processing', 'done');

    switch (this.currentState) {
      case 'ready':
        this.recordBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusText.textContent = 'Ready';
        break;

      case 'recording':
        this.recordBtn.disabled = true;
        this.recordBtn.classList.add('recording');
        this.stopBtn.disabled = false;
        this.statusText.textContent = 'Recording...';
        this.statusText.classList.add('recording');
        break;

      case 'processing':
        this.recordBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.statusText.textContent = 'Processing...';
        this.statusText.classList.add('processing');
        break;

      case 'done':
        this.recordBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusText.textContent = 'Done!';
        this.statusText.classList.add('done');
        break;
    }
  }

  private handleRecord(): void {
    console.log('Record clicked');
    console.log('Selected source:', this.sourceSelect.value);
    console.log('Process before copy:', this.processCheckbox.checked);

    this.setState('recording');
  }

  private handleStop(): void {
    console.log('Stop clicked');

    this.setState('processing');

    // Simulate processing time, then show done
    setTimeout(() => {
      this.setState('done');

      // Reset to ready after showing done briefly
      setTimeout(() => {
        this.setState('ready');
      }, 2000);
    }, 1500);
  }

  private handleSourceChange(): void {
    console.log('Source changed to:', this.sourceSelect.value);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new VisionFlowUI();
});
