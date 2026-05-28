/**
 * @file Designer.tsx
 * @brief Root layout component for the Report Designer application.
 *
 * Assembles the main UI shell: MenuBar, OptionsBar, a resizable left sidebar
 * (Toolbar), the central Canvas, and a resizable right sidebar with
 * tabbed Property/Layer panels. Also registers global keyboard shortcuts for
 * undo/redo, copy/paste, delete, tool switching, and zoom control.
 */

import React, { useState, useCallback, useEffect } from "react";
import { MenuBar } from "../MenuBar/MenuBar";
import { Toolbar } from "../Toolbar/Toolbar";
import { OptionsBar } from "../OptionsBar/OptionsBar";
import { Canvas } from "../Canvas/Canvas";
import { PropertyPanel } from "../PropertyPanel/PropertyPanel";
import { LayerPanel } from "../LayerPanel/LayerPanel";
import { useDesignerStore } from "../../store/designerStore";
import "./Designer.css";

/**
 * Main Designer component — the top-level layout that orchestrates the
 * report designer UI.
 *
 * Manages:
 * - Resizable left (toolbar) and right (property/layer) sidebars via drag
 * - Right-panel tab switching between Property and Layer views
 * - Global keyboard shortcuts (undo, redo, copy, paste, delete, tool keys, zoom)
 *
 * @returns The full designer layout JSX
 */
export const Designer: React.FC = () => {
  /* ── Layout state ── */

  /** Currently active tab in the right sidebar panel */
  const [rightTab, setRightTab] = useState<"property" | "layer">("property");
  /** Width of the left sidebar (toolbar area) in pixels */
  const [leftWidth, setLeftWidth] = useState(48);
  /** Width of the right sidebar (property/layer area) in pixels */
  const [rightWidth, setRightWidth] = useState(280);
  /** Whether the user is currently dragging the left sidebar resizer */
  const [isLeftDragging, setIsLeftDragging] = useState(false);
  /** Whether the user is currently dragging the right sidebar resizer */
  const [isRightDragging, setIsRightDragging] = useState(false);

  /* ── Store bindings ── */

  const {
    selectedElementIds,
    deleteElement,
    copySelected,
    pasteElements,
    undo,
    redo,
    setActiveTool,
    clearSelection,
    setZoom,
  } = useDesignerStore();

  /* ── Sidebar resize handlers ── */

  /**
   * Initiates left sidebar resize drag.
   * Clamps width between 48px (collapsed) and 350px.
   */
  const startLeftResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsLeftDragging(true);
    const handleMouseMove = (mvE: MouseEvent) => {
      setLeftWidth(Math.max(48, Math.min(mvE.clientX, 350)));
    };
    const handleMouseUp = () => {
      setIsLeftDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  /**
   * Initiates right sidebar resize drag.
   * Computes width from the right edge of the viewport; clamps between 200px and 600px.
   */
  const startRightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsRightDragging(true);
    const handleMouseMove = (mvE: MouseEvent) => {
      const newWidth = window.innerWidth - mvE.clientX;
      setRightWidth(Math.max(200, Math.min(newWidth, 600)));
    };
    const handleMouseUp = () => {
      setIsRightDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  /* ── Global keyboard shortcuts ── */

  /**
   * Central keyboard handler for the designer.
   *
   * Shortcuts:
   * - Ctrl+Z / Ctrl+Y: Undo / Redo
   * - Ctrl+C / Ctrl+V: Copy / Paste
   * - Delete / Backspace: Delete selected elements
   * - Escape: Clear selection and switch to select tool
   * - 1-5: Quick tool switching (select, text, rectangle, line, table)
   * - Ctrl+= / Ctrl+- / Ctrl+0: Zoom in / out / reset
   *
   * Ignores shortcuts when focus is inside INPUT, TEXTAREA, or contentEditable.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable
      )
        return; // Skip shortcuts when user is typing in an input field
      const isCtrl = e.ctrlKey || e.metaKey; // Support both Windows Ctrl and Mac Cmd
      if (isCtrl && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (isCtrl && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (isCtrl && e.key === "c") {
        e.preventDefault();
        copySelected();
      } else if (isCtrl && e.key === "v") {
        e.preventDefault();
        pasteElements();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        selectedElementIds.forEach((id) => deleteElement(id));
      } else if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
      } else if (e.key === "1") setActiveTool("select");    // Shortcut key 1: Select tool
      else if (e.key === "2") setActiveTool("text");        // Shortcut key 2: Text tool
      else if (e.key === "3") setActiveTool("rectangle");   // Shortcut key 3: Rectangle tool
      else if (e.key === "4") setActiveTool("line");        // Shortcut key 4: Line tool
      else if (e.key === "5") setActiveTool("table");       // Shortcut key 5: Table tool
      else if (isCtrl && e.key === "=") {
        e.preventDefault();
        setZoom(useDesignerStore.getState().zoom + 0.1);
      } else if (isCtrl && e.key === "-") {
        e.preventDefault();
        setZoom(useDesignerStore.getState().zoom - 0.1);
      } else if (isCtrl && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    },
    [
      selectedElementIds,
      deleteElement,
      copySelected,
      pasteElements,
      undo,
      redo,
      clearSelection,
      setActiveTool,
      setZoom,
    ],
  );

  /* ── Register / cleanup global keydown listener ── */
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  /* ── Render layout ── */

  return (
    <div className="designer">
      <MenuBar />
      <OptionsBar />
      <div className="designer-body">
        {/* Left sidebar: Toolbar + resize handle */}
        <div className="left-sidebar-wrapper" style={{ width: leftWidth }}>
          <Toolbar />
          <div
            className={`sidebar-resizer left-resizer ${
              isLeftDragging ? "is-dragging" : ""
            }`}
            onMouseDown={startLeftResize}
          />
        </div>
        {/* Central canvas area */}
        <Canvas />
        {/* Right sidebar: Property / Layer tabs + resize handle */}
        <div className="right-sidebar-wrapper" style={{ width: rightWidth }}>
          <div
            className={`sidebar-resizer right-resizer ${
              isRightDragging ? "is-dragging" : ""
            }`}
            onMouseDown={startRightResize}
          />
          <div className="right-panel">
            <div className="right-panel-tabs">
              <button
                className={`right-tab ${
                  rightTab === "property" ? "active" : ""
                }`}
                onClick={() => setRightTab("property")}
              >
                属性
              </button>
              <button
                className={`right-tab ${rightTab === "layer" ? "active" : ""}`}
                onClick={() => setRightTab("layer")}
              >
                图层
              </button>
            </div>
            <div className="right-panel-content">
              {rightTab === "property" ? <PropertyPanel /> : <LayerPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
