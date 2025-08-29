export interface TableDimensions {
  rows: number;
  cols: number;
}

export class TableSelector {
  private container: HTMLElement;
  private onSelect: (dimensions: TableDimensions) => void;
  private maxRows = 8;
  private maxCols = 8;

  constructor(container: HTMLElement, onSelect: (dimensions: TableDimensions) => void) {
    this.container = container;
    this.onSelect = onSelect;
    this.render();
    this.hide(); // Start hidden
  }

  private render() {
    this.container.className = 'table-selector-dropdown'; // Keep the original class

    const selectorContent = document.createElement('div');
    selectorContent.className = 'table-selector';

    const grid = document.createElement('div');
    grid.className = 'table-grid';

    for (let row = 0; row < this.maxRows; row++) {
      for (let col = 0; col < this.maxCols; col++) {
        const cell = document.createElement('div');
        cell.className = 'table-grid-cell';
        cell.dataset.row = row.toString();
        cell.dataset.col = col.toString();
        grid.appendChild(cell);
      }
    }

    const label = document.createElement('div');
    label.className = 'table-selector-label';
    label.textContent = '1 × 1';

    selectorContent.appendChild(grid);
    selectorContent.appendChild(label);
    this.container.appendChild(selectorContent);

    this.attachEvents(grid, label);
  }

  private attachEvents(grid: HTMLElement, label: HTMLElement) {
    grid.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('table-grid-cell')) return;

      const row = parseInt(target.dataset.row || '0');
      const col = parseInt(target.dataset.col || '0');

      this.highlightCells(grid, row + 1, col + 1);
      label.textContent = `${row + 1} × ${col + 1}`;
    });

    grid.addEventListener('mouseleave', () => {
      this.clearHighlight(grid);
      label.textContent = '1 × 1';
    });

    grid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('table-grid-cell')) return;

      const rows = parseInt(target.dataset.row || '0') + 1;
      const cols = parseInt(target.dataset.col || '0') + 1;

      this.onSelect({ rows, cols });
      this.hide();
    });
  }

  private highlightCells(grid: HTMLElement, rows: number, cols: number) {
    const cells = grid.querySelectorAll('.table-grid-cell');
    cells.forEach((cell: Element) => {
      const cellElement = cell as HTMLElement;
      const row = parseInt(cellElement.dataset.row || '0');
      const col = parseInt(cellElement.dataset.col || '0');

      if (row < rows && col < cols) {
        cellElement.classList.add('highlighted');
      } else {
        cellElement.classList.remove('highlighted');
      }
    });
  }

  private clearHighlight(grid: HTMLElement) {
    const cells = grid.querySelectorAll('.table-grid-cell');
    cells.forEach((cell: Element) => {
      cell.classList.remove('highlighted');
    });
  }

  show() {
    console.log('TableSelector.show() called');
    this.container.style.display = 'block';
    this.container.style.visibility = 'visible';
    console.log('Container display after show:', this.container.style.display);
  }

  hide() {
    console.log('TableSelector.hide() called');
    this.container.style.display = 'none';
    this.container.style.visibility = 'hidden';
  }

  destroy() {
    this.container.innerHTML = '';
  }
}