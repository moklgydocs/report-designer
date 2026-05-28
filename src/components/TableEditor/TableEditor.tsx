import React, { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TableElement, ReportElement, TableCell, TableRow, TableColumn } from '../../types';
import { useDesignerStore } from '../../store/designerStore';
import './TableEditor.css';

interface TableEditorProps {
  element: TableElement;
  onUpdate: (id: string, updates: Partial<ReportElement>) => void;
}

const defaultCellProps = (isHeader = false): Omit<TableCell, 'id' | 'content' | 'dataField'> => ({
  rowSpan: 1, colSpan: 1,
  font: { family: 'Microsoft YaHei', size: 12, bold: isHeader, italic: false, underline: false, color: isHeader ? '#1e293b' : '#333333' },
  backgroundColor: isHeader ? '#f0f4f8' : '#ffffff',
  borders: {
    top: { style: 'solid', width: 1, color: '#d0d5dd' },
    right: { style: 'solid', width: 1, color: '#d0d5dd' },
    bottom: { style: 'solid', width: 1, color: '#d0d5dd' },
    left: { style: 'solid', width: 1, color: '#d0d5dd' },
  },
  padding: { top: 2, right: 4, bottom: 2, left: 4 },
  horizontalAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  diagonalLine: false,
  wordWrap: false,
  autoGrow: false,
  mask: '',
  format: '',
});

/**
 * Excel-grade selection bounds expansion for merged cells.
 * Uses fixed-point iteration to perfectly grow the box until all spanned cells are covered.
 */
const expandSelectionBounds = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  cells: TableCell[][]
) => {
  let minRow = Math.min(startRow, endRow);
  let maxRow = Math.max(startRow, endRow);
  let minCol = Math.min(startCol, endCol);
  let maxCol = Math.max(startCol, endCol);

  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < cells.length; r++) {
      const row = cells[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;

        const cellRowSpan = cell.rowSpan;
        const cellColSpan = cell.colSpan;

        if (cellRowSpan > 1 || cellColSpan > 1) {
          const cellMaxRow = r + cellRowSpan - 1;
          const cellMaxCol = c + cellColSpan - 1;

          const overlapsRow = (r <= maxRow && cellMaxRow >= minRow);
          const overlapsCol = (c <= maxCol && cellMaxCol >= minCol);

          if (overlapsRow && overlapsCol) {
            if (r < minRow) { minRow = r; changed = true; }
            if (cellMaxRow > maxRow) { maxRow = cellMaxRow; changed = true; }
            if (c < minCol) { minCol = c; changed = true; }
            if (cellMaxCol > maxCol) { maxCol = cellMaxCol; changed = true; }
          }
        } else if (cellRowSpan === 0 || cellColSpan === 0) {
          // Subcell of a merge: scan upwards and leftwards to find parent merged cell
          let parentR = r;
          let parentC = c;
          let foundParent = false;

          for (let pr = r; pr >= 0; pr--) {
            const pRow = cells[pr] || [];
            for (let pc = c; pc >= 0; pc--) {
              const pCell = pRow[pc];
              if (pCell && pCell.rowSpan > 0 && pCell.colSpan > 0) {
                if (pr + pCell.rowSpan - 1 >= r && pc + pCell.colSpan - 1 >= c) {
                  parentR = pr;
                  parentC = pc;
                  foundParent = true;
                  break;
                }
              }
            }
            if (foundParent) break;
          }

          if (foundParent) {
            const pCell = cells[parentR][parentC];
            const pMaxRow = parentR + pCell.rowSpan - 1;
            const pMaxCol = parentC + pCell.colSpan - 1;

            const overlapsRow = (parentR <= maxRow && pMaxRow >= minRow) || (r <= maxRow && r >= minRow);
            const overlapsCol = (parentC <= maxCol && pMaxCol >= minCol) || (c <= maxCol && c >= minCol);

            if (overlapsRow && overlapsCol) {
              if (parentR < minRow) { minRow = parentR; changed = true; }
              if (pMaxRow > maxRow) { maxRow = pMaxRow; changed = true; }
              if (parentC < minCol) { minCol = parentC; changed = true; }
              if (pMaxCol > maxCol) { maxCol = pMaxCol; changed = true; }
            }
          }
        }
      }
    }
  }

  const selected: { row: number; col: number }[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      selected.push({ row: r, col: c });
    }
  }

  return { selected, minRow, maxRow, minCol, maxCol };
};

export const TableEditor: React.FC<TableEditorProps> = ({ element, onUpdate }) => {
  const { tableData } = element;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCells, setSelectedCells] = useState<{ row: number; col: number }[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const { selectTableCell } = useDesignerStore();

  // Drag selection state
  const isDraggingSelect = useRef(false);
  const dragStartCell = useRef<{ row: number; col: number } | null>(null);

  // Resize state
  const [localColumns, setLocalColumns] = useState<TableColumn[] | null>(null);
  const [localRows, setLocalRows] = useState<TableRow[] | null>(null);
  const resizeStartRef = useRef<{ pos: number; size: number } | null>(null);

  const activeColumns = localColumns ?? tableData.columns;
  const activeRows = localRows ?? tableData.rows;

  const handleColumnResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = tableData.columns[colIndex].width;
    resizeStartRef.current = { pos: startX, size: startWidth };

    const handleMove = (ev: MouseEvent) => {
      if (resizeStartRef.current === null) return;
      const delta = ev.clientX - resizeStartRef.current.pos;
      const newWidth = Math.max(30, resizeStartRef.current.size + delta);
      setLocalColumns(tableData.columns.map((col, i) =>
        i === colIndex ? { ...col, width: newWidth } : col
      ));
    };

    const handleUp = () => {
      setLocalColumns(prev => {
        if (prev) {
          onUpdate(element.id, { tableData: { ...tableData, columns: prev } } as any);
        }
        return null;
      });
      resizeStartRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [tableData, element.id, onUpdate]);

  const handleRowResizeStart = useCallback((rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = tableData.rows[rowIndex].height;
    resizeStartRef.current = { pos: startY, size: startHeight };

    const handleMove = (ev: MouseEvent) => {
      if (resizeStartRef.current === null) return;
      const delta = ev.clientY - resizeStartRef.current.pos;
      const newHeight = Math.max(16, resizeStartRef.current.size + delta);
      setLocalRows(tableData.rows.map((row, i) =>
        i === rowIndex ? { ...row, height: newHeight } : row
      ));
    };

    const handleUp = () => {
      setLocalRows(prev => {
        if (prev) {
          const totalHeight = prev.reduce((sum, r) => sum + r.height, 0);
          onUpdate(element.id, {
            tableData: { ...tableData, rows: prev },
            height: totalHeight,
          } as any);
        }
        return null;
      });
      resizeStartRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [tableData, element.id, onUpdate]);

  // Document level mouseup handler to terminate dragging
  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingSelect.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const addRow = () => {
    const newRow: TableRow = { id: uuidv4(), height: 28, isHeader: false };
    const newCells: TableCell[] = tableData.columns.map(() => ({
      id: uuidv4(), content: '', ...defaultCellProps(false),
    }));
    const newHeight = tableData.rows.reduce((sum, r) => sum + r.height, 0) + 28;
    onUpdate(element.id, {
      tableData: { ...tableData, rows: [...tableData.rows, newRow], cells: [...tableData.cells, newCells] },
      height: newHeight,
    } as any);
  };

  const addColumn = () => {
    const newCol: TableColumn = { id: uuidv4(), width: 120 };
    const newCells = tableData.rows.map((row) => ({
      id: uuidv4(), content: '', ...defaultCellProps(row.isHeader),
    }));
    const newWidth = tableData.columns.reduce((sum, c) => sum + c.width, 0) + 120;
    onUpdate(element.id, {
      tableData: {
        ...tableData,
        columns: [...tableData.columns, newCol],
        cells: tableData.cells.map((row, ri) => [...row, newCells[ri]]),
      },
      width: newWidth,
    } as any);
  };

  const removeRow = (rowIndex: number) => {
    if (tableData.rows.length <= 1) return;
    const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));

    for (let r = 0; r < newCells.length; r++) {
      for (let c = 0; c < newCells[r].length; c++) {
        const cell = newCells[r][c];
        if (cell.rowSpan > 1 && r + cell.rowSpan > rowIndex && r <= rowIndex) {
          cell.rowSpan -= 1;
        }
      }
    }

    const newRowsList = tableData.rows.filter((_, i) => i !== rowIndex);
    const totalHeight = newRowsList.reduce((sum, r) => sum + r.height, 0);

    onUpdate(element.id, {
      tableData: { ...tableData, rows: newRowsList, cells: newCells.filter((_, i) => i !== rowIndex) },
      height: totalHeight,
    } as any);
  };

  const removeColumn = (colIndex: number) => {
    if (tableData.columns.length <= 1) return;
    const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));

    for (let r = 0; r < newCells.length; r++) {
      for (let c = 0; c < newCells[r].length; c++) {
        const cell = newCells[r][c];
        if (cell.colSpan > 1 && c + cell.colSpan > colIndex && c <= colIndex) {
          cell.colSpan -= 1;
        }
      }
    }

    const newColsList = tableData.columns.filter((_, i) => i !== colIndex);
    const totalWidth = newColsList.reduce((sum, c) => sum + c.width, 0);

    onUpdate(element.id, {
      tableData: {
        ...tableData,
        columns: newColsList,
        cells: newCells.map(row => row.filter((_, i) => i !== colIndex)),
      },
      width: totalWidth,
    } as any);
  };

  const mergeCells = () => {
    if (selectedCells.length < 2) return;
    const minRow = Math.min(...selectedCells.map(c => c.row));
    const maxRow = Math.max(...selectedCells.map(c => c.row));
    const minCol = Math.min(...selectedCells.map(c => c.col));
    const maxCol = Math.max(...selectedCells.map(c => c.col));

    const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));

    newCells[minRow][minCol].rowSpan = maxRow - minRow + 1;
    newCells[minRow][minCol].colSpan = maxCol - minCol + 1;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r === minRow && c === minCol) continue;
        newCells[r][c].rowSpan = 0;
        newCells[r][c].colSpan = 0;
      }
    }

    onUpdate(element.id, { tableData: { ...tableData, cells: newCells } } as any);
    setSelectedCells([]);
  };

  const splitCells = () => {
    if (selectedCells.length !== 1) return;
    const { row, col } = selectedCells[0];
    const cell = tableData.cells[row]?.[col];
    if (!cell || (cell.rowSpan <= 1 && cell.colSpan <= 1)) return;

    const origRowSpan = cell.rowSpan;
    const origColSpan = cell.colSpan;
    const newCells = tableData.cells.map(r => r.map(c => ({ ...c })));

    for (let r = row; r < row + origRowSpan; r++) {
      for (let c = col; c < col + origColSpan; c++) {
        if (!newCells[r]?.[c]) continue;
        newCells[r][c].rowSpan = 1;
        newCells[r][c].colSpan = 1;
        if (r !== row || c !== col) {
          newCells[r][c].content = '';
        }
      }
    }

    onUpdate(element.id, { tableData: { ...tableData, cells: newCells } } as any);
    setSelectedCells([]);
  };

  const startEdit = (ri: number, ci: number) => {
    const cell = tableData.cells[ri]?.[ci];
    if (cell) {
      setEditingCell({ row: ri, col: ci });
      setEditValue(cell.content);
    }
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));
    if (newCells[editingCell.row]?.[editingCell.col]) {
      newCells[editingCell.row][editingCell.col].content = editValue;
    }
    onUpdate(element.id, { tableData: { ...tableData, cells: newCells } } as any);
    setEditingCell(null);
  };

  const toggleDiagonal = (ri: number, ci: number) => {
    const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));
    newCells[ri][ci].diagonalLine = !newCells[ri][ci].diagonalLine;
    onUpdate(element.id, { tableData: { ...tableData, cells: newCells } } as any);
  };

  // Drag selection handlers
  const handleCellMouseDown = (ri: number, ci: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only trigger for left click
    if (editingCell) {
      commitEdit();
    }
    isDraggingSelect.current = true;
    dragStartCell.current = { row: ri, col: ci };

    let nextSelection = [{ row: ri, col: ci }];
    const cell = tableData.cells[ri]?.[ci];

    // If starting on a merged block, select the whole block scope initially
    if (cell && (cell.rowSpan > 1 || cell.colSpan > 1 || cell.rowSpan === 0 || cell.colSpan === 0)) {
      const bounds = expandSelectionBounds(ri, ci, ri, ci, tableData.cells);
      nextSelection = bounds.selected;
    }

    setSelectedCells(nextSelection);
    selectTableCell({ elementId: element.id, row: ri, col: ci });
  };

  const handleCellMouseEnter = (ri: number, ci: number) => {
    if (!isDraggingSelect.current || !dragStartCell.current) return;

    const bounds = expandSelectionBounds(
      dragStartCell.current.row,
      dragStartCell.current.col,
      ri,
      ci,
      tableData.cells
    );

    setSelectedCells(bounds.selected);
  };

  // Keyboard navigation & editor access
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return; // Let editor input consume typing

    let activeCell = selectedCells[0];
    if (!activeCell) return;

    // Find the cell with the minimum row and col as anchor
    const rows = selectedCells.map(c => c.row);
    const cols = selectedCells.map(c => c.col);
    const minRow = Math.min(...rows);
    const minCol = Math.min(...cols);

    let nextR = minRow;
    let nextC = minCol;
    let handled = false;

    const isCtrl = e.ctrlKey || e.metaKey;

    // Excel custom copy/paste
    if (isCtrl && e.key === 'c') {
      const activeCell = tableData.cells[minRow]?.[minCol];
      if (activeCell) {
        navigator.clipboard.writeText(activeCell.content || "");
      }
      return;
    }

    if (isCtrl && e.key === 'v') {
      navigator.clipboard.readText().then(text => {
        const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));
        if (newCells[minRow]?.[minCol]) {
          newCells[minRow][minCol].content = text;
          onUpdate(element.id, { tableData: { ...tableData, cells: newCells } } as any);
        }
      }).catch(err => {
        console.error("Paste error", err);
      });
      return;
    }

    // Direct typing to edit (Excel pattern)
    if (
      e.key.length === 1 &&
      !isCtrl &&
      !e.altKey &&
      e.key !== 'Escape' &&
      e.key !== ' '
    ) {
      e.preventDefault();
      setEditingCell({ row: minRow, col: minCol });
      setEditValue(e.key);
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        nextR = Math.max(0, minRow - 1);
        handled = true;
        break;
      case 'ArrowDown':
        nextR = Math.min(tableData.rows.length - 1, minRow + 1);
        handled = true;
        break;
      case 'ArrowLeft':
        nextC = Math.max(0, minCol - 1);
        handled = true;
        break;
      case 'ArrowRight':
        nextC = Math.min(tableData.columns.length - 1, minCol + 1);
        handled = true;
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          nextC = Math.max(0, minCol - 1);
        } else {
          nextC = Math.min(tableData.columns.length - 1, minCol + 1);
        }
        handled = true;
        break;
      case 'Enter':
        e.preventDefault();
        startEdit(minRow, minCol);
        handled = true;
        break;
      case 'Delete':
      case 'Backspace':
        // Safe mass field clear
        const newCells = tableData.cells.map(row => row.map(c => ({ ...c })));
        selectedCells.forEach(sel => {
          if (newCells[sel.row]?.[sel.col]) {
            newCells[sel.row][sel.col].content = '';
          }
        });
        onUpdate(element.id, { tableData: { ...tableData, cells: newCells } } as any);
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      const bounds = expandSelectionBounds(nextR, nextC, nextR, nextC, tableData.cells);
      setSelectedCells(bounds.selected);
      selectTableCell({ elementId: element.id, row: nextR, col: nextC });
    }
  };

  // Determine if a column letter or row number is currently selected to highlight them Excel-style
  const selectedRows = new Set(selectedCells.map(c => c.row));
  const selectedCols = new Set(selectedCells.map(c => c.col));

  return (
    <div
      className="table-editor"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <div className="table-editor-toolbar">
        <button className="te-btn" onClick={addRow} title="添加行">+行</button>
        <button className="te-btn" onClick={addColumn} title="添加列">+列</button>
        <button className="te-btn" onClick={mergeCells} title="合并单元格" disabled={selectedCells.length < 2}>合并</button>
        <button className="te-btn" onClick={splitCells} title="拆分单元格" disabled={selectedCells.length !== 1}>拆分</button>
        <button className="te-btn" onClick={() => { if (selectedCells.length === 1) toggleDiagonal(selectedCells[0].row, selectedCells[0].col); }} title="斜线" disabled={selectedCells.length !== 1}>斜线</button>
      </div>

      <div className="table-editor-grid-wrapper">
        <div className="table-editor-row-controls">
          {activeRows.map((row, ri) => {
            const isRowSelected = selectedRows.has(ri);
            return (
              <div
                key={row.id}
                className={`te-row-control ${isRowSelected ? 'selected-control' : ''}`}
                style={{ height: row.height }}
              >
                <span className="te-row-num">{ri + 1}</span>
                <button className="te-row-del" onClick={() => removeRow(ri)} title="删除行">x</button>
                <div className="te-row-resize-handle" onMouseDown={(e) => handleRowResizeStart(ri, e)} />
              </div>
            );
          })}
        </div>

        <div className="table-editor-grid-container">
          <div className="table-editor-col-controls">
            {activeColumns.map((col, ci) => {
              const isColSelected = selectedCols.has(ci);
              return (
                <div
                  key={col.id}
                  className={`te-col-control ${isColSelected ? 'selected-control' : ''}`}
                  style={{ width: col.width }}
                >
                  <span className="te-col-letter">{String.fromCharCode(65 + ci)}</span>
                  <button className="te-col-del" onClick={() => removeColumn(ci)} title="删除列">x</button>
                  <div className="te-col-resize-handle" onMouseDown={(e) => handleColumnResizeStart(ci, e)} />
                </div>
              );
            })}
          </div>

          <table className="table-editor-grid">
            <colgroup>{activeColumns.map(col => <col key={col.id} style={{ width: col.width }} />)}</colgroup>
            <tbody>
              {tableData.cells.map((row, ri) => (
                <tr key={ri} style={{ height: activeRows[ri]?.height ?? tableData.rows[ri].height }}>
                  {row.map((cell, ci) => {
                    if (cell.rowSpan <= 0 || cell.colSpan <= 0) return null;
                    const isSelected = selectedCells.some(s => s.row === ri && s.col === ci);
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                    return (
                      <td
                        key={cell.id}
                        rowSpan={cell.rowSpan}
                        colSpan={cell.colSpan}
                        className={`te-cell ${isSelected ? 'selected' : ''} ${tableData.rows[ri].isHeader ? 'header' : ''}`}
                        style={{ backgroundColor: cell.backgroundColor, border: '1px solid #475569' }}
                        onMouseDown={(e) => handleCellMouseDown(ri, ci, e)}
                        onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                        onDoubleClick={() => startEdit(ri, ci)}
                      >
                        {isEditing ? (
                          <input className="te-cell-input" value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
                            autoFocus />
                        ) : (
                          <span>{cell.content || cell.dataField || (cell.diagonalLine ? '/' : '')}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
