import React, { useState, useCallback, useEffect } from "react";
import { MenuBar } from "../MenuBar/MenuBar";
import { Toolbar } from "../Toolbar/Toolbar";
import { OptionsBar } from "../OptionsBar/OptionsBar";
import { Canvas } from "../Canvas/Canvas";
import { PropertyPanel } from "../PropertyPanel/PropertyPanel";
import { LayerPanel } from "../LayerPanel/LayerPanel";
import { useDesignerStore } from "../../store/designerStore";
import "./Designer.css";

export const Designer: React.FC = () => {
  const [rightTab, setRightTab] = useState<"property" | "layer">("property");
  const [leftWidth, setLeftWidth] = useState(48);
  const [rightWidth, setRightWidth] = useState(280);
  const [isLeftDragging, setIsLeftDragging] = useState(false);
  const [isRightDragging, setIsRightDragging] = useState(false);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      const isCtrl = e.ctrlKey || e.metaKey;
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
      } else if (e.key === "1") setActiveTool("select");
      else if (e.key === "2") setActiveTool("text");
      else if (e.key === "3") setActiveTool("rectangle");
      else if (e.key === "4") setActiveTool("line");
      else if (e.key === "5") setActiveTool("table");
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

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="designer">
      <MenuBar />
      <OptionsBar />
      <div className="designer-body">
        <div className="left-sidebar-wrapper" style={{ width: leftWidth }}>
          <Toolbar />
          <div
            className={`sidebar-resizer left-resizer ${
              isLeftDragging ? "is-dragging" : ""
            }`}
            onMouseDown={startLeftResize}
          />
        </div>
        <Canvas />
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
